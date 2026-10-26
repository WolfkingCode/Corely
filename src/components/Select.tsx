import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
  ariaLabel?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
  size = 'md',
  'aria-label': ariaLabelProp,
  ariaLabel
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  }>({
    top: 0,
    left: 0,
    width: 120,
    maxHeight: 240,
    openUp: false
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || value || '');
  const labelText = ariaLabelProp || ariaLabel || displayLabel;

  // Calculate position relative to button
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const margin = 6;
    const width = Math.max(120, rect.width);
    const estimatedHeight = Math.min(240, options.length * 38 + 12);

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const shouldOpenUp = spaceBelow < Math.min(160, estimatedHeight) && spaceAbove > spaceBelow;

    let maxHeight = 240;
    let top = 0;

    if (shouldOpenUp) {
      maxHeight = Math.max(80, Math.min(240, spaceAbove));
      top = rect.top - Math.min(estimatedHeight, maxHeight) - margin;
      if (top < margin) top = margin;
    } else {
      maxHeight = Math.max(80, Math.min(240, spaceBelow));
      top = rect.bottom + margin;
    }

    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (left < margin) {
      left = margin;
    }

    setCoords({
      top: Math.round(top),
      left: Math.round(left),
      width: Math.round(width),
      maxHeight: Math.round(maxHeight),
      openUp: shouldOpenUp
    });
  }, [options.length]);

  // Handle open toggle
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Select option handler
  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  // Set initial highlighted index on open
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, value, options]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !popoverRef.current) return;
    const targetEl = popoverRef.current.querySelector('[data-highlighted="true"]') as HTMLElement | null;
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Event listeners for close, scroll reposition, resize
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        popoverRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && popoverRef.current?.contains(target)) {
        return;
      }
      updatePosition();
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition]);

  // Keyboard navigation on button
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        updatePosition();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[highlightedIndex]) {
        handleSelect(options[highlightedIndex].value);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs rounded-xl'
    : 'px-3 py-2 text-xs rounded-xl';

  const baseButtonClasses = `inline-flex items-center justify-between gap-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] transition-all cursor-pointer select-none focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 hover:border-[var(--accent)] ${sizeClasses} ${
    isOpen ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30' : ''
  } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={labelText}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`${baseButtonClasses} ${className}`}
      >
        <span className="truncate text-start flex-1 font-medium">
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text3)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--accent)]' : ''
          }`}
        />
      </button>

      {isOpen && typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={popoverRef}
              role="listbox"
              id={listboxId}
              aria-label={labelText}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.96, y: coords.openUp ? 4 : -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: coords.openUp ? 4 : -4 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
                maxHeight: `${coords.maxHeight}px`,
                zIndex: 9999
              }}
              className="rounded-2xl border border-[var(--card-border,var(--border))] bg-[var(--card-bg-strong,#12182b)] shadow-2xl p-1 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar backdrop-blur-xl select-none"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[var(--text3)] text-center">
                  {placeholder || '—'}
                </div>
              ) : (
                options.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <div
                      key={`${opt.value}-${idx}`}
                      role="option"
                      id={`${listboxId}-opt-${idx}`}
                      aria-selected={isSelected}
                      data-highlighted={isHighlighted}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors text-start ${
                        isSelected
                          ? 'bg-[var(--accent-glass,rgba(59,130,246,0.18))] text-[var(--accent,#60a5fa)] font-semibold'
                          : isHighlighted
                          ? 'bg-[var(--sidebar-hover)] text-[var(--text)]'
                          : 'text-[var(--text2)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                      }`}
                    >
                      <span className="truncate flex-1">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--accent,#60a5fa)] shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';

export interface TimePickerProps {
  value: string; // 'HH:MM' 24-hour format
  onChange: (value: string) => void;
  disabled?: boolean;
  isEn?: boolean;
  'aria-label'?: string;
  ariaLabel?: string;
}

export default function TimePicker({
  value,
  onChange,
  disabled = false,
  isEn = false,
  'aria-label': ariaLabelProp,
  ariaLabel
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const hoursListRef = useRef<HTMLDivElement | null>(null);
  const minutesListRef = useRef<HTMLDivElement | null>(null);

  // Normalize current value to valid 2-digit HH:MM
  const parseTime = useCallback((timeStr: string): [string, string] => {
    if (!timeStr || typeof timeStr !== 'string') return ['00', '00'];
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const validH = isNaN(h) ? 0 : Math.max(0, Math.min(23, h));
    const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
    return [
      String(validH).padStart(2, '0'),
      String(validM).padStart(2, '0')
    ];
  }, []);

  const [currentH, currentM] = parseTime(value);

  // Hours: 00 to 23
  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  // Minutes: 00, 05, 10, ... 55, plus custom minute if not divisible by 5
  const baseMinutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  const minutesList = [...baseMinutes];
  if (!minutesList.includes(currentM)) {
    minutesList.push(currentM);
    minutesList.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  // Update position relative to button
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 220;
    const popoverHeight = 270;
    const margin = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUp = spaceBelow < popoverHeight && spaceAbove > popoverHeight;

    const top = shouldOpenUp
      ? rect.top - popoverHeight - margin
      : rect.bottom + margin;

    // Horizontally align, keeping inside screen boundaries
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    setCoords({
      top: Math.max(margin, top),
      left: Math.max(margin, left),
      openUp: shouldOpenUp
    });
  }, []);

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

  // Close on outside click, escape key; reposition on external scroll and resize
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

    const handleKeyDown = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition]);

  // Center selected hour and minute in view when popover opens
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (hoursListRef.current) {
        const selectedHourEl = hoursListRef.current.querySelector('[data-selected="true"]');
        if (selectedHourEl) {
          selectedHourEl.scrollIntoView({ block: 'center' });
        }
      }
      if (minutesListRef.current) {
        const selectedMinEl = minutesListRef.current.querySelector('[data-selected="true"]');
        if (selectedMinEl) {
          selectedMinEl.scrollIntoView({ block: 'center' });
        }
      }
    }, 20);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleSelectHour = (newHour: string) => {
    onChange(`${newHour}:${currentM}`);
  };

  const handleSelectMinute = (newMinute: string) => {
    onChange(`${currentH}:${newMinute}`);
  };

  const resolvedAriaLabel = ariaLabelProp || ariaLabel || (isEn ? 'Select time' : 'انتخاب ساعت');

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={resolvedAriaLabel}
        className={`px-3 py-1.5 rounded-xl inline-flex items-center gap-2 bg-[var(--input-bg)] hover:bg-[var(--card-hover,rgba(255,255,255,0.06))] active:scale-95 border border-[var(--border)] text-xs text-[var(--text)] font-mono font-medium tabular-nums cursor-pointer transition-all shadow-xs focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/50 ${
          isOpen ? 'border-[var(--accent)] bg-[var(--sidebar-hover)] ring-1 ring-[var(--accent)]/30' : ''
        } ${disabled ? 'opacity-35 cursor-not-allowed pointer-events-none' : ''}`}
      >
        <Clock className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
        <span className="tracking-wider">{`${currentH}:${currentM}`}</span>
      </button>

      {isOpen && typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={popoverRef}
              role="dialog"
              aria-modal="true"
              aria-label={isEn ? 'Time selection dialog' : 'پنجره انتخاب زمان'}
              initial={{ opacity: 0, scale: 0.95, y: coords.openUp ? 6 : -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: '220px',
                zIndex: 9999
              }}
              className="p-3 rounded-2xl bg-[var(--card-bg-strong,#12182b)] border border-[var(--card-border,rgba(59,130,246,0.2))] shadow-2xl backdrop-blur-xl text-[var(--text,#f8fafc)] select-none flex flex-col gap-2.5"
            >
              {/* Header preview */}
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 px-0.5">
                <span className="text-[11px] font-medium text-[var(--text3)]">
                  {isEn ? 'Time Picker' : 'تنظیم ساعت'}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-[var(--accent-glass,rgba(59,130,246,0.15))] text-[var(--accent,#60a5fa)] tabular-nums border border-[var(--card-border)]">
                  {`${currentH}:${currentM}`}
                </span>
              </div>

              {/* Column labels */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-[var(--text3)] text-center px-1">
                <span>{isEn ? 'Hour' : 'ساعت'}</span>
                <span>{isEn ? 'Minute' : 'دقیقه'}</span>
              </div>

              {/* Scrollable columns */}
              <div className="grid grid-cols-2 gap-2 h-40">
                {/* Hours Column */}
                <div
                  ref={hoursListRef}
                  className="overflow-y-auto space-y-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] scrollbar-none"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {hoursList.map((h) => {
                    const isSelected = h === currentH;
                    return (
                      <button
                        key={h}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => handleSelectHour(h)}
                        aria-label={`${h} ${isEn ? 'hours' : 'ساعت'}`}
                        className={`w-full py-1 text-center text-xs font-mono rounded-lg transition-colors cursor-pointer tabular-nums ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                            : 'text-[var(--text2)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>

                {/* Minutes Column */}
                <div
                  ref={minutesListRef}
                  className="overflow-y-auto space-y-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] scrollbar-none"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {minutesList.map((m) => {
                    const isSelected = m === currentM;
                    return (
                      <button
                        key={m}
                        type="button"
                        data-selected={isSelected}
                        onClick={() => handleSelectMinute(m)}
                        aria-label={`${m} ${isEn ? 'minutes' : 'دقیقه'}`}
                        className={`w-full py-1 text-center text-xs font-mono rounded-lg transition-colors cursor-pointer tabular-nums ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white font-bold shadow-xs'
                            : 'text-[var(--text2)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Confirm Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full py-1.5 rounded-xl bg-[var(--accent)] hover:opacity-90 active:scale-98 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer text-center"
              >
                {isEn ? 'Done' : 'تأیید'}
              </button>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

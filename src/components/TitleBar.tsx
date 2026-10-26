import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import CorelyLogo from './icons/CorelyLogo';
import { isDesktopApp } from '../lib/notifications';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktopApp()) return;

    window.corelyDesktop?.window?.isMaximized?.().then((max) => {
      setIsMaximized(Boolean(max));
    });

    window.corelyDesktop?.window?.onMaximizedChange?.((val) => {
      setIsMaximized(Boolean(val));
    });
  }, []);

  if (!isDesktopApp()) {
    return null;
  }

  const handleMinimize = () => {
    window.corelyDesktop?.window?.minimize?.();
  };

  const handleMaximize = () => {
    window.corelyDesktop?.window?.maximize?.();
  };

  const handleClose = () => {
    window.corelyDesktop?.window?.close?.();
  };

  return (
    <header
      id="corely-custom-titlebar"
      dir="ltr"
      onDoubleClick={handleMaximize}
      style={{ WebkitAppRegion: 'drag', background: 'var(--glass-bg)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)' } as React.CSSProperties}
      className="relative h-[36px] min-h-[36px] w-full select-none flex items-center justify-between border-b border-[var(--glass-border)] z-50 text-[var(--text2)] shrink-0"
    >
      {/* Brand / Logo + App Name */}
      <div className="flex items-center gap-2 px-3.5 h-full pointer-events-none">
        <CorelyLogo className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-xs font-semibold tracking-wide text-[var(--text2)]">Corely</span>
      </div>

      {/* Window Controls (no-drag) */}
      <div
        dir="ltr"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center h-full"
      >
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
          className="w-[46px] h-full flex items-center justify-center text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] active:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          className="w-[46px] h-full flex items-center justify-center text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] active:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="w-3.5 h-3.5 rotate-90" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
          className="w-[46px] h-full flex items-center justify-center text-[var(--text2)] hover:text-white hover:bg-rose-600 active:bg-rose-700 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

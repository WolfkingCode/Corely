/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getTranslation } from '../lib/i18n';
import { AppSettings } from '../types';

interface MobileBottomNavProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
  settings: AppSettings;
  onPreloadPanel?: (panel: string) => void;
  settingsTab?: string;
}

export default function MobileBottomNav({
  activePanel,
  onPanelChange,
  settings,
  onPreloadPanel,
  settingsTab
}: MobileBottomNavProps) {
  const t = getTranslation(settings.language);
  const isAppearanceActive = activePanel === 'appearance' || (activePanel === 'settings' && settingsTab === 'appearance');
  const isSettingsActive = activePanel === 'settings' && settingsTab !== 'appearance';

  return (
    <>
      {/* Floating bottom dock for Mobile layout */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[var(--sidebar-bg)] backdrop-blur-xl border-t border-[var(--border)] p-3 flex justify-around">
        <button 
          onClick={() => onPanelChange('home')}
          className={`flex flex-col items-center gap-1 text-center cursor-pointer transition-colors ${(activePanel === 'home' || activePanel === 'routine') ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-[var(--text3)]'}`}
        >
          <span className="text-xl">🏠</span>
          <span className="text-[10px]">{t.home}</span>
        </button>
        <button 
          onClick={() => onPanelChange('note')}
          onMouseEnter={() => onPreloadPanel?.('note')}
          onTouchStart={() => onPreloadPanel?.('note')}
          className={`flex flex-col items-center gap-1 text-center cursor-pointer transition-colors ${activePanel === 'note' ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-[var(--text3)]'}`}
        >
          <span className="text-xl">📝</span>
          <span className="text-[10px]">{t.note}</span>
        </button>
        <button 
          onClick={() => onPanelChange('ideas')}
          onMouseEnter={() => onPreloadPanel?.('ideas')}
          onTouchStart={() => onPreloadPanel?.('ideas')}
          className={`flex flex-col items-center gap-1 text-center cursor-pointer transition-colors ${activePanel === 'ideas' ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-[var(--text3)]'}`}
        >
          <span className="text-xl">💡</span>
          <span className="text-[10px]">{t.ideas}</span>
        </button>
        <button 
          onClick={() => onPanelChange('finance')}
          onMouseEnter={() => onPreloadPanel?.('finance')}
          onTouchStart={() => onPreloadPanel?.('finance')}
          className={`flex flex-col items-center gap-1 text-center cursor-pointer transition-colors ${activePanel === 'finance' ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-[var(--text3)]'}`}
        >
          <span className="text-xl">💰</span>
          <span className="text-[10px]">{t.finance}</span>
        </button>
        <button 
          onClick={() => onPanelChange('downloads')}
          onMouseEnter={() => onPreloadPanel?.('downloads')}
          onTouchStart={() => onPreloadPanel?.('downloads')}
          className={`flex flex-col items-center gap-1 text-center cursor-pointer transition-colors ${activePanel === 'downloads' ? 'text-violet-600 dark:text-violet-400 font-bold' : 'text-[var(--text3)]'}`}
        >
          <span className="text-xl">📥</span>
          <span className="text-[10px]">{t.downloads}</span>
        </button>
      </div>

      {/* Floating utility buttons at the bottom-end corner */}
      <div className="fixed bottom-20 end-6 z-40 flex flex-row md:hidden gap-2.5">
        <button 
          onClick={() => onPanelChange('settings')}
          onMouseEnter={() => onPreloadPanel?.('settings')}
          onTouchStart={() => onPreloadPanel?.('settings')}
          className={`w-11 h-11 rounded-full transition-all duration-200 cursor-pointer border shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 ${isSettingsActive ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--sidebar-bg)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--sidebar-hover)] backdrop-blur-md'}`}
          title={t.settings}
          id="floating-settings-btn"
        >
          <span className="text-lg">⚙️</span>
        </button>
        <button 
          onClick={() => onPanelChange('appearance')}
          onMouseEnter={() => onPreloadPanel?.('appearance')}
          onTouchStart={() => onPreloadPanel?.('appearance')}
          className={`w-11 h-11 rounded-full transition-all duration-200 cursor-pointer border shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 ${isAppearanceActive ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--sidebar-bg)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--sidebar-hover)] backdrop-blur-md'}`}
          title={settings.language === 'en' ? 'Appearance' : 'شخصی‌سازی'}
          id="floating-appearance-btn"
        >
          <span className="text-lg">🎨</span>
        </button>
      </div>
    </>
  );
}

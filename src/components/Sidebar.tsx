import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Bot,
  FileText, 
  Lightbulb, 
  Clapperboard,
  Coins, 
  Download,
  Wifi,
  Settings,
  Search,
  ChevronRight
} from 'lucide-react';
import CorelyLogo from './icons/CorelyLogo';
import { ThemeConfig, AppSettings } from '../types';
import { getTranslation } from '../lib/i18n';

interface SidebarTheme extends Partial<ThemeConfig> {
  sidebarBg?: string;
  sidebarBorder?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
  accent?: string;
  cardBorder?: string;
}

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
  theme: SidebarTheme;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  settings?: AppSettings;
  onPreloadPanel?: (panel: string) => void;
  onOpenSearch?: () => void;
}

export default function Sidebar({ 
  activePanel, 
  onPanelChange, 
  theme, 
  isCollapsed,
  onToggleCollapse,
  settings,
  onPreloadPanel,
  onOpenSearch
}: SidebarProps) {
  const t = getTranslation(settings?.language);
  const isEn = settings?.language === 'en';

  // Windows 11 Fluent Reveal mouse position handler
  const handleRevealMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const menuItems = [
    { id: 'home', label: t.home, icon: Home },
    { id: 'ai', label: t.ai, icon: Bot },
    { id: 'note', label: t.note, icon: FileText },
    { id: 'ideas', label: t.ideas, icon: Lightbulb },
    { id: 'edit_assets', label: t.edit_assets, icon: Clapperboard },
    { id: 'finance', label: t.finance, icon: Coins },
    { id: 'downloads', label: t.downloads, icon: Download },
    { id: 'dns', label: t.dns, icon: Wifi },
  ];

  return (
    <aside 
      className={`sidebar hidden md:flex w-full h-full border-e transition-all duration-300 ease-in-out flex-col justify-between py-3 z-20 select-none overflow-hidden ${theme.sidebarBg} ${theme.sidebarBorder}`}
      id="sidebar"
    >
      <div className="flex flex-col gap-2.5 min-h-0 flex-1 overflow-y-auto">
        {/* Workspace Brand / Header with Purple-to-Indigo Logo */}
        <div className={`transition-all duration-300 ${isCollapsed ? 'px-1.5 flex justify-center' : 'px-3.5 flex items-center justify-between gap-2'}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 shadow-indigo-500/25 shrink-0 cursor-pointer press-feedback"
              onClick={isCollapsed ? onToggleCollapse : undefined}
            >
              <CorelyLogo className="w-4 h-4 text-white" />
            </motion.div>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex flex-col truncate whitespace-nowrap overflow-hidden"
                >
                  <span className={`text-[13px] font-bold tracking-tight flex items-center gap-1.5 ${theme.textPrimary}`}>
                    Corely
                    <span className="text-[8px] font-black tracking-wide px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/25 leading-none">
                      BETA
                    </span>
                  </span>
                  <span className={`text-[9.5px] font-mono ${theme.textMuted}`}>v1.0</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                onClick={onToggleCollapse}
                onMouseMove={handleRevealMouseMove}
                className="p-1 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer shrink-0 hover:border-violet-500 press-feedback fluent-reveal"
                title={isEn ? 'Toggle Sidebar' : 'بستن منو'}
                id="sidebar-toggle-btn"
              >
                <ChevronRight className={`w-3.5 h-3.5 relative z-10 ${isEn ? 'rotate-180' : ''}`} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation list */}
        <nav className={`flex flex-col gap-1 transition-all duration-300 ${isCollapsed ? 'items-center px-1.5' : 'px-2.5 w-full'}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'home' ? (activePanel === 'home' || activePanel === 'routine') : activePanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPanelChange(item.id)}
                onMouseMove={handleRevealMouseMove}
                onMouseEnter={() => onPreloadPanel?.(item.id)}
                onFocus={() => onPreloadPanel?.(item.id)}
                onTouchStart={() => onPreloadPanel?.(item.id)}
                title={item.label}
                className={`flex items-center transition-all duration-200 group cursor-pointer overflow-hidden press-feedback fluent-reveal relative
                  ${isCollapsed 
                    ? `w-8.5 h-8.5 justify-center rounded-xl ${
                        isActive 
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-500/25' 
                          : `hover:bg-[var(--sidebar-hover)] ${theme.textSecondary}`
                      }`
                    : `gap-2.5 px-2.5 py-1.5 rounded-xl text-[12.5px] font-medium w-full text-start ${
                        isActive 
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-500/25 font-semibold' 
                          : `hover:bg-[var(--sidebar-hover)] ${theme.textSecondary}`
                      }`
                  }
                `}
                id={`sidebar-item-${item.id}`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 shrink-0 relative z-10 ${isActive ? 'text-white' : theme.textMuted}`} />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="flex-1 text-start truncate whitespace-nowrap overflow-hidden relative z-10"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Actions */}
      <div className={`flex flex-col gap-2 transition-all duration-300 shrink-0 ${isCollapsed ? 'items-center px-1.5' : 'px-2.5'}`}>
        <div className="h-[1px] w-full bg-[var(--border)]"></div>
        
        {/* Search + Settings buttons - standalone icon buttons */}
        <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col justify-center' : 'justify-start'}`}>
          <button
            onClick={() => onPanelChange('settings')}
            onMouseMove={handleRevealMouseMove}
            onMouseEnter={() => onPreloadPanel?.('settings')}
            onFocus={() => onPreloadPanel?.('settings')}
            onTouchStart={() => onPreloadPanel?.('settings')}
            className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl border transition-all cursor-pointer hover:bg-[var(--sidebar-hover)] press-feedback fluent-reveal relative
              ${activePanel === 'settings' 
                ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 border-transparent text-white shadow-md shadow-indigo-500/20' 
                : `${theme.cardBorder} ${theme.textSecondary}`
              }
            `}
            id="sidebar-action-settings"
            title={isEn ? 'Settings' : 'تنظیمات'}
          >
            <Settings className={`w-4 h-4 shrink-0 transition-transform duration-200 hover:rotate-45 relative z-10 ${activePanel === 'settings' ? 'text-white' : theme.textMuted}`} />
          </button>
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              onMouseMove={handleRevealMouseMove}
              className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl border transition-all cursor-pointer hover:bg-[var(--sidebar-hover)] press-feedback fluent-reveal relative ${theme.cardBorder} ${theme.textSecondary}`}
              id="sidebar-action-search"
              title={isEn ? 'Search (Ctrl+K)' : 'جستجو (Ctrl+K)'}
            >
              <Search className={`w-4 h-4 shrink-0 relative z-10 ${theme.textMuted}`} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

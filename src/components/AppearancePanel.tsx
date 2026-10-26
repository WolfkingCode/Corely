/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Sparkles, Moon, Sun, Check } from 'lucide-react';
import { THEMES, DEFAULT_THEMES, CUSTOM_THEMES, APP_THEMES } from '../lib/themes';

export { THEMES, DEFAULT_THEMES, CUSTOM_THEMES, APP_THEMES };

interface AppearancePanelProps {
  key?: string;
  isEn?: boolean;
  activeTheme: string;
  onThemeChange: (themeId: string) => void;
}

export default function AppearancePanel({
  isEn = false,
  activeTheme,
  onThemeChange
}: AppearancePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Themes Selection (Dark / Light) */}
      <div className="settings-card p-6">
        <div className="settings-label text-base font-bold mb-1.5 flex items-center gap-2.5 text-[var(--text)]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>{isEn ? 'Theme & Visual Identity' : 'پوسته و هویت بصری'}</span>
        </div>
        
        <p className="settings-sub text-xs text-[var(--text3)] mb-6 leading-relaxed">
          {isEn 
            ? 'Choose between Brand Dark (deep slate canvas with radiant violet-indigo glow) or Brand Light (crisp soft workspace with balanced typography).' 
            : 'بین دو تم طراحی‌شده با هویت رنگی «Corely» (بنفش-نیلی-آبی) انتخاب کنید: تاریک عمیق یا روشن شفاف.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {DEFAULT_THEMES.map((theme) => {
            const isSelected = activeTheme === theme.id;
            const isDark = theme.id === 'dark';
            return (
              <div
                key={theme.id}
                className={`theme-opt relative p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                  isSelected 
                    ? 'border-violet-500 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent shadow-lg shadow-violet-500/10' 
                    : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-violet-400/40 hover:bg-[var(--sidebar-hover)]'
                }`}
                onClick={() => onThemeChange(theme.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Visual Swatch Preview */}
                  <div 
                    className="w-14 h-14 rounded-2xl shadow-inner border border-white/20 shrink-0 flex items-center justify-center text-white relative overflow-hidden" 
                    style={{ background: theme.sw }}
                  >
                    {isDark ? (
                      <Moon className="w-6 h-6 text-violet-300 drop-shadow-md" />
                    ) : (
                      <Sun className="w-6 h-6 text-amber-500 drop-shadow-md" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-[var(--text)] flex items-center justify-between">
                      <span>{isEn ? theme.labelEn : theme.label}</span>
                      {isSelected && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3" />
                          <span>{isEn ? 'Active' : 'فعال'}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text3)] mt-1.5 leading-relaxed">
                      {isDark 
                        ? (isEn ? 'Deep dark canvas with violet highlights & high contrast' : 'فضای تیره با پس‌زمینه عمیق، هایلایت‌های بنفش-نیلی و کنتراست بالا')
                        : (isEn ? 'Crisp light palette with soft lavender depth' : 'پالت روشن ملایم، حس تازگی و سایه‌های دقیق سازگار با چشم')}
                    </p>
                  </div>
                </div>

                {/* Micro preview elements to demonstrate accent */}
                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0 shadow-xs" />
                    <span className="text-[var(--text2)] font-medium">
                      {isEn ? 'Brand Accent' : 'رنگ سازمانی:'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-4 h-4 rounded-md bg-violet-600 text-white flex items-center justify-center text-[8px] font-bold">#</span>
                    <span className="w-4 h-4 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[8px] font-bold">#</span>
                    <span className="w-4 h-4 rounded-md bg-blue-600 text-white flex items-center justify-center text-[8px] font-bold">#</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

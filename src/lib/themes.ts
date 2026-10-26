/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const THEMES = {
  // ۱. تم تاریک برند (Brand Deep Dark with Violet-Indigo Accent)
  dark: {
    name: 'تاریک برند',
    nameEn: 'Brand Dark',
    bg: 'from-[#0b0e17] via-[#11162b] to-[#07090f]',
    sidebarBg: 'bg-[#0e1222]/90',
    sidebarBorder: 'border-indigo-950/60',
    contentBg: 'bg-[#07090f]/40',
    cardBg: 'bg-[#12182b]/85 backdrop-blur-md',
    cardBorder: 'border-indigo-500/15',
    cardShadow: 'shadow-lg shadow-black/40',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-300',
    textMuted: 'text-slate-400',
    accent: 'bg-gradient-to-r from-violet-600 to-indigo-600',
    accentHover: 'hover:from-violet-500 hover:to-indigo-500',
    accentGlass: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
    clockColor: 'text-white',
    dateColor: 'text-slate-300'
  },
  
  // ۲. تم روشن برند (Brand Soft Light with Violet-Indigo Accent)
  light: {
    name: 'روشن برند',
    nameEn: 'Brand Light',
    bg: 'from-[#f5f6fc] via-[#edf0fd] to-[#e8ecf8]',
    sidebarBg: 'bg-white/92',
    sidebarBorder: 'border-indigo-100/90',
    contentBg: 'bg-indigo-50/30',
    cardBg: 'bg-white/95 backdrop-blur-md',
    cardBorder: 'border-indigo-100/80',
    cardShadow: 'shadow-md shadow-indigo-950/5',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-700',
    textMuted: 'text-slate-500',
    accent: 'bg-gradient-to-r from-violet-600 to-indigo-600',
    accentHover: 'hover:from-violet-700 hover:to-indigo-700',
    accentGlass: 'bg-violet-600/10 border-violet-600/20 text-violet-700',
    clockColor: 'text-slate-900',
    dateColor: 'text-slate-600',
    isLight: true
  }
};

export const DEFAULT_THEMES = [
  { 
    id: 'dark', 
    label: 'تاریک برند', 
    labelEn: 'Brand Dark', 
    sw: 'linear-gradient(135deg, #0b0e17 0%, #0f1e4a 50%, #2563eb 100%)' 
  },
  { 
    id: 'light', 
    label: 'روشن برند', 
    labelEn: 'Brand Light', 
    sw: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 50%, #3b82f6 100%)' 
  }
];

export const CUSTOM_THEMES: typeof DEFAULT_THEMES = [];

export const APP_THEMES = [...DEFAULT_THEMES];

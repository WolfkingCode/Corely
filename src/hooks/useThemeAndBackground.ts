/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { THEMES } from '../lib/themes';

export function useThemeAndBackground() {
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    const saved = localStorage.getItem('v3_ui_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return 'dark';
  });

  // Update DOM theme attribute and localStorage with sanitized theme
  useEffect(() => {
    const validTheme = (activeTheme === 'dark' || activeTheme === 'light') ? activeTheme : 'dark';
    if (validTheme !== activeTheme) {
      setActiveTheme(validTheme);
    }
    document.body.setAttribute('data-theme', validTheme);
    localStorage.setItem('v3_ui_theme', validTheme);
  }, [activeTheme]);

  const currentThemeObj = THEMES[activeTheme as keyof typeof THEMES] || THEMES.dark;

  return {
    activeTheme,
    setActiveTheme,
    isDefaultTheme: true,
    currentThemeObj
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { saveToLocalStorage } from '../lib/utils';
import { DEFAULT_SETTINGS, AppSettings } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('v3_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to load settings in App:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveToLocalStorage('v3_settings', newSettings);
  };

  return {
    settings,
    handleSettingsChange
  };
}

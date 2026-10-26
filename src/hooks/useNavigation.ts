/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';

const normalizePanelName = (name: string): string => {
  if (name === 'idea') return 'ideas';
  if (name === 'task' || name === 'tasks' || name === 'shopping' || name === 'week' || name === 'habit' || name === 'habits') return 'routine';
  if (name === 'appearance') return 'settings';
  return name;
};

export type RoutineSubView = 'overview' | 'week' | 'tasks' | 'shopping' | 'habits';
export type SettingsSubTab = 'general' | 'ai' | 'appearance' | 'backup' | 'notifications' | 'system';

export function useNavigation() {
  const [activePanel, setActivePanelState] = useState<string>('home');
  const [prevPanel, setPrevPanel] = useState<string>('home');
  const [panelNavCount, setPanelNavCount] = useState<number>(0);
  const [routineSubView, setRoutineSubView] = useState<RoutineSubView>('overview');
  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('general');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => 
    localStorage.getItem('v3_sidebar_collapsed') === 'true'
  );

  const handlePanelSwitch = (rawPanelName: string) => {
    setPanelNavCount(c => c + 1);
    // "settings:<tab>" opens the settings panel directly on that tab (used by global search)
    const validSettingsTabs: SettingsSubTab[] = ['general', 'ai', 'appearance', 'backup', 'notifications', 'system'];
    let panelName = rawPanelName;
    let requestedSettingsTab: SettingsSubTab | null = null;
    if (rawPanelName.startsWith('settings:')) {
      const tab = rawPanelName.slice('settings:'.length) as SettingsSubTab;
      requestedSettingsTab = validSettingsTabs.includes(tab) ? tab : 'general';
      panelName = 'settings';
    }
    const target = normalizePanelName(panelName);
    if (target === 'routine') {
      const validSubViews: RoutineSubView[] = ['week', 'tasks', 'shopping', 'habits'];
      setRoutineSubView(validSubViews.includes(panelName as RoutineSubView) ? (panelName as RoutineSubView) : 'overview');
    }
    if (panelName === 'appearance') {
      setSettingsTab('appearance');
    } else if (panelName === 'settings') {
      setSettingsTab(requestedSettingsTab ?? 'general');
    }
    setPrevPanel(activePanel);
    setActivePanelState(target);
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('v3_sidebar_collapsed', String(next));
      return next;
    });
  };

  return {
    activePanel,
    prevPanel,
    panelNavCount,
    routineSubView,
    settingsTab,
    setSettingsTab,
    handlePanelSwitch,
    isSidebarCollapsed,
    toggleSidebarCollapse
  };
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy } from 'react';

// Dynamic import factories for each panel
export const panelLoaders = {
  ai: () => import('../components/AiPanel'),
  note: () => import('../components/NotePanel'),
  ideas: () => import('../components/IdeasPanel'),
  edit_assets: () => import('../components/EditAssetsPanel'),
  routine: () => import('../components/RoutinePanel'),
  finance: () => import('../components/FinancePanel'),
  downloads: () => import('../components/DownloadManagerPanel'),
  dns: () => import('../components/DnsChangerPanel'),
  settings: () => import('../components/SettingsPanel'),
  appearance: () => import('../components/SettingsPanel')
};

export type PanelKey = keyof typeof panelLoaders;

// Track preloaded panel keys to prevent duplicate downloads
const preloadedPanels = new Set<string>();

/**
 * Preload a specific panel module on-demand (e.g. on mouse hover or touch)
 */
export function preloadPanel(panelName: string) {
  if (!panelName || panelName === 'home') return;
  if (preloadedPanels.has(panelName)) return;

  const loader = panelLoaders[panelName as PanelKey];
  if (loader) {
    preloadedPanels.add(panelName);
    loader().catch((err) => {
      console.warn(`[Preload] Failed to preload panel "${panelName}":`, err);
      // Remove from set so user action can retry loading later
      preloadedPanels.delete(panelName);
    });
  }
}

/**
 * Preloads all panels in background during browser idle time,
 * sequenced smoothly without blocking initial UI paint or interaction.
 */
export function preloadAllPanelsIdle(delayMs: number = 1500): () => void {
  const panelKeys: PanelKey[] = [
    'routine',
    'note',
    'finance',
    'ai',
    'ideas',
    'edit_assets',
    'downloads',
    'dns',
    'settings'
  ];

  let isCancelled = false;
  let idleCallbackId: number | null = null;
  let timeoutId: any = null;

  const startPreloadSequence = () => {
    if (isCancelled) return;
    let index = 0;

    const loadNext = () => {
      if (isCancelled || index >= panelKeys.length) return;
      const key = panelKeys[index++];
      preloadPanel(key);

      if (index < panelKeys.length) {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          idleCallbackId = (window as any).requestIdleCallback(loadNext, { timeout: 1500 });
        } else {
          timeoutId = setTimeout(loadNext, 250);
        }
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleCallbackId = (window as any).requestIdleCallback(loadNext, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(loadNext, 300);
    }
  };

  timeoutId = setTimeout(startPreloadSequence, delayMs);

  return () => {
    isCancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
    if (idleCallbackId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      (window as any).cancelIdleCallback(idleCallbackId);
    }
  };
}

// React Lazy components
export const AiPanel = lazy(panelLoaders.ai);
export const NotePanel = lazy(panelLoaders.note);
export const IdeasPanel = lazy(panelLoaders.ideas);
export const EditAssetsPanel = lazy(panelLoaders.edit_assets);
export const RoutinePanel = lazy(panelLoaders.routine);
export const FinancePanel = lazy(panelLoaders.finance);
export const DownloadManagerPanel = lazy(panelLoaders.downloads);
export const DnsChangerPanel = lazy(panelLoaders.dns);
export const SettingsPanel = lazy(panelLoaders.settings);

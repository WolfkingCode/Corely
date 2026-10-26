/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus,
  Settings as SettingsIcon, 
  User, 
  ShieldCheck, 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Trash2, 
  Bell, 
  Volume2, 
  VolumeX, 
  Globe, 
  Eye, 
  EyeOff, 
  HardDrive, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  Paintbrush, 
  Target, 
  Image as ImageIcon, 
  Loader2, 
  Move, 
  Maximize2, 
  RotateCcw, 
  RotateCw,
  Timer,
  Moon
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import AppearancePanel from './AppearancePanel';
import HomePanel from './HomePanel';
import TimePicker from './TimePicker';
import Select from './Select';
import { AppSettings, DEFAULT_SETTINGS, GoalImageItem, GoalImageTransform, DEFAULT_GOAL_IMAGE_TRANSFORM } from '../types';
import { 
  dbGetGoalImages, 
  dbAddGoalImage, 
  dbUpdateGoalImagePosition, 
  dbUpdateGoalImageEnabled, 
  dbDeleteGoalImage, 
  blobToDataUrl,
  dbExportAll,
  dbImportAll,
  dbClearAll,
  closeBgDB
} from '../lib/utils';
import { ensureNotificationPermission, isDesktopApp } from '../lib/notifications';

export { DEFAULT_SETTINGS };
export type { AppSettings };

// Relaxed clamp for goal image transform: allows bleed edge effects (half out, half in)
// while preventing completely off-screen states (-10% to 110%)
function clampGoalTransform(transform: GoalImageTransform): GoalImageTransform {
  const size = Math.max(5, Math.min(60, transform.sizePercent || DEFAULT_GOAL_IMAGE_TRANSFORM.sizePercent));
  const deg = transform.rotationDeg || 0;
  
  const rawX = typeof transform.xPercent === 'number' ? transform.xPercent : DEFAULT_GOAL_IMAGE_TRANSFORM.xPercent;
  const rawY = typeof transform.yPercent === 'number' ? transform.yPercent : DEFAULT_GOAL_IMAGE_TRANSFORM.yPercent;
  
  // Relaxed boundary: allow center of image between -5% and 105% so parts can hang off-screen
  const clampedX = Math.max(-5, Math.min(105, rawX));
  const clampedY = Math.max(-5, Math.min(105, rawY));
  
  return {
    xPercent: Math.round(clampedX * 10) / 10,
    yPercent: Math.round(clampedY * 10) / 10,
    sizePercent: Math.round(size * 10) / 10,
    rotationDeg: deg
  };
}

interface SettingsPanelProps {
  key?: string;
  settings?: AppSettings;
  onSettingsChange?: (newSettings: AppSettings) => void;
  initialTab?: 'general' | 'ai' | 'appearance' | 'backup' | 'notifications' | 'system';
  activeTheme?: string;
  onThemeChange?: (themeId: string) => void;
}

function formatBytesForStats(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface NotificationRowProps {
  icon?: React.ReactNode;
  iconBg?: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  isEn?: boolean;
  extraContent?: React.ReactNode;
}

function NotificationRow({
  icon,
  iconBg = 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/20',
  title,
  description,
  enabled,
  onToggle,
  isEn = false,
  extraContent
}: NotificationRowProps) {
  return (
    <div className="p-3.5 rounded-2xl transition-colors hover:bg-[var(--sidebar-hover)] border-b border-[var(--border)] last:border-b-0 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-gradient-to-br shadow-xs ${iconBg}`}>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[var(--text)]">{title}</div>
            <div className="text-[11px] text-[var(--text3)] leading-relaxed mt-0.5">{description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            aria-label={title}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
              enabled ? 'bg-purple-600' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                enabled 
                  ? (isEn ? 'translate-x-[20px]' : 'translate-x-[-20px]') 
                  : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
      {extraContent}
    </div>
  );
}

const QUIET_PRESETS = [
  { id: 'night', start: '23:00', end: '07:00', labelFa: 'شب: ۲۳:۰۰ تا ۰۷:۰۰', labelEn: 'Night: 23:00 - 07:00' },
  { id: 'late', start: '22:00', end: '06:00', labelFa: '۲۲:۰۰ تا ۰۶:۰۰', labelEn: '22:00 - 06:00' },
  { id: 'mid', start: '00:00', end: '08:00', labelFa: '۰۰:۰۰ تا ۰۸:۰۰', labelEn: '00:00 - 08:00' }
];

function getQuietBarSegments(startStr: string, endStr: string): Array<{ left: number; width: number }> {
  const parseMin = (str: string) => {
    if (!str) return 0;
    const parts = str.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return Math.max(0, Math.min(1440, h * 60 + m));
  };
  const start = parseMin(startStr);
  const end = parseMin(endStr);

  if (start === end) return [];

  if (start < end) {
    return [{ left: (start / 1440) * 100, width: ((end - start) / 1440) * 100 }];
  }

  // Crosses midnight
  return [
    { left: (start / 1440) * 100, width: ((1440 - start) / 1440) * 100 },
    { left: 0, width: (end / 1440) * 100 }
  ];
}

export default function SettingsPanel({ 
  settings: currentSettings, 
  onSettingsChange,
  initialTab = 'general',
  activeTheme = 'dark',
  onThemeChange
}: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (currentSettings) return currentSettings;
    try {
      const saved = localStorage.getItem('v3_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error loading settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'appearance' | 'backup' | 'notifications' | 'system'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const isEn = settings.language === 'en';
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [showOpenAiApiKey, setShowOpenAiApiKey] = useState<boolean>(false);
  const [openaiModels, setOpenaiModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string>('');

  // Modals state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  // Import JSON backup file input ref
  const importInputRef = useRef<HTMLInputElement>(null);

  // Goal Images state, active selection, and file input ref
  const [goalImages, setGoalImages] = useState<GoalImageItem[]>([]);
  const [selectedGoalImageId, setSelectedGoalImageId] = useState<string | null>(null);
  const [removeBgEnabled, setRemoveBgEnabled] = useState<boolean>(true);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  // OpenAI models auto-loading and selection
  const loadOpenAiModels = useCallback(async () => {
    const openaiBaseUrl = settings.openaiBaseUrl ? settings.openaiBaseUrl.trim() : '';
    const openaiApiKey = settings.openaiApiKey ? settings.openaiApiKey.trim() : '';
    if (!openaiBaseUrl || !openaiApiKey) {
      return;
    }
    setIsLoadingModels(true);
    try {
      if ((window as any).corelyDesktop?.ai?.listModels) {
        const result = await (window as any).corelyDesktop.ai.listModels({
          openaiBaseUrl,
          openaiApiKey,
          aiProxyUrl: settings.aiProxyEnabled === true ? (settings.aiProxyUrl || '') : ''
        });
        if (result && Array.isArray(result.models)) {
          setOpenaiModels(result.models);
          setModelsError('');
        } else {
          setOpenaiModels([]);
          setModelsError(isEn ? 'Failed to load models' : 'دریافت لیست مدل‌ها ناموفق بود');
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err || '');
      setModelsError((errMsg || (isEn ? 'Failed to load models' : 'خطا در دریافت مدل‌ها')).slice(0, 100));
      setOpenaiModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [settings.openaiBaseUrl, settings.openaiApiKey, settings.aiProxyEnabled, settings.aiProxyUrl, isEn]);

  useEffect(() => {
    if (settings.aiProvider === 'openai') {
      const baseUrl = settings.openaiBaseUrl ? settings.openaiBaseUrl.trim() : '';
      const apiKey = settings.openaiApiKey ? settings.openaiApiKey.trim() : '';
      if (baseUrl && apiKey) {
        const timer = setTimeout(() => {
          loadOpenAiModels();
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [settings.aiProvider, settings.openaiBaseUrl, settings.openaiApiKey, loadOpenAiModels]);

  const modelOptions = useMemo(() => {
    if (openaiModels.length === 0) return [];
    const opts = openaiModels.map((id) => ({ value: id, label: id }));
    const currentModel = (settings.openaiModel || '').trim();
    if (currentModel && !opts.some((o) => o.value === currentModel)) {
      return [{ value: currentModel, label: currentModel }, ...opts];
    }
    return opts;
  }, [openaiModels, settings.openaiModel]);
  const [, setBgStatusText] = useState('');
  const goalImageInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const activeImageElementRef = useRef<HTMLDivElement>(null);
  const transformBadgeRef = useRef<HTMLSpanElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(0.55);
  const [virtualHomeWidth, setVirtualHomeWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 960;
    const contentEl = document.querySelector('.content');
    if (contentEl && contentEl.clientWidth > 300) {
      const isMd = window.innerWidth >= 768;
      const padding = isMd ? 48 : 32;
      return Math.max(360, contentEl.clientWidth - padding);
    }
    const isCollapsed = typeof document !== 'undefined' && document.querySelector('.app')?.classList.contains('md:grid-cols-[56px_1fr]');
    const sidebarWidth = window.innerWidth >= 768 ? (isCollapsed ? 56 : 256) : 0;
    const padding = window.innerWidth >= 768 ? 48 : 32;
    return Math.max(360, window.innerWidth - sidebarWidth - padding);
  });

  const activeGoalImage = goalImages.find(img => img.id === selectedGoalImageId) || (goalImages.length > 0 ? goalImages[0] : null);
  const activeTransform = activeGoalImage?.transform || DEFAULT_GOAL_IMAGE_TRANSFORM;

  // Drag / Resize / Rotate interaction tracking refs
  const interactionModeRef = useRef<'drag' | 'resize' | 'rotate' | null>(null);
  const currentTransformRef = useRef<GoalImageTransform>(DEFAULT_GOAL_IMAGE_TRANSFORM);
  const containerRectRef = useRef<{ left: number; top: number; width: number; height: number }>({ left: 0, top: 0, width: 0, height: 0 });
  const rotateCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ 
    startX: number; 
    startY: number; 
    initXPercent: number; 
    initYPercent: number; 
    initSizePercent: number;
    initRotationDeg: number;
  }>({
    startX: 0,
    startY: 0,
    initXPercent: 18,
    initYPercent: 12,
    initSizePercent: 16,
    initRotationDeg: 0
  });

  // Measure and update HomePanel preview scale accurately based on live HomePanel width
  const measureAndUpdateScale = () => {
    if (previewContainerRef.current) {
      const containerWidth = previewContainerRef.current.clientWidth || previewContainerRef.current.getBoundingClientRect().width;
      if (containerWidth > 0) {
        // Measure real live HomePanel width from workspace DOM
        let actualHomeWidth = 960;
        const contentEl = document.querySelector('.content');
        if (contentEl && contentEl.clientWidth > 300) {
          const isMd = window.innerWidth >= 768;
          const padding = isMd ? 48 : 32;
          actualHomeWidth = Math.max(360, contentEl.clientWidth - padding);
        } else {
          const isCollapsed = document.querySelector('.app')?.classList.contains('md:grid-cols-[56px_1fr]');
          const sidebarWidth = window.innerWidth >= 768 ? (isCollapsed ? 56 : 256) : 0;
          const padding = window.innerWidth >= 768 ? 48 : 32;
          actualHomeWidth = Math.max(360, window.innerWidth - sidebarWidth - padding);
        }

        setVirtualHomeWidth(actualHomeWidth);
        const scale = containerWidth / actualHomeWidth;
        console.log('[HomePreviewScale] containerWidth:', containerWidth, 'px, actualHomeWidth:', actualHomeWidth, 'px => scale:', scale);
        setPreviewScale(scale);
      }
    }
  };

  // ResizeObserver and Window resize listener to adapt HomePanel miniature preview scale smoothly
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width || (entry.target as HTMLElement).clientWidth;
        if (width > 0) {
          let actualHomeWidth = 960;
          const contentEl = document.querySelector('.content');
          if (contentEl && contentEl.clientWidth > 300) {
            const isMd = window.innerWidth >= 768;
            const padding = isMd ? 48 : 32;
            actualHomeWidth = Math.max(360, contentEl.clientWidth - padding);
          } else {
            const isCollapsed = document.querySelector('.app')?.classList.contains('md:grid-cols-[56px_1fr]');
            const sidebarWidth = window.innerWidth >= 768 ? (isCollapsed ? 56 : 256) : 0;
            const padding = window.innerWidth >= 768 ? 48 : 32;
            actualHomeWidth = Math.max(360, window.innerWidth - sidebarWidth - padding);
          }

          setVirtualHomeWidth(actualHomeWidth);
          const scale = width / actualHomeWidth;
          console.log('[HomePreviewScale ResizeObserver] containerWidth:', width, 'px, actualHomeWidth:', actualHomeWidth, 'px => scale:', scale);
          setPreviewScale(scale);
        }
      }
    });

    observer.observe(el);
    window.addEventListener('resize', measureAndUpdateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureAndUpdateScale);
    };
  }, [activeGoalImage?.id, isRemovingBg]);

  // Dedicated layout stabilization effect on mount, tab switch, or goal image activation
  useEffect(() => {
    if (activeTab === 'appearance') {
      measureAndUpdateScale();

      // Double requestAnimationFrame ensures browser layout & paint passes have run
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          measureAndUpdateScale();
        });
      });

      // Scheduled timeouts to catch end of tab slide/fade transitions (150ms & 300ms)
      const t1 = setTimeout(measureAndUpdateScale, 150);
      const t2 = setTimeout(measureAndUpdateScale, 300);

      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [activeTab, activeGoalImage?.id, isRemovingBg]);

  // Keep currentTransformRef in sync with activeTransform when not actively dragging
  useEffect(() => {
    if (!interactionModeRef.current) {
      currentTransformRef.current = { ...activeTransform };
      if (activeImageElementRef.current) {
        activeImageElementRef.current.style.left = `${activeTransform.xPercent}%`;
        activeImageElementRef.current.style.top = `${activeTransform.yPercent}%`;
        activeImageElementRef.current.style.width = `${activeTransform.sizePercent}%`;
        activeImageElementRef.current.style.transform = `translate(-50%, -50%) rotate(${activeTransform.rotationDeg || 0}deg)`;
      }
    }
  }, [activeTransform, selectedGoalImageId]);

  // Load Goal Images from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const loadImages = () => {
      dbGetGoalImages().then((imgs) => {
        if (isMounted) {
          setGoalImages(imgs || []);
          if (imgs && imgs.length > 0) {
            setSelectedGoalImageId((prev) => (prev && imgs.some(i => i.id === prev) ? prev : imgs[0].id));
          } else {
            setSelectedGoalImageId(null);
          }
        }
      });
    };

    loadImages();

    const handleUpdate = () => {
      loadImages();
    };

    window.addEventListener('goal-images-updated', handleUpdate);
    window.addEventListener('goal-image-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('goal-images-updated', handleUpdate);
      window.removeEventListener('goal-image-updated', handleUpdate);
    };
  }, []);

  // Storage Stats
  const [itemCounts, setItemCounts] = useState({
    notesLength: 0,
    ideasCount: 0,
    tasksCount: 0,
    shoppingCount: 0,
    financeCount: 0,
    editAssetsCount: 0,
    downloadedLast30Days: '0 B'
  });

  // Save settings on update
  useEffect(() => {
    try {
      localStorage.setItem('v3_settings', JSON.stringify(settings));
      if (onSettingsChange) onSettingsChange(settings);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings, onSettingsChange]);

  // Compute storage and item stats
  useEffect(() => {
    try {
      // Counts
      const notes = localStorage.getItem('v3_note') || '';
      const ideas = JSON.parse(localStorage.getItem('v3_ideas') || '[]');
      const todos = JSON.parse(localStorage.getItem('v3_todos') || '[]');
      const shopping = JSON.parse(localStorage.getItem('v3_shopping') || '[]');
      const finance = JSON.parse(localStorage.getItem('v3_finance') || '[]');
      const editAssets = JSON.parse(localStorage.getItem('v3_edit_assets') || '[]');

      const downloadsRaw = JSON.parse(localStorage.getItem('v3_downloads') || '[]');
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const bytesLast30Days = Array.isArray(downloadsRaw)
        ? downloadsRaw
            .filter((d: any) => d.status === 'completed' && d.completedAt && new Date(d.completedAt).getTime() >= thirtyDaysAgo)
            .reduce((sum: number, d: any) => sum + (d.totalSize || 0), 0)
        : 0;

      setItemCounts({
        notesLength: notes.trim().length,
        ideasCount: Array.isArray(ideas) ? ideas.length : 0,
        tasksCount: Array.isArray(todos) ? todos.length : 0,
        shoppingCount: Array.isArray(shopping) ? shopping.length : 0,
        financeCount: Array.isArray(finance) ? finance.length : 0,
        editAssetsCount: Array.isArray(editAssets) ? editAssets.length : 0,
        downloadedLast30Days: formatBytesForStats(bytesLast30Days)
      });
    } catch (e) {
      console.error('Error calculating stats:', e);
    }
  }, [activeTab]);

  const showToast = (msg: string, duration = 3000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    showToast(isEn ? 'Settings updated' : 'تنظیمات به‌روزرسانی شد');
  };

  // Sound effect handler test
  const playTestSound = () => {
    if (!settings.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.log('Audio test failed:', e);
    }
  };

  // Backup: Export All Data to JSON File
  const handleExportAllJSON = async () => {
    try {
      // Exclude geminiApiKey, openaiApiKey, aiProxyUrl, and aiProxyEnabled from exported backup for security
      const { geminiApiKey: _omitKey, openaiApiKey: _omitOpenAiKey, aiProxyUrl: _omitProxy, aiProxyEnabled: _omitProxyEnabled, ...safeSettings } = settings;
      const backupData: Record<string, unknown> = {
        _exportDate: new Date().toISOString(),
        _appVersion: '1.0.0',
        settings: safeSettings
      };

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('v3_')) {
          const raw = localStorage.getItem(key);
          try {
            const parsedVal = raw ? JSON.parse(raw) : null;
            if (key === 'v3_settings' && parsedVal && typeof parsedVal === 'object') {
              const { geminiApiKey: _omit, openaiApiKey: _omitOpenAi, aiProxyUrl: _omitProxy, aiProxyEnabled: _omitProxyEnabled, ...rest } = parsedVal as Record<string, unknown>;
              backupData[key] = rest;
            } else {
              backupData[key] = parsedVal;
            }
          } catch {
            backupData[key] = raw;
          }
        }
      }

      let idbExport: Awaited<ReturnType<typeof dbExportAll>> | undefined;
      try {
        idbExport = await dbExportAll();
        backupData._indexedDB = idbExport;
      } catch (err: unknown) {
        console.error('Failed to export IndexedDB data:', err);
      }

      const jsonString = JSON.stringify(backupData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `Corely_Backup_${dateStr}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      if (idbExport?.skippedMedia && idbExport.skippedMedia.count > 0) {
        const count = idbExport.skippedMedia.count;
        const mb = (idbExport.skippedMedia.bytes / (1024 * 1024)).toFixed(1);
        const extraMsg = isEn
          ? ` ${count} large files (${mb} MB) were not included. Linked files are never included in backups; only their list and previews are saved.`
          : ` ${count} فایل بزرگ (${mb} مگابایت) در بکاپ نیامد. فایل‌های پیوندی هیچ‌وقت در بکاپ نیستند و فقط فهرست و پیش‌نمایش‌هایشان ذخیره می‌شود.`;
        showToast((isEn ? 'Full backup file downloaded successfully.' : 'فایل پشتیبان کامل با موفقیت دانلود شد.') + extraMsg, 6000);
      } else {
        showToast(isEn ? 'Full backup file downloaded successfully' : 'فایل پشتیبان کامل با موفقیت دانلود شد');
      }
    } catch (e: unknown) {
      console.error('Backup export failed:', e);
      alert(isEn ? 'Error creating backup file' : 'خطا در ایجاد فایل پشتیبان');
    }
  };

  // Backup: Import Data from JSON
  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        if (typeof parsed !== 'object' || !parsed) {
          throw new Error(isEn ? 'Invalid backup file format' : 'فرمت فایل پشتیبان نامعتبر است');
        }

        // Preserve current device's geminiApiKey, openaiApiKey, aiProxyUrl, and aiProxyEnabled so importing a backup doesn't clear them
        const currentGeminiApiKey = settings.geminiApiKey || '';
        const currentOpenAiApiKey = settings.openaiApiKey || '';
        const currentAiProxyUrl = settings.aiProxyUrl || '';
        const currentAiProxyEnabled = settings.aiProxyEnabled ?? false;

        // Restore keys starting with v3_
        Object.keys(parsed).forEach(key => {
          if (key.startsWith('v3_')) {
            const val = parsed[key];
            if (key === 'v3_settings' && val && typeof val === 'object') {
              const merged = { 
                ...(val as Record<string, unknown>), 
                geminiApiKey: currentGeminiApiKey,
                openaiApiKey: currentOpenAiApiKey,
                aiProxyUrl: currentAiProxyUrl,
                aiProxyEnabled: currentAiProxyEnabled
              };
              localStorage.setItem(key, JSON.stringify(merged));
            } else if (typeof val === 'object') {
              localStorage.setItem(key, JSON.stringify(val));
            } else if (typeof val === 'string') {
              localStorage.setItem(key, val);
            }
          }
        });

        if (parsed.settings && typeof parsed.settings === 'object') {
          const restoredSettings: AppSettings = {
            ...DEFAULT_SETTINGS,
            ...(parsed.settings as Partial<AppSettings>),
            geminiApiKey: currentGeminiApiKey,
            openaiApiKey: currentOpenAiApiKey,
            aiProxyUrl: currentAiProxyUrl,
            aiProxyEnabled: currentAiProxyEnabled
          };
          setSettings(restoredSettings);
          localStorage.setItem('v3_settings', JSON.stringify(restoredSettings));
        } else {
          // If parsed.settings wasn't present, ensure v3_settings in localStorage retains geminiApiKey, openaiApiKey, aiProxyUrl, and aiProxyEnabled
          const rawSettings = localStorage.getItem('v3_settings');
          if (rawSettings) {
            try {
              const s = JSON.parse(rawSettings) as Record<string, unknown>;
              s.geminiApiKey = currentGeminiApiKey;
              s.openaiApiKey = currentOpenAiApiKey;
              s.aiProxyUrl = currentAiProxyUrl;
              s.aiProxyEnabled = currentAiProxyEnabled;
              localStorage.setItem('v3_settings', JSON.stringify(s));
            } catch {
              // ignore
            }
          }
        }

        if (parsed._indexedDB && typeof parsed._indexedDB === 'object') {
          try {
            await dbImportAll(parsed._indexedDB);
          } catch (dbErr: unknown) {
            console.error('Failed to restore IndexedDB data:', dbErr);
            alert(isEn ? 'Text data restored, but failed to restore images.' : 'متن‌ها بازیابی شد ولی بازیابی عکس‌ها ناموفق بود');
          }
        }

        // Check if any restored edit asset is linked (has libraryId)
        let hasLinkedAssets = false;
        if (Array.isArray(parsed.v3_edit_assets)) {
          hasLinkedAssets = parsed.v3_edit_assets.some((a: any) => a && a.libraryId);
        } else if (typeof parsed.v3_edit_assets === 'string') {
          try {
            const arr = JSON.parse(parsed.v3_edit_assets);
            if (Array.isArray(arr)) hasLinkedAssets = arr.some((a: any) => a && a.libraryId);
          } catch {}
        }
        if (!hasLinkedAssets && parsed._indexedDB?.assets && Array.isArray(parsed._indexedDB.assets)) {
          const rec = parsed._indexedDB.assets.find((r: any) => r && r.key === 'v3_edit_assets');
          if (rec && Array.isArray(rec.value)) {
            hasLinkedAssets = rec.value.some((a: any) => a && a.libraryId);
          }
        }

        const baseMsg = isEn ? 'Data restored successfully! Refreshing page...' : 'اطلاعات با موفقیت بازیابی شد! صفحه تازه می‌شود...';
        const relinkExtra = hasLinkedAssets
          ? (isEn ? ' If files were moved, use the "Relink" bar in edit assets.' : ' اگر فایل‌ها جابه‌جا شده‌اند از نوار «پیوند دوباره» در منابع ادیت استفاده کنید.')
          : '';
        showToast(baseMsg + relinkExtra, hasLinkedAssets ? 4000 : 3000);
        setTimeout(() => {
          window.location.reload();
        }, hasLinkedAssets ? 2400 : 1200);
      } catch (err: unknown) {
        console.error('Failed to import backup:', err);
        alert(isEn ? 'The selected backup file is invalid.' : 'فایل پشتیبان انتخاب‌شده معتبر نیست.');
      }
    };
    reader.readAsText(file);
  };

  // CSV Export Helper
  const downloadCSV = (filename: string, rows: string[][]) => {
    const processRow = (row: string[]) => 
      row.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(',');

    const csvContent = '\uFEFF' + rows.map(processRow).join('\n'); // BOM for Persian UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Export Tasks CSV
  const handleExportTasksCSV = () => {
    const todos = JSON.parse(localStorage.getItem('v3_todos') || '[]');
    const shopping = JSON.parse(localStorage.getItem('v3_shopping') || '[]');

    const rows: string[][] = [
      isEn ? ['Type', 'Task Title', 'Status'] : ['نوع', 'عنوان کار', 'وضعیت']
    ];

    todos.forEach((t: { text: string; done: boolean }) => {
      rows.push([isEn ? 'Daily Task' : 'کار روزانه', t.text, t.done ? (isEn ? 'Completed' : 'انجام‌شده') : (isEn ? 'Pending' : 'در انتظار')]);
    });
    shopping.forEach((s: { text: string; done: boolean }) => {
      rows.push([isEn ? 'Shopping' : 'خرید', s.text, s.done ? (isEn ? 'Purchased' : 'خریداری‌شده') : (isEn ? 'Pending' : 'در انتظار')]);
    });

    downloadCSV('Tasks_Shopping_List.csv', rows);
    showToast(isEn ? 'Tasks Excel exported successfully' : 'خروجی اکسل کارها دانلود شد');
  };

  // Export Finance CSV
  const handleExportFinanceCSV = () => {
    const finance = JSON.parse(localStorage.getItem('v3_finance') || '[]');
    const rows: string[][] = [
      isEn ? ['ID', 'Type', 'Title', 'Amount (Toman)', 'Date'] : ['شناسه', 'نوع', 'عنوان', 'مبلغ (تومان)', 'تاریخ']
    ];

    finance.forEach((f: { id: number; type: string; title: string; amount: number; date: string }) => {
      rows.push([
        String(f.id),
        f.type === 'income' ? (isEn ? 'Income' : 'درآمد') : (isEn ? 'Expense' : 'هزینه'),
        f.title,
        String(f.amount),
        f.date
      ]);
    });

    downloadCSV('Financial_Transactions.csv', rows);
    showToast(isEn ? 'Financial transactions Excel exported successfully' : 'خروجی اکسل تراکنش‌های مالی دانلود شد');
  };

  // Desktop only: launch Corely when Windows starts (opt-in)
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  useEffect(() => {
    if (!isDesktopApp()) return;
    window.corelyDesktop?.getAutoStart?.()
      .then((val) => setAutoStartEnabled(val === true))
      .catch(() => {});
  }, []);
  const handleToggleAutoStart = async () => {
    const next = !autoStartEnabled;
    try {
      const actual = await window.corelyDesktop?.setAutoStart?.(next);
      setAutoStartEnabled(actual === true);
    } catch {
      // keep previous state
    }
  };

  // Full Reset App Data
  const handleFullReset = async () => {
    if (resetConfirmInput !== 'RESET') return;
    localStorage.clear();
    try {
      await (window as any).corelyDesktop?.library?.clearAll?.();
    } catch (e) {
      console.warn('Failed to clear desktop library registry:', e);
    }
    try {
      const imgs = await dbGetGoalImages();
      await Promise.all(imgs.map(i => dbDeleteGoalImage(i.id)));
    } catch (e) {}
    // Empty all stores first, so data is gone even if deleting the database gets blocked.
    const cleared = await dbClearAll();
    await closeBgDB();
    const deleted = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      try {
        const req = indexedDB.deleteDatabase('myAppBgDB');
        req.onsuccess = () => finish(true);
        req.onerror = () => finish(false);
        // onblocked: keep waiting for onsuccess, but never hang forever.
        setTimeout(() => finish(false), 4000);
      } catch {
        finish(false);
      }
    });
    if (!cleared && !deleted) {
      showToast(isEn ? 'Some stored images could not be removed. Please restart the app and try again.' : 'بخشی از تصاویر ذخیرهشده پاک نشد. لطفاً اپ را دوباره باز کنید و مجدداً تلاش کنید.');
      return;
    }
    showToast(isEn ? 'All data cleared. Refreshing...' : 'تمام داده‌ها پاکسازی شدند. در حال بروزرسانی...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // Goal Images Handlers
  const handleGoalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Direct save without background removal if disabled
    if (!removeBgEnabled) {
      try {
        const dataUrl = await blobToDataUrl(file);
        const newId = 'goal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const newTransform = clampGoalTransform({
          xPercent: 18 + ((goalImages.length * 14) % 60),
          yPercent: 12 + ((goalImages.length * 10) % 60),
          sizePercent: 16,
          rotationDeg: 0
        });
        const newItem: GoalImageItem = {
          id: newId,
          dataUrl,
          transform: newTransform,
          createdAt: Date.now()
        };
        await dbAddGoalImage(newItem);
        const updated = await dbGetGoalImages();
        setGoalImages(updated);
        setSelectedGoalImageId(newId);
        showToast(isEn ? 'Original goal image added without changes!' : 'عکس اصلی هدف بدون تغییر پس‌زمینه افزوده شد');
      } catch (err) {
        console.error('Failed to read original image:', err);
        showToast(isEn ? 'Failed to read image file' : 'خطا در بارگذاری فایل تصویر');
      } finally {
        e.target.value = '';
      }
      return;
    }

    // 2. Intelligent background removal with AI
    setIsRemovingBg(true);
    setBgStatusText(isEn ? 'AI is removing background...' : 'در حال حذف هوشمند پس‌زمینه تصویر...');

    try {
      // Automatic client-side background removal using @imgly/background-removal
      const processedBlob = await removeBackground(file);
      const dataUrl = await blobToDataUrl(processedBlob);
      const newId = 'goal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const newTransform = clampGoalTransform({
        xPercent: 18 + ((goalImages.length * 14) % 60),
        yPercent: 12 + ((goalImages.length * 10) % 60),
        sizePercent: 16,
        rotationDeg: 0
      });
      const newItem: GoalImageItem = {
        id: newId,
        dataUrl,
        transform: newTransform,
        createdAt: Date.now()
      };
      await dbAddGoalImage(newItem);
      const updated = await dbGetGoalImages();
      setGoalImages(updated);
      setSelectedGoalImageId(newId);
      showToast(isEn ? 'New goal image added with background removed!' : 'عکس هدف جدید با پس‌زمینه شفاف افزوده شد');
    } catch (err) {
      console.warn('Background removal failed, falling back to original image:', err);
      showToast(
        isEn
          ? 'Automatic background removal failed; saving original image...'
          : 'حذف خودکار پس‌زمینه با خطا مواجه شد؛ تصویر اصلی ذخیره شد'
      );
      try {
        const originalDataUrl = await blobToDataUrl(file);
        if (originalDataUrl) {
          const newId = 'goal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const newItem: GoalImageItem = {
            id: newId,
            dataUrl: originalDataUrl,
            transform: clampGoalTransform({
              xPercent: 18 + ((goalImages.length * 14) % 60),
              yPercent: 12 + ((goalImages.length * 10) % 60),
              sizePercent: 16,
              rotationDeg: 0
            }),
            createdAt: Date.now()
          };
          await dbAddGoalImage(newItem);
          const updated = await dbGetGoalImages();
          setGoalImages(updated);
          setSelectedGoalImageId(newId);
        }
      } catch (readErr) {
        console.error('Failed to read file:', readErr);
      }
    } finally {
      setIsRemovingBg(false);
      setBgStatusText('');
      e.target.value = '';
    }
  };

  const handleDeleteGoalImage = async (idToDelete: string) => {
    await dbDeleteGoalImage(idToDelete);
    const updated = goalImages.filter(img => img.id !== idToDelete);
    setGoalImages(updated);
    if (selectedGoalImageId === idToDelete) {
      setSelectedGoalImageId(updated[0]?.id || null);
    }
    showToast(isEn ? 'Goal image deleted' : 'عکس هدف حذف شد');
  };

  const handleToggleGoalImageEnabled = (id: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    const updated = goalImages.map(img => img.id === id ? { ...img, enabled: nextEnabled } : img);
    setGoalImages(updated);
    dbUpdateGoalImageEnabled(id, nextEnabled);
  };

  const updateActiveGoalTransform = (newTransform: GoalImageTransform) => {
    if (!activeGoalImage) return;
    const clamped = clampGoalTransform(newTransform);
    currentTransformRef.current = clamped;
    const updatedList = goalImages.map(img => img.id === activeGoalImage.id ? { ...img, transform: clamped } : img);
    setGoalImages(updatedList);
    dbUpdateGoalImagePosition(activeGoalImage.id, clamped);
  };

  const handleResetPosition = () => {
    if (!activeGoalImage) return;
    updateActiveGoalTransform(DEFAULT_GOAL_IMAGE_TRANSFORM);
    showToast(isEn ? 'Position reset to default' : 'موقعیت عکس به حالت پیش‌فرض بازنشانی شد');
  };

  // Helper to update DOM element directly during gestures without triggering React re-renders
  const applyTransformToDOM = (transform: GoalImageTransform) => {
    if (activeImageElementRef.current) {
      activeImageElementRef.current.style.left = `${transform.xPercent}%`;
      activeImageElementRef.current.style.top = `${transform.yPercent}%`;
      activeImageElementRef.current.style.width = `${transform.sizePercent}%`;
      activeImageElementRef.current.style.transform = `translate(-50%, -50%) rotate(${transform.rotationDeg || 0}deg)`;
    }
    if (transformBadgeRef.current) {
      transformBadgeRef.current.textContent = isEn 
        ? `X: ${transform.xPercent}% | Y: ${transform.yPercent}% | Size: ${transform.sizePercent}% | Rot: ${transform.rotationDeg || 0}°` 
        : `X: ${transform.xPercent}٪ | Y: ${transform.yPercent}٪ | اندازه: ${transform.sizePercent}٪ | زاویه: ${transform.rotationDeg || 0}°`;
    }
  };

  // Global window pointer handlers for ultra-smooth 60fps drag/resize/rotate
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const mode = interactionModeRef.current;
      if (!mode) return;
      e.preventDefault();

      const rect = containerRectRef.current;
      if (rect.width === 0 || rect.height === 0) return;

      const current = currentTransformRef.current;
      const start = dragStartRef.current;

      if (mode === 'drag') {
        const deltaXPercent = ((e.clientX - start.startX) / rect.width) * 100;
        const deltaYPercent = ((e.clientY - start.startY) / rect.height) * 100;

        const updated = clampGoalTransform({
          ...current,
          xPercent: start.initXPercent + deltaXPercent,
          yPercent: start.initYPercent + deltaYPercent
        });
        currentTransformRef.current = updated;
        applyTransformToDOM(updated);
      } else if (mode === 'resize') {
        const deltaX = e.clientX - start.startX;
        const deltaPercent = (deltaX / rect.width) * 100;

        const updated = clampGoalTransform({
          ...current,
          sizePercent: start.initSizePercent + deltaPercent
        });
        currentTransformRef.current = updated;
        applyTransformToDOM(updated);
      } else if (mode === 'rotate') {
        const center = rotateCenterRef.current;
        const dx = e.clientX - center.x;
        const dy = e.clientY - center.y;
        const rad = Math.atan2(dy, dx);
        let deg = Math.round(rad * (180 / Math.PI)) + 90;
        while (deg > 180) deg -= 360;
        while (deg < -180) deg += 360;

        const updated = clampGoalTransform({
          ...current,
          rotationDeg: deg
        });
        currentTransformRef.current = updated;
        applyTransformToDOM(updated);
      }
    };

    const handleGlobalPointerUp = () => {
      const mode = interactionModeRef.current;
      if (!mode) return;
      interactionModeRef.current = null;

      // Final single state & IndexedDB commit upon release
      const finalTransform = currentTransformRef.current;
      updateActiveGoalTransform(finalTransform);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [activeGoalImage, isEn]);

  // Pointer down starters for Drag, Resize, and Rotate
  const handleImagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeGoalImage || !previewRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = previewRef.current.getBoundingClientRect();
    containerRectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    interactionModeRef.current = 'drag';
    currentTransformRef.current = { ...activeTransform };
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initXPercent: activeTransform.xPercent,
      initYPercent: activeTransform.yPercent,
      initSizePercent: activeTransform.sizePercent,
      initRotationDeg: activeTransform.rotationDeg || 0
    };
  };

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeGoalImage || !previewRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = previewRef.current.getBoundingClientRect();
    containerRectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    interactionModeRef.current = 'resize';
    currentTransformRef.current = { ...activeTransform };
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initXPercent: activeTransform.xPercent,
      initYPercent: activeTransform.yPercent,
      initSizePercent: activeTransform.sizePercent,
      initRotationDeg: activeTransform.rotationDeg || 0
    };
  };

  const handleRotatePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeGoalImage || !previewRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = previewRef.current.getBoundingClientRect();
    containerRectRef.current = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };

    const centerX = rect.left + (rect.width * activeTransform.xPercent) / 100;
    const centerY = rect.top + (rect.height * activeTransform.yPercent) / 100;
    rotateCenterRef.current = { x: centerX, y: centerY };

    interactionModeRef.current = 'rotate';
    currentTransformRef.current = { ...activeTransform };
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initXPercent: activeTransform.xPercent,
      initYPercent: activeTransform.yPercent,
      initSizePercent: activeTransform.sizePercent,
      initRotationDeg: activeTransform.rotationDeg || 0
    };
  };

  // Unified Notification Toggle Handler
  const handleToggleNotification = (key: keyof AppSettings) => {
    const isCurrentlyEnabled = key === 'pomodoroNotificationEnabled' || key === 'downloadNotificationEnabled'
      ? settings[key] !== false
      : Boolean(settings[key]);

    const nextValue = !isCurrentlyEnabled;
    updateSetting(key, nextValue);

    if (nextValue) {
      showToast(isEn ? 'Notification enabled' : 'اعلان فعال شد');
      ensureNotificationPermission().catch(() => {});
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className={`space-y-6 ${activeTab === 'system' ? 'pb-0' : 'pb-12'}`}
    >
      {/* Toast Popup */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-purple-600 text-white text-xs font-semibold shadow-xl border border-purple-400/30 flex items-center gap-2 backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              {isEn ? 'App Settings & Preferences' : 'تنظیمات و پیکربندی برنامه'}
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {isEn ? 'v1.0' : 'نسخه ۱.۰'}
              </span>
            </h2>
            <p className="text-xs text-[var(--text3)]">
              {isEn ? 'Manage user profile, backup & restore, Excel exports, security, and tool customization' : 'مدیریت حساب کاربری، پشتیبان‌گیری، خروجی اکسل، امنیت و شخصی‌سازی ابزارها'}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--border)] overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'general' 
              ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
              : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <User className="w-4 h-4 text-blue-400" />
          <span>{isEn ? 'General & Profile' : 'عمومی و پروفایل'}</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'ai' 
              ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
              : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{isEn ? 'AI Assistant' : 'دستیار هوشمند'}</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'appearance' 
              ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
              : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Paintbrush className="w-4 h-4 shrink-0 text-pink-400" />
          <span>{isEn ? 'Appearance & Theme' : 'ظاهر و دیزاین'}</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'backup' 
              ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
              : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Download className="w-4 h-4 text-green-400" />
          <span>{isEn ? 'Backup & Export' : 'پشتیبان و خروجی'}</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'notifications' 
              ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
              : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <Bell className="w-4 h-4 text-purple-400" />
          <span>{isEn ? 'Notifications' : 'اعلان‌ها'}</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'system' 
              ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
              : 'text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <HardDrive className="w-4 h-4 text-indigo-400" />
          <span>{isEn ? 'System Stats' : 'آمار سیستم'}</span>
        </button>
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Regional, Time & Profile Preferences */}
          <div className="p-4.5 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-2.5 sm:pb-3">
              <Globe className="w-4 h-4 text-indigo-400" />
              {settings.language === 'en' ? 'Language, Time & Profile Settings' : 'تنظیمات زبان، تقویم و زمان'}
            </h3>

            <div className="space-y-4">
              {/* User Name */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {isEn ? 'Your Name:' : 'نام شما:'}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">
                    {isEn ? 'Displayed on dashboard greeting & clock' : 'جهت نمایش در ساعت و پیام خوش‌آمدگویی داشبورد'}
                  </div>
                </div>
                <div className="w-full sm:w-72">
                  <input 
                    type="text"
                    value={settings.userName}
                    onChange={(e) => updateSetting('userName', e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={isEn ? 'e.g. Alex' : 'مثال: علی'}
                  />
                </div>
              </div>

              {/* App Language */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {settings.language === 'en' ? 'App Language / زبان برنامه:' : 'زبان برنامه:'}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">
                    {settings.language === 'en' ? 'Select language (RTL layout maintained)' : 'انتخاب زبان رابط کاربری (چیدمان راست‌به‌چپ)'}
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                  <button
                    onClick={() => updateSetting('language', 'fa')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      settings.language === 'fa' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-[var(--text2)]'
                    }`}
                  >
                    فارسی
                  </button>
                  <button
                    onClick={() => updateSetting('language', 'en')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      (settings.language || 'en') === 'en' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-[var(--text2)]'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Calendar type */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {settings.language === 'en' ? 'Primary Calendar:' : 'نوع تقویم اصلی:'}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">
                    {settings.language === 'en' ? 'Calendar system across app' : 'نمایش تاریخ در بخش‌های مختلف'}
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                  <button
                    onClick={() => updateSetting('calendarType', 'jalali')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      settings.calendarType === 'jalali' ? 'bg-blue-600 text-white font-bold' : 'text-[var(--text2)]'
                    }`}
                  >
                    {settings.language === 'en' ? 'Solar Jalali' : 'هجری شمسی'}
                  </button>
                  <button
                    onClick={() => updateSetting('calendarType', 'gregorian')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      settings.calendarType === 'gregorian' ? 'bg-blue-600 text-white font-bold' : 'text-[var(--text2)]'
                    }`}
                  >
                    {settings.language === 'en' ? 'Gregorian' : 'میلادی'}
                  </button>
                </div>
              </div>

              {/* Clock format */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">{isEn ? 'Clock Format:' : 'فرمت ساعت:'}</div>
                  <div className="text-[11px] text-[var(--text3)]">{isEn ? '24-hour or 12-hour format (AM/PM)' : 'نمایش ۲۴ ساعته یا ۱۲ ساعته (AM/PM)'}</div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                  <button
                    onClick={() => updateSetting('clockFormat', '24h')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      settings.clockFormat === '24h' ? 'bg-blue-600 text-white font-bold' : 'text-[var(--text2)]'
                    }`}
                  >
                    24H
                  </button>
                  <button
                    onClick={() => updateSetting('clockFormat', '12h')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      settings.clockFormat === '12h' ? 'bg-blue-600 text-white font-bold' : 'text-[var(--text2)]'
                    }`}
                  >
                    12H
                  </button>
                </div>
              </div>

              {/* Sound feedback */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">{isEn ? 'Sound Effects (Sound FX):' : 'جلوه‌های صوتی (Sound FX):'}</div>
                    <div className="text-[11px] text-[var(--text3)]">{isEn ? 'Click and interaction audio feedback' : 'صدای افکت هنگام کلیک یا انجام کارها'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={playTestSound}
                    className="px-2.5 py-1 rounded-lg text-[10px] bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] border border-[var(--border)] cursor-pointer"
                  >
                    {isEn ? 'Test Sound' : 'تست صدا'}
                  </button>
                  <button
                    onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                      settings.soundEnabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      settings.soundEnabled 
                        ? (isEn ? 'translate-x-[20px]' : 'translate-x-[-20px]') 
                        : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
              {/* Hide financial amounts by default */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  {settings.privacyMode ? <EyeOff className="w-4 h-4 text-purple-400" /> : <Eye className="w-4 h-4 text-purple-400" />}
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">{isEn ? 'Hide financial amounts by default:' : 'مخفی‌سازی پیش‌فرض مبالغ مالی:'}</div>
                    <div className="text-[11px] text-[var(--text3)]">{isEn ? 'Show income and expense figures as stars (***)' : 'مبالغ درآمد و هزینه با ستاره (***) نمایش داده شوند'}</div>
                  </div>
                </div>
                <button
                  onClick={() => updateSetting('privacyMode', !settings.privacyMode)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                    settings.privacyMode ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    settings.privacyMode
                      ? (isEn ? 'translate-x-[20px]' : 'translate-x-[-20px]')
                      : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* App Proxy Section */}
          <div className="p-4.5 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs sm:text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  {isEn ? 'App proxy' : 'پروکسی برنامه'}
                </div>
                <div className="text-[11px] text-[var(--text3)] mt-0.5">
                  {isEn 
                    ? 'Currently used for AI requests' 
                    : 'فعلاً برای درخواست‌های هوش مصنوعی استفاده می‌شود'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateSetting('aiProxyEnabled', !(settings.aiProxyEnabled === true))}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  settings.aiProxyEnabled === true ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  settings.aiProxyEnabled === true 
                    ? (isEn ? 'translate-x-[20px]' : 'translate-x-[-20px]') 
                    : 'translate-x-0'
                }`} />
              </button>
            </div>
            <div className="flex justify-end">
              <div className="w-full sm:w-72">
                <input 
                  type="text"
                  dir="ltr"
                  disabled={settings.aiProxyEnabled !== true}
                  value={settings.aiProxyUrl || ''}
                  onChange={(e) => updateSetting('aiProxyUrl', e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono text-left transition-opacity ${
                    settings.aiProxyEnabled !== true ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder="http://127.0.0.1:10808"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: AI Assistant */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="p-4.5 sm:p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-2.5 sm:pb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {isEn ? 'AI Assistant Settings' : 'تنظیمات دستیار هوشمند'}
            </h3>
            <div className="space-y-4">
              {/* AI Provider Selector */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {isEn ? 'AI Provider:' : 'ارائه‌دهنده هوش مصنوعی:'}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">
                    {isEn ? 'Choose AI engine provider' : 'انتخاب سرویس‌دهنده هوش مصنوعی'}
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => updateSetting('aiProvider', 'gemini')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      (settings.aiProvider || 'gemini') === 'gemini' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-[var(--text2)]'
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetting('aiProvider', 'openai')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      settings.aiProvider === 'openai' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-[var(--text2)]'
                    }`}
                  >
                    OpenAI Compatible
                  </button>
                </div>
              </div>

              {/* Gemini Provider Fields */}
              {(settings.aiProvider || 'gemini') === 'gemini' ? (
                /* AI API Key */
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[var(--border)]">
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">
                      {isEn ? 'AI API Key:' : 'کلید API هوش مصنوعی:'}
                    </div>
                    <div className="text-[11px] text-[var(--text3)]">
                      {isEn 
                        ? 'Key is only stored on this device.' 
                        : 'کلید فقط روی همین دستگاه ذخیره می‌شود.'}
                    </div>
                  </div>
                  <div className="w-full sm:w-72">
                    <div className="relative flex items-center">
                      <input 
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.geminiApiKey || ''}
                        onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                        className="w-full px-3.5 py-2 pe-9 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono"
                        placeholder={isEn ? 'AI API Key...' : 'کلید API را وارد کنید...'}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute end-2 p-1 text-[var(--text3)] hover:text-[var(--text)] transition-colors cursor-pointer rounded-lg hover:bg-[var(--card-bg)]"
                        title={showApiKey ? (isEn ? 'Hide API Key' : 'مخفی کردن کلید') : (isEn ? 'Show API Key' : 'نمایش کلید')}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* OpenAI Compatible Fields */
                <div className="space-y-3 pt-3 border-t border-[var(--border)]">
                  {/* Base URL */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">
                        {isEn ? 'Base URL:' : 'آدرس پایه (Base URL):'}
                      </div>
                      <div className="text-[11px] text-[var(--text3)]">
                        {isEn ? 'API endpoint URL' : 'آدرس اندپوینت سرویس سازگار با OpenAI'}
                      </div>
                    </div>
                    <div className="w-full sm:w-72">
                      <input 
                        type="text"
                        dir="ltr"
                        value={settings.openaiBaseUrl || ''}
                        onChange={(e) => updateSetting('openaiBaseUrl', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono text-left"
                        placeholder="https://api.example.com/v1"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[var(--border)]">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">
                        {isEn ? 'API Key:' : 'کلید API:'}
                      </div>
                      <div className="text-[11px] text-[var(--text3)]">
                        {isEn ? 'Provider API Key' : 'کلید دسترسی به سرویس'}
                      </div>
                    </div>
                    <div className="w-full sm:w-72">
                      <div className="relative flex items-center" dir="ltr">
                        <input 
                          type={showOpenAiApiKey ? 'text' : 'password'}
                          dir="ltr"
                          value={settings.openaiApiKey || ''}
                          onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
                          className="w-full px-3.5 py-2 pe-9 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono text-left"
                          placeholder="sk-..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenAiApiKey(!showOpenAiApiKey)}
                          className="absolute end-2 p-1 text-[var(--text3)] hover:text-[var(--text)] transition-colors cursor-pointer rounded-lg hover:bg-[var(--card-bg)]"
                          title={showOpenAiApiKey ? (isEn ? 'Hide API Key' : 'مخفی کردن کلید') : (isEn ? 'Show API Key' : 'نمایش کلید')}
                        >
                          {showOpenAiApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Model ID */}
                  <div className="space-y-1.5 pt-3 border-t border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text)]">
                            {isEn ? 'Model ID:' : 'شناسه مدل (Model ID):'}
                          </span>
                          <button
                            type="button"
                            onClick={() => loadOpenAiModels()}
                            disabled={isLoadingModels || !settings.openaiBaseUrl || !settings.openaiApiKey}
                            title={isEn ? 'Load models' : 'بارگذاری مدل‌ها'}
                            aria-label={isEn ? 'Load models' : 'بارگذاری مدل‌ها'}
                            className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingModels ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                        <div className="text-[11px] text-[var(--text3)]">
                          {isEn ? 'Target model identifier' : 'شناسه مدل مدنظر'}
                        </div>
                      </div>
                      <div className="w-full sm:w-72">
                        {openaiModels.length > 0 ? (
                          <Select
                            value={settings.openaiModel || ''}
                            onChange={(v) => updateSetting('openaiModel', v)}
                            options={modelOptions}
                            placeholder="gpt-4o-mini"
                            className="w-full font-mono text-xs"
                          />
                        ) : (
                          <input 
                            type="text"
                            dir="ltr"
                            value={settings.openaiModel || ''}
                            onChange={(e) => updateSetting('openaiModel', e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono text-left"
                            placeholder="gpt-4o-mini"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        )}
                      </div>
                    </div>
                    {modelsError ? (
                      <div className="text-[11px] text-red-500/80 dark:text-red-400/80">
                        {modelsError}
                      </div>
                    ) : null}
                  </div>

                  {/* Helper Note */}
                  <div className="pt-1 text-[11px] text-[var(--text3)]">
                    {isEn 
                      ? 'Works with any OpenAI-compatible service. The key is stored only on this device.'
                      : 'هر سرویسی که API سازگار با OpenAI دارد کار می‌کند. کلید فقط روی همین دستگاه ذخیره می‌شود.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Appearance & Design */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <AppearancePanel 
            isEn={isEn}
            activeTheme={activeTheme}
            onThemeChange={onThemeChange || (() => {})}
          />

          {/* 3. Goal Images Card (Multi-Goal Images Manager) */}
          <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Target className="w-4 h-4 text-violet-400" />
                  {isEn ? 'Goal Images' : 'عکس‌های هدف'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[11px] font-bold">
                  {goalImages.length} {isEn ? 'Images' : 'عکس'}
                </span>
              </div>
              {activeGoalImage && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] hover:bg-[var(--border-hover)] border border-[var(--border)] text-[11px] font-medium text-[var(--text2)] hover:text-[var(--text)] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title={isEn ? 'Reset Selected Position' : 'بازنشانی موقعیت عکس انتخابی'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Reset Position' : 'بازنشانی موقعیت'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGoalImage(activeGoalImage.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    title={isEn ? 'Delete Selected Image' : 'حذف عکس انتخابی'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Delete' : 'حذف'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text3)] leading-relaxed">
                {isEn 
                  ? 'Add goal images to display on your Home screen. Choose to remove the background automatically with AI or keep the original.'
                  : 'می‌توانید چندین عکس هدف آپلود کنید و روی صفحه اصلی قرار دهید. امکان حذف هوشمند پس‌زمینه با هوش مصنوعی یا نگهداری عکس اصلی فراهم است.'}
              </p>
              
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Upload Mode Selector: AI Remove BG vs Original */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setRemoveBgEnabled(true)}
                    disabled={isRemovingBg}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                      removeBgEnabled 
                        ? 'bg-violet-600 text-white font-bold shadow-xs' 
                        : 'text-[var(--text2)] hover:text-[var(--text)]'
                    }`}
                    title={isEn ? 'Automatically remove image background with AI' : 'حذف خودکار پس‌زمینه با هوش مصنوعی'}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Remove BG' : 'حذف پس‌زمینه'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveBgEnabled(false)}
                    disabled={isRemovingBg}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                      !removeBgEnabled 
                        ? 'bg-violet-600 text-white font-bold shadow-xs' 
                        : 'text-[var(--text2)] hover:text-[var(--text)]'
                    }`}
                    title={isEn ? 'Keep original image without removing background' : 'ذخیره عکس اصلی بدون تغییر پس‌زمینه'}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Original' : 'عکس اصلی'}</span>
                  </button>
                </div>

                <input 
                  type="file"
                  ref={goalImageInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp, image/*"
                  onChange={handleGoalImageUpload}
                  disabled={isRemovingBg}
                />
                <button
                  type="button"
                  onClick={() => goalImageInputRef.current?.click()}
                  disabled={isRemovingBg}
                  className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95 ${
                    isRemovingBg 
                      ? 'bg-violet-500/50 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-violet-500/20'
                  }`}
                >
                  {isRemovingBg ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isEn ? 'Removing Background...' : 'در حال حذف پس‌زمینه...'}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{isEn ? 'Add New Image' : 'افزودن عکس جدید'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Removing Background Loading Notice */}
            {isRemovingBg && (
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center gap-3 text-xs text-violet-300 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin shrink-0 text-violet-400" />
                <div>
                  <div className="font-bold">{isEn ? 'Processing with AI...' : 'در حال پردازش هوشمند...'}</div>
                  <div className="text-[11px] text-violet-300/80">
                    {isEn ? 'Removing the background locally on your device. This takes just a few seconds.' : 'در حال حذف پس‌زمینه عکس در دستگاه شما. لطفاً چند لحظه صبر کنید.'}
                  </div>
                </div>
              </div>
            )}

            {/* Thumbnails list & selection */}
            {goalImages.length > 0 && !isRemovingBg && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-[var(--text2)] font-medium">
                  <span>{isEn ? 'Uploaded Goal Images (Click to edit position):' : 'عکس‌های آپلود شده (برای ویرایش کلیک کنید):'}</span>
                  <span className="text-[11px] text-[var(--text3)]">
                    {activeGoalImage ? (isEn ? `Selected: #${goalImages.findIndex(i => i.id === activeGoalImage.id) + 1}` : `انتخاب شده: عکس شماره ${goalImages.findIndex(i => i.id === activeGoalImage.id) + 1}`) : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3 overflow-x-auto p-2 rounded-xl bg-[var(--input-bg)]/60 border border-[var(--border)]">
                  {goalImages.map((img, idx) => {
                    const isSelected = activeGoalImage?.id === img.id;
                    return (
                      <div
                        key={img.id}
                        onClick={() => setSelectedGoalImageId(img.id)}
                        className={`relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden cursor-pointer transition-all flex items-center justify-center p-1.5 ${
                          isSelected
                            ? 'border-2 border-violet-500 ring-2 ring-violet-500/30 bg-violet-500/10 shadow-md'
                            : 'border border-[var(--border)] hover:border-violet-400/50 bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)]'
                        }`}
                      >
                        <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white z-10">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleToggleGoalImageEnabled(img.id, img.enabled !== false); }}
                          title={img.enabled === false ? (isEn ? 'Turn on' : 'روشن کردن') : (isEn ? 'Turn off' : 'خاموش کردن')}
                          className={`absolute top-1 left-1 z-10 w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${
                            img.enabled === false ? 'bg-slate-500 justify-start' : 'bg-emerald-500 justify-end'
                          }`}
                        >
                          <span className="w-3 h-3 rounded-full bg-white shadow" />
                        </button>
                        <img 
                          src={img.dataUrl} 
                          alt={`Goal ${idx + 1}`} 
                          className={`w-full h-full object-contain select-none pointer-events-none ${img.enabled === false ? 'opacity-30' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGoalImage(img.id);
                          }}
                          className="absolute bottom-1 left-1 p-1 rounded-md bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title={isEn ? 'Delete this image' : 'حذف این عکس'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add Image Mini Button */}
                  <button
                    type="button"
                    onClick={() => goalImageInputRef.current?.click()}
                    disabled={isRemovingBg}
                    className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-violet-500 text-[var(--text3)] hover:text-violet-400 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                    title={isEn ? 'Add Another Image' : 'افزودن عکس دیگر'}
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">{isEn ? 'Add' : 'افزودن'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Empty state if no goal images */}
            {goalImages.length === 0 && !isRemovingBg && (
              <div className="p-8 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--input-bg)]/30 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text)]">{isEn ? 'No Goal Images Yet' : 'هنوز عکسی آپلود نشده است'}</h4>
                  <p className="text-[11px] text-[var(--text3)] max-w-sm mx-auto mt-1">
                    {isEn ? 'Upload an image of your target, dream, or inspiration to display on your workspace dashboard.' : 'عکسی از هدف، انگیزه یا رویای خود آپلود کنید تا در صفحه خانه نمایش داده شود.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => goalImageInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Upload First Goal Image' : 'آپلود اولین عکس هدف'}</span>
                </button>
              </div>
            )}

            {/* Interactive Home Screen Simulation Canvas for Active Goal Image */}
            {activeGoalImage && !isRemovingBg && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[var(--text2)]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Move className="w-3.5 h-3.5 text-violet-400" />
                    {isEn 
                      ? `Positioning Image #${goalImages.findIndex(i => i.id === activeGoalImage.id) + 1} (Drag to move, top handle to rotate, corner to resize):` 
                      : `تنظیم موقعیت عکس #${goalImages.findIndex(i => i.id === activeGoalImage.id) + 1} (بکشید، با دستگیره بالا بچرخانید و با گوشه تغییر اندازه دهید):`}
                  </span>
                  <span ref={transformBadgeRef} className="text-[11px] text-[var(--text3)] font-mono">
                    {isEn 
                      ? `X: ${activeTransform.xPercent}% | Y: ${activeTransform.yPercent}% | Size: ${activeTransform.sizePercent}% | Rot: ${activeTransform.rotationDeg || 0}°` 
                      : `X: ${activeTransform.xPercent}٪ | Y: ${activeTransform.yPercent}٪ | اندازه: ${activeTransform.sizePercent}٪ | زاویه: ${activeTransform.rotationDeg || 0}°`}
                  </span>
                </div>

                {/* Full Home Dashboard Real Scaled Preview */}
                <div 
                  ref={previewContainerRef}
                  className="relative w-full h-[400px] sm:h-[460px] rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--bg)] shadow-inner select-none"
                >
                  <div
                    ref={previewRef}
                    className="absolute select-none will-change-transform"
                    style={{
                      top: 0,
                      left: 0,
                      width: `${virtualHomeWidth}px`,
                      minWidth: `${virtualHomeWidth}px`,
                      maxWidth: `${virtualHomeWidth}px`,
                      transform: `scale(${previewScale})`,
                      transformOrigin: 'top left',
                      touchAction: 'none'
                    }}
                  >
                    {/* Real HomePanel rendered in read-only / non-clickable mode matching live layout */}
                    <div className="pointer-events-none select-none w-full">
                      <HomePanel 
                        key="mini-home-preview"
                        lastActivity={{ type: 'note', text: isEn ? 'Daily priorities' : 'اولویت‌های روزانه', ts: Date.now() }}
                        fixedDaily={[isEn ? 'Morning routine' : 'روتین صبحگاهی', isEn ? 'Daily study' : 'مطالعه روزانه']}
                        todayExtras={[
                          { id: 'preview-extra-1', text: isEn ? 'Deep work block' : 'فوکوس عمیق کاری', done: true },
                          { id: 'preview-extra-2', text: isEn ? 'Check schedule' : 'بررسی تقویم', done: false }
                        ]}
                        onToggleTodayExtra={() => {}}
                        monthlyTransactions={[
                          { id: 1, type: 'income', amount: 50000000, category: 'work', desc: isEn ? 'Income' : 'درآمد', dateKey: '1405-05-01', jy: 1405, jm: 5, jd: 1 },
                          { id: 2, type: 'expense', amount: 12000000, category: 'food', desc: isEn ? 'Expenses' : 'مخارج', dateKey: '1405-05-10', jy: 1405, jm: 5, jd: 10 }
                        ]}
                        onNavigateToPanel={() => {}}
                        onAskAi={() => {}}
                        settings={settings}
                        todos={[
                          { text: isEn ? 'Project milestone review' : 'بررسی پیشرفت اهداف', done: false }
                        ]}
                        shopping={[
                          { text: isEn ? 'Groceries & Books' : 'خرید هفتگی', done: true }
                        ]}
                        onToggleTask={() => {}}
                        ideas={[
                          { id: 1, title: isEn ? 'Creative concept' : 'طرح ایده خلاقانه', desc: '', links: [], images: [], status: 1, date: '1405/05/30' }
                        ]}
                        note={isEn ? 'Personal dashboard workspace scratchpad...' : 'فضای یادداشت شخصی و پیگیری کارهای مهم...'}
                        hideGoalImages={true}
                      />
                    </div>

                    {/* Non-active goal images */}
                    {goalImages.filter(img => img.id !== activeGoalImage.id).map(img => {
                      const rawTr = img.transform || DEFAULT_GOAL_IMAGE_TRANSFORM;
                      const tr = clampGoalTransform(rawTr);
                      return (
                        <div
                          key={img.id}
                          onClick={() => setSelectedGoalImageId(img.id)}
                          className="absolute z-20 cursor-pointer rounded-lg border border-dashed border-white/25 hover:border-violet-400/80 transition-all opacity-85 hover:opacity-100"
                          style={{
                            left: `${tr.xPercent}%`,
                            top: `${tr.yPercent}%`,
                            width: `${tr.sizePercent}%`,
                            transform: `translate(-50%, -50%) rotate(${tr.rotationDeg || 0}deg)`,
                            maxWidth: '500px',
                            minWidth: '24px',
                            touchAction: 'none'
                          }}
                          title={isEn ? 'Click to select and edit this image' : 'برای ویرایش روی این عکس کلیک کنید'}
                        >
                          <img
                            src={img.dataUrl}
                            alt="Other goal"
                            className="w-full h-auto object-contain pointer-events-none select-none drop-shadow-none"
                            draggable={false}
                          />
                        </div>
                      );
                    })}

                    {/* Draggable, Resizable & Rotatable ACTIVE Goal Image */}
                    {(() => {
                      const clampedActive = clampGoalTransform(activeTransform);
                      return (
                        <div
                          ref={activeImageElementRef}
                          onPointerDown={handleImagePointerDown}
                          className="absolute z-30 group cursor-grab active:cursor-grabbing select-none will-change-transform"
                          style={{
                            left: `${clampedActive.xPercent}%`,
                            top: `${clampedActive.yPercent}%`,
                            width: `${clampedActive.sizePercent}%`,
                            transform: `translate(-50%, -50%) rotate(${clampedActive.rotationDeg || 0}deg)`,
                            maxWidth: '500px',
                            minWidth: '24px',
                            touchAction: 'none'
                          }}
                        >
                          {/* Visual selection outline box overlay */}
                          <div className="relative w-full h-full rounded-lg border-2 border-dashed border-violet-400/90 group-hover:border-violet-400 bg-violet-500/10 group-hover:bg-violet-500/15 transition-colors shadow-sm">
                            {/* Top Rotation Handle */}
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                              <div
                                onPointerDown={handleRotatePointerDown}
                                className="w-5 h-5 rounded-full bg-violet-600 border-2 border-white shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                                title={isEn ? 'Rotate Image' : 'چرخش عکس'}
                                style={{ touchAction: 'none' }}
                              >
                                <RotateCw className="w-2.5 h-2.5 text-white pointer-events-none" />
                              </div>
                              <div className="w-0.5 h-2 bg-violet-400/90 pointer-events-none" />
                            </div>

                            {/* Goal Image */}
                            <img 
                              src={activeGoalImage.dataUrl} 
                              alt="Goal Preview" 
                              className="w-full h-auto object-contain pointer-events-none select-none drop-shadow-none"
                              draggable={false}
                            />

                            {/* Bottom-Right Corner Resize Handle */}
                            <div
                              onPointerDown={handleResizePointerDown}
                              className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-violet-600 border-2 border-white shadow-md flex items-center justify-center cursor-nwse-resize hover:scale-125 transition-transform pointer-events-auto"
                              title={isEn ? 'Resize' : 'تغییر اندازه'}
                              style={{ touchAction: 'none' }}
                            >
                              <Maximize2 className="w-2.5 h-2.5 text-white pointer-events-none" />
                            </div>

                            {/* Center move indicator on hover */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <span className="p-1 rounded-full bg-black/60 text-white shadow-xs">
                                <Move className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Backup & Export */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full JSON Backup & Restore */}
            <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <Download className="w-4 h-4 text-green-400" />
                {isEn ? 'Full Data Backup & Restore' : 'پشتیبان‌گیری یکجا و بازیابی داده‌ها'}
              </h3>

              <p className="text-xs text-[var(--text3)] leading-relaxed">
                {isEn 
                  ? 'Export all notes, ideas, tasks, finances, weekly schedule, and settings into a single JSON file to restore on any device.'
                  : 'می‌توانید یک خروجی کامل شامل تمام یادداشت‌ها، ایده‌ها، کارهای روزانه، حساب‌های مالی، برنامه هفتگی و تنظیمات دانلود کرده و در دستگاه دیگری بازیابی کنید.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleExportAllJSON}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>{isEn ? 'Download Full Backup (JSON)' : 'دانلود backup کامل (JSON)'}</span>
                </button>

                <input 
                  type="file"
                  ref={importInputRef}
                  className="hidden"
                  accept=".json"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImportJSON(e.target.files[0]);
                    }
                  }}
                />

                <button
                  onClick={() => importInputRef.current?.click()}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text)] border border-[var(--border)] text-xs font-semibold transition-all cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>{isEn ? 'Restore from Backup' : 'بازیابی از فایل پشتیبان'}</span>
                </button>
              </div>

              <p className="text-[11px] text-[var(--text3)] leading-relaxed pt-1">
                {isEn
                  ? "Linked files in edit assets are not included in backups; only their list, categories, and previews are saved. After restoring on another system, connect the files using 'Relink'."
                  : 'فایل‌های پیوندی منابع ادیت در بکاپ نیستند؛ فقط فهرست، دسته‌بندی و پیش‌نمایش‌ها ذخیره می‌شوند. بعد از بازیابی روی سیستم دیگر، فایل‌ها را با «پیوند دوباره» وصل کنید.'}
              </p>
            </div>

            {/* Excel / CSV Exports */}
            <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                {isEn ? 'Excel / CSV Exports' : 'خروجی فرمت اکسل (CSV)'}
              </h3>

              <p className="text-xs text-[var(--text3)] leading-relaxed">
                {isEn
                  ? 'Export data individually for analysis in Excel or Google Sheets:'
                  : 'برای تحلیل داده‌ها در نرم‌افزارهای Excel یا Google Sheets، می‌توانید خروجی جداگانه بگیرید:'}
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleExportTasksCSV}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text)] transition-all cursor-pointer group"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {isEn ? 'Download Tasks & Shopping List (CSV)' : 'دانلود لیست کامل کارها و خریدها (CSV)'}
                  </span>
                  <Download className="w-4 h-4 text-[var(--text3)] group-hover:text-[var(--text)]" />
                </button>

                <button
                  onClick={handleExportFinanceCSV}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text)] transition-all cursor-pointer group"
                >
                  <span className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    {isEn ? 'Download Financial Transactions (CSV)' : 'دانلود ریز تراکنش‌های مالی (CSV)'}
                  </span>
                  <Download className="w-4 h-4 text-[var(--text3)] group-hover:text-[var(--text)]" />
                </button>
              </div>
            </div>
          </div>

          {/* Reset All Data Dangerous Zone */}
          <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>{isEn ? 'Danger Zone: Reset & Delete All Data' : 'منطقه حساس: حذف و پاکسازی کامل داده‌ها'}</span>
            </div>
            <p className="text-xs text-[var(--text2)]">
              {isEn 
                ? 'This will irreversibly wipe all notes, tasks, finances, and settings from this device.'
                : 'با این کار تمام یادداشت‌ها، کارها، حساب‌های مالی و تنظیمات به‌صورت کامل و غیرقابل بازگشت از این دستگاه پاک می‌شوند.'}
            </p>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm cursor-pointer transition-all"
            >
              {isEn ? 'Full App Reset & Wipe' : 'ریست کامل برنامه و پاکسازی'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Privacy */}
      {activeTab === 'notifications' && (
        <div className="w-full space-y-6">
          {/* Events & Quiet Hours Card */}
          <div className="w-full p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Bell className="w-4 h-4 text-purple-400" />
              {isEn ? 'Events & Quiet Hours' : 'اعلان‌های رویداد و حالت سکوت'}
            </h3>

            <p className="text-xs text-[var(--text3)] leading-relaxed">
              {isEn 
                ? 'Manage event-based alerts and quiet hours.' 
                : 'مدیریت اعلان‌های رویدادمحور و ساعت سکوت.'}
            </p>

            <div className="pt-1 space-y-1">
              {/* Desktop only: start with Windows */}
              {isDesktopApp() && (
                <NotificationRow
                  icon={<Activity className="w-5 h-5" />}
                  iconBg="from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/25"
                  title={isEn ? 'Start with Windows' : 'اجرا با روشن شدن ویندوز'}
                  description={isEn ? 'Open Corely automatically when you sign in to Windows' : 'باز شدن خودکار Corely هنگام ورود به ویندوز'}
                  enabled={autoStartEnabled}
                  onToggle={handleToggleAutoStart}
                  isEn={isEn}
                />
              )}

              {/* Row 1: Pomodoro Session End */}
              <NotificationRow
                icon={<Timer className="w-5 h-5" />}
                iconBg="from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/25"
                title={isEn ? 'Pomodoro Session End' : 'پایان پومودورو'}
                description={isEn ? 'Alert when focus interval or break finishes' : 'ارسال اعلان در پایان بازه تمرکز یا استراحت'}
                enabled={settings.pomodoroNotificationEnabled !== false}
                onToggle={() => handleToggleNotification('pomodoroNotificationEnabled')}
                isEn={isEn}
              />

              {/* Row 2: Download Complete */}
              <NotificationRow
                icon={<Download className="w-5 h-5" />}
                iconBg="from-sky-500/20 to-blue-500/10 text-sky-400 border-sky-500/25"
                title={isEn ? 'Download Complete' : 'پایان دانلود'}
                description={isEn ? 'Alert when file downloading finishes' : 'ارسال اعلان پس از تکمیل موفق دانلود فایل'}
                enabled={settings.downloadNotificationEnabled !== false}
                onToggle={() => handleToggleNotification('downloadNotificationEnabled')}
                isEn={isEn}
              />

              {/* Row 3: Quiet Hours */}
              <NotificationRow
                icon={<Moon className="w-5 h-5" />}
                iconBg="from-indigo-500/20 to-purple-500/10 text-indigo-400 border-indigo-500/25"
                title={isEn ? 'Quiet Hours' : 'ساعت سکوت'}
                description={isEn ? 'Mute all workspace notifications during rest hours' : 'عدم ارسال هیچ‌گونه اعلان در بازه زمانی تعیین‌شده'}
                enabled={settings.quietHoursEnabled}
                onToggle={() => handleToggleNotification('quietHoursEnabled')}
                isEn={isEn}
                extraContent={
                  <AnimatePresence initial={false}>
                    {settings.quietHoursEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 p-3.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--border)] space-y-3.5">
                          {/* A: TimePickers */}
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[11px] text-[var(--text3)] font-medium">
                              {isEn ? 'Quiet window:' : 'بازه زمانی سکوت:'}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-[var(--text3)]">{isEn ? 'From' : 'از'}</span>
                                <TimePicker
                                  value={settings.quietHoursStart}
                                  onChange={(val) => updateSetting('quietHoursStart', val)}
                                  isEn={isEn}
                                  aria-label={isEn ? 'Quiet hours start time' : 'ساعت شروع سکوت'}
                                />
                              </div>

                              <span className="text-[var(--text3)] text-xs font-mono select-none px-0.5">
                                {isEn ? '→' : '←'}
                              </span>

                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-[var(--text3)]">{isEn ? 'To' : 'تا'}</span>
                                <TimePicker
                                  value={settings.quietHoursEnd}
                                  onChange={(val) => updateSetting('quietHoursEnd', val)}
                                  isEn={isEn}
                                  aria-label={isEn ? 'Quiet hours end time' : 'ساعت پایان سکوت'}
                                />
                              </div>
                            </div>
                          </div>

                          {/* B: Quick Presets */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
                            <span className="text-[11px] text-[var(--text3)] font-medium shrink-0">
                              {isEn ? 'Quick presets:' : 'پیش‌تنظیم‌های سریع:'}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {QUIET_PRESETS.map((chip) => {
                                const isActive =
                                  settings.quietHoursStart === chip.start &&
                                  settings.quietHoursEnd === chip.end;
                                return (
                                  <button
                                    key={chip.id}
                                    type="button"
                                    onClick={() => {
                                      updateSetting('quietHoursStart', chip.start);
                                      updateSetting('quietHoursEnd', chip.end);
                                    }}
                                    className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer border ${
                                      isActive
                                        ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs font-semibold'
                                        : 'bg-[var(--card-bg)] text-[var(--text2)] border-[var(--border)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text)]'
                                    }`}
                                  >
                                    {isEn ? chip.labelEn : chip.labelFa}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* C: 24-Hour Timeline Bar */}
                          <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                            <div
                              dir="ltr"
                              className="w-full h-2.5 rounded-full bg-[var(--card-bg)] border border-[var(--border)] relative overflow-hidden"
                            >
                              {getQuietBarSegments(settings.quietHoursStart, settings.quietHoursEnd).map((seg, idx) => (
                                <div
                                  key={idx}
                                  className="absolute top-0 bottom-0 bg-[var(--accent)] rounded-full transition-all duration-300 shadow-xs"
                                  style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                                />
                              ))}
                            </div>
                            <div
                              dir="ltr"
                              className="flex justify-between text-[10px] text-[var(--text3)] font-mono tabular-nums px-0.5 select-none"
                            >
                              <span>00</span>
                              <span>06</span>
                              <span>12</span>
                              <span>18</span>
                              <span>24</span>
                            </div>
                            <div className="text-[11px] text-[var(--text3)] flex items-center gap-1.5 pt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 animate-pulse" />
                              <span>
                                {isEn
                                  ? `No notifications will be sent between ${settings.quietHoursStart} and ${settings.quietHoursEnd}`
                                  : `اعلانی بین ${settings.quietHoursStart} و ${settings.quietHoursEnd} ارسال نمی‌شود`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: System Stats */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-2">
              <div className="text-xs font-medium text-[var(--text3)]">{isEn ? 'Ideas & Projects Count' : 'تعداد ایده‌ها و پروژه‌ها'}</div>
              <div className="text-xl font-bold text-[var(--text)] font-mono">{itemCounts.ideasCount} {isEn ? 'items' : 'مورد'}</div>
              <div className="text-[10px] text-[var(--text3)]">{isEn ? 'Stored on this device' : 'ذخیره‌شده روی همین دستگاه'}</div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-2">
              <div className="text-xs font-medium text-[var(--text3)]">{isEn ? 'Daily Tasks & Shopping Items' : 'تعداد کارهای روزانه و خریدها'}</div>
              <div className="text-xl font-bold text-[var(--text)] font-mono">
                {itemCounts.tasksCount + itemCounts.shoppingCount} {isEn ? 'items' : 'آیتم'}
              </div>
              <div className="text-[10px] text-[var(--text3)]">{isEn ? 'Ready for review' : 'آماده مرور و تکمیل'}</div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text)] flex items-center justify-between border-b border-[var(--border)] pb-3">
              <span>{isEn ? 'System Usage Breakdown' : 'ریز جزئیات استفاده سیستم'}</span>
              <button
                onClick={() => window.location.reload()}
                className="p-1.5 rounded-lg bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] text-xs flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {isEn ? 'Refresh' : 'به‌روزرسانی'}
              </button>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                <div className="text-[var(--text3)] mb-0.5">{isEn ? 'Notes size' : 'حجم یادداشت‌ها'}</div>
                <div className="font-bold text-[var(--text)]">{itemCounts.notesLength} {isEn ? 'chars' : 'کاراکتر'}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                <div className="text-[var(--text3)] mb-0.5">{isEn ? 'Transactions' : 'تراکنش‌های مالی'}</div>
                <div className="font-bold text-[var(--text)]">{itemCounts.financeCount} {isEn ? 'records' : 'ثبت شده'}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                <div className="text-[var(--text3)] mb-0.5">{isEn ? 'Edit assets & memes' : 'منابع ادیت و میم‌ها'}</div>
                <div className="font-bold text-[var(--text)]">{itemCounts.editAssetsCount} {isEn ? 'items' : 'آیتم'}</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                <div className="text-[var(--text3)] mb-0.5">{isEn ? 'Downloaded (30 days)' : 'دانلود ۳۰ روز اخیر'}</div>
                <div className="font-bold text-[var(--text)]">{itemCounts.downloadedLast30Days}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Full Reset */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm p-6 rounded-2xl bg-[var(--card-bg)] border border-red-500/30 shadow-2xl space-y-4 text-center rtl"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-red-400">{isEn ? 'Are you sure?' : 'آیا مطمئن هستید؟'}</h3>
                <p className="text-xs text-[var(--text2)] mt-1">
                  {isEn 
                    ? <>To confirm wiping all application data, type <span className="font-mono font-bold text-red-400">RESET</span>:</>
                    : <>برای تایید پاکسازی کامل اطلاعات، عبارت <span className="font-mono font-bold text-red-400">RESET</span> را تایپ کنید:</>}
                </p>
              </div>

              <input 
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="RESET"
                className="w-full px-3 py-2 text-center font-mono font-bold text-sm rounded-xl bg-[var(--input-bg)] border border-red-500/40 text-red-400 focus:outline-none"
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmInput('');
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="button"
                  disabled={resetConfirmInput !== 'RESET'}
                  onClick={handleFullReset}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-red-600 text-white shadow-md disabled:opacity-40 cursor-pointer"
                >
                  {isEn ? 'Delete All Data' : 'حذف همه داده‌ها'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

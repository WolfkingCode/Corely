/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Plus,
  Trash2,
  Pause,
  Play,
  X,
  FileVideo,
  FileMusic,
  FileImage,
  FileText,
  FileArchive,
  FileCode,
  File,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Search,
  Filter,
  Clock,
  HardDrive,
  ExternalLink,
  Copy,
  Link2,
  Zap,
  ChevronDown,
  Check,
  Folder,
  LucideIcon
} from 'lucide-react';
import { loadFromLocalStorage, saveToLocalStorage, formatShamsi } from '../lib/utils';
import { AppSettings } from '../types';
import { notify } from '../lib/notifications';
import type { DownloadProgressEvent } from '../declarations';

function isDownloadNotificationEnabled(settings?: AppSettings): boolean {
  if (settings && typeof settings.downloadNotificationEnabled === 'boolean') {
    return settings.downloadNotificationEnabled;
  }
  try {
    const raw = localStorage.getItem('v3_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.downloadNotificationEnabled === 'boolean') {
        return parsed.downloadNotificationEnabled;
      }
    }
  } catch {}
  return true;
}

/* ─── Types ─── */
export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
export type DownloadCategory = 'video' | 'music' | 'image' | 'document' | 'archive' | 'software' | 'other';

export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  category: DownloadCategory;
  status: DownloadStatus;
  progress: number;        // 0-100
  totalSize: number;       // bytes
  downloadedSize: number;  // bytes
  speed: number;           // bytes/sec
  createdAt: string;       // ISO
  completedAt?: string;    // ISO
  errorMessage?: string;
  tags: string[];
  description?: string;
  queueName?: string;
}

const CATEGORY_CONFIG: Record<DownloadCategory, { label: string; icon: LucideIcon; color: string; ext: string[] }> = {
  video:    { label: 'ویدیو',    icon: FileVideo,    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', ext: ['mp4','mkv','avi','mov','wmv','flv','webm'] },
  music:    { label: 'موسیقی',   icon: FileMusic,    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', ext: ['mp3','wav','flac','aac','ogg','m4a','wma'] },
  image:    { label: 'تصویر',    icon: FileImage,    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', ext: ['jpg','jpeg','png','gif','bmp','webp','svg'] },
  document: { label: 'سند',      icon: FileText,     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', ext: ['pdf','doc','docx','txt','rtf','odt'] },
  archive:  { label: 'فشرده',    icon: FileArchive,  color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', ext: ['zip','rar','7z','tar','gz','bz2'] },
  software: { label: 'نرم‌افزار', icon: FileCode,     color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', ext: ['exe','msi','dmg','pkg','deb','rpm','apk'] },
  other:    { label: 'سایر',     icon: File,         color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', ext: [] },
};

function guessCategoryFromUrl(url: string): DownloadCategory {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const ext = pathname.split('.').pop() || '';
    for (const [cat, cfg] of Object.entries(CATEGORY_CONFIG)) {
      if (cfg.ext.includes(ext)) return cat as DownloadCategory;
    }
  } catch { /* ignore */ }
  return 'other';
}

function guessFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop() || 'دانلود ناشناس';
    return decodeURIComponent(name);
  } catch {
    return 'دانلود ناشناس';
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bps: number): string {
  return formatBytes(bps) + '/s';
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatStartDownloadError(error?: string): string {
  if (!error) return 'خطا در شروع دانلود';
  if (error === 'invalid_url') return 'آدرس نامعتبر است';
  if (error === 'invalid_id') return 'شناسه نامعتبر است';
  if (error.startsWith('http_')) return `خطای سرور (${error.slice(5)})`;
  return 'خطا در شروع دانلود';
}

function formatProgressDownloadError(error?: string): string {
  if (!error) return 'خطا در دانلود';
  if (error === 'invalid_url') return 'آدرس نامعتبر است';
  if (error === 'invalid_id') return 'شناسه نامعتبر است';
  if (error.startsWith('http_')) return `خطای سرور (${error.slice(5)})`;
  return 'خطا در دانلود';
}

function getDesktopDownloads() {
  return typeof window !== 'undefined' ? (window as any).corelyDesktop?.downloads : undefined;
}

interface DownloadManagerPanelProps {
  key?: string;
  settings?: AppSettings;
}

export default function DownloadManagerPanel({ settings }: DownloadManagerPanelProps = {}) {
  const isEn = settings?.language === 'en';
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    const raw = loadFromLocalStorage<DownloadItem[]>('v3_downloads', []);
    if (getDesktopDownloads()) {
      return raw.map(item =>
        item.status === 'downloading'
          ? { ...item, status: 'paused' as DownloadStatus, speed: 0 }
          : item
      );
    }
    return raw;
  });
  const [filterStatus, setFilterStatus] = useState<DownloadStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<DownloadCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState<DownloadCategory>('other');
  const [newDesc, setNewDesc] = useState('');
  const [addMode, setAddMode] = useState<'single' | 'pattern'>('single');
  const [patternUrl, setPatternUrl] = useState('');
  const [patternFrom, setPatternFrom] = useState<number | ''>('');
  const [patternTo, setPatternTo] = useState<number | ''>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ url: string; existingStatus: DownloadStatus } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'size'>('date');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Custom Dropdown Open States
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const abortControllers = useRef<Record<string, AbortController>>({});
  const speedTrackers = useRef<Record<string, { lastTime: number; lastBytes: number }>>({});
  const notifiedCompletedRef = useRef<Set<string>>(new Set());
  const dispatchedToMainRef = useRef<Set<string>>(new Set());

  // Close dropdowns on outside click and cleanup on unmount
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (!getDesktopDownloads()) {
        Object.values(abortControllers.current).forEach((ctrl: AbortController) => ctrl.abort());
      }
    };
  }, []);

  // Ref to hold latest downloads state for async callbacks
  const downloadsRef = useRef(downloads);
  const lastSavedRef = useRef<{
    count: number;
    statuses: Record<string, DownloadStatus>;
  }>({
    count: downloads.length,
    statuses: Object.fromEntries(downloads.map(d => [d.id, d.status])),
  });
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveDownloadsNow = useCallback((items: DownloadItem[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    saveToLocalStorage('v3_downloads', items);
    lastSavedRef.current = {
      count: items.length,
      statuses: Object.fromEntries(items.map(d => [d.id, d.status])),
    };
  }, []);

  // Save to localStorage: immediate on count or status change; debounced (max once every 2s) for progress updates
  useEffect(() => {
    downloadsRef.current = downloads;

    const prev = lastSavedRef.current;
    const countChanged = prev.count !== downloads.length;
    let statusChanged = false;

    if (!countChanged) {
      for (const d of downloads) {
        if (prev.statuses[d.id] !== d.status) {
          statusChanged = true;
          break;
        }
      }
    }

    if (countChanged || statusChanged) {
      saveDownloadsNow(downloads);
    } else {
      if (!saveTimeoutRef.current) {
        saveTimeoutRef.current = setTimeout(() => {
          saveTimeoutRef.current = null;
          saveDownloadsNow(downloadsRef.current);
        }, 2000);
      }
    }
  }, [downloads, saveDownloadsNow]);

  // Save once on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveToLocalStorage('v3_downloads', downloadsRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      saveToLocalStorage('v3_downloads', downloadsRef.current);
    };
  }, []);

  // On mount, sync with desktop main process downloads.list()
  useEffect(() => {
    const desktopDownloads = getDesktopDownloads();
    if (!desktopDownloads?.list) return;

    desktopDownloads.list().then((mainList: any) => {
      if (!Array.isArray(mainList)) return;

      mainList.forEach((mainItem: any) => {
        if (mainItem && (mainItem.status === 'queued' || mainItem.status === 'downloading')) {
          dispatchedToMainRef.current.add(mainItem.id);
        }
      });

      const mainMap = new Map<string, any>(mainList.map((item: any) => [item.id, item]));

      setDownloads(prev => {
        let changed = false;
        const updated: DownloadItem[] = prev.map((item): DownloadItem => {
          const mainItem = mainMap.get(item.id);
          if (mainItem) {
            const mappedStatus: DownloadStatus = mainItem.status === 'queued' ? 'pending' : (mainItem.status as DownloadStatus);
            if (
              item.status !== mappedStatus ||
              (typeof mainItem.received === 'number' && item.downloadedSize !== mainItem.received)
            ) {
              changed = true;
              return {
                ...item,
                status: mappedStatus,
                downloadedSize: typeof mainItem.received === 'number' ? mainItem.received : item.downloadedSize,
                totalSize: typeof mainItem.total === 'number' && mainItem.total > 0 ? mainItem.total : item.totalSize,
                progress: typeof mainItem.total === 'number' && mainItem.total > 0 && typeof mainItem.received === 'number'
                  ? Math.min(100, Math.round((mainItem.received / mainItem.total) * 100))
                  : item.progress,
                speed: typeof mainItem.speed === 'number' ? mainItem.speed : item.speed,
                filename: mainItem.savedName || item.filename,
              };
            }
          } else if (item.status === 'downloading' && !dispatchedToMainRef.current.has(item.id)) {
            // Downloading in storage but unknown in main process and not dispatched -> pause it
            changed = true;
            return {
              ...item,
              status: 'paused' as DownloadStatus,
              speed: 0,
            };
          }
          return item;
        });

        return changed ? updated : prev;
      });
    }).catch((err: any) => {
      console.error('[DownloadManager] Failed to list downloads from main process:', err);
    });
  }, []);

  // Subscribe to desktop download progress events
  useEffect(() => {
    const desktopDownloads = getDesktopDownloads();
    if (!desktopDownloads?.onProgress) return;

    const unsubscribe = desktopDownloads.onProgress((data: DownloadProgressEvent) => {
      if (!data || !data.id) return;

      if (data.status === 'completed' || data.status === 'error' || data.status === 'paused') {
        dispatchedToMainRef.current.delete(data.id);
      } else if (data.status === 'queued' || data.status === 'downloading') {
        dispatchedToMainRef.current.add(data.id);
      }

      setDownloads(prev => {
        const idx = prev.findIndex(d => d.id === data.id);
        if (idx === -1) return prev;

        const current = prev[idx];
        const isNowCompleted = data.status === 'completed';
        const mappedStatus: DownloadStatus = data.status === 'queued' ? 'pending' : (data.status as DownloadStatus);

        if (isNowCompleted && current.status !== 'completed' && !notifiedCompletedRef.current.has(data.id)) {
          notifiedCompletedRef.current.add(data.id);
          if (isDownloadNotificationEnabled(settings)) {
            notify({
              title: isEn ? 'Download complete' : 'دانلود کامل شد',
              body: data.savedName || current.filename,
            });
          }
        }

        const updatedItem: DownloadItem = {
          ...current,
          downloadedSize: typeof data.received === 'number' ? data.received : current.downloadedSize,
          totalSize: typeof data.total === 'number' && data.total > 0 ? data.total : current.totalSize,
          progress: typeof data.total === 'number' && data.total > 0 && typeof data.received === 'number'
            ? Math.min(100, Math.round((data.received / data.total) * 100))
            : (isNowCompleted ? 100 : current.progress),
          speed: typeof data.speed === 'number' ? data.speed : current.speed,
          status: mappedStatus,
          errorMessage: data.status === 'error'
            ? formatProgressDownloadError(data.error)
            : (current.status === 'error' ? current.errorMessage : undefined),
          completedAt: isNowCompleted ? (current.completedAt || new Date().toISOString()) : current.completedAt,
          filename: data.savedName || current.filename,
        };

        const next = [...prev];
        next[idx] = updatedItem;
        return next;
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isEn, settings]);

  /* ─── Add Download ─── */
  const confirmAddDownload = (url: string) => {
    const cat = newCategory === 'other' ? guessCategoryFromUrl(url) : newCategory;
    const item: DownloadItem = {
      id: `dl-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      url,
      filename: guessFilenameFromUrl(url),
      category: cat,
      status: 'pending',
      progress: 0,
      totalSize: 0,
      downloadedSize: 0,
      speed: 0,
      createdAt: new Date().toISOString(),
      tags: [],
      description: newDesc.trim() || undefined,
    };

    setDownloads(prev => [item, ...prev]);
    setNewUrl('');
    setNewDesc('');
    setNewCategory('other');
    setShowAddForm(false);
    setIsCategoryDropdownOpen(false);
    setDuplicatePrompt(null);
  };

  const handleAddDownload = () => {
    let url = newUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const normalizeUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, '');
    const norm = normalizeUrl(url);
    const existing = downloads.find(d => normalizeUrl(d.url) === norm);
    if (existing) {
      setDuplicatePrompt({ url, existingStatus: existing.status });
      return;
    }

    confirmAddDownload(url);
  };

  /* ─── Add Pattern Range (e.g. part*.rar from part 2 to part 8) ─── */
  const handleAddPatternRange = () => {
    const pattern = patternUrl.trim();
    if (!pattern.includes('*')) return;
    if (patternFrom === '' || patternTo === '') return;
    const from = Number(patternFrom);
    const to = Number(patternTo);
    if (from > to) return;
    const digits = String(to).length;
    const newItems: DownloadItem[] = [];
    for (let i = from; i <= to; i++) {
      const numStr = String(i).padStart(digits, '0');
      let itemUrl = pattern.replace('*', numStr);
      if (!/^https?:\/\//i.test(itemUrl)) itemUrl = 'https://' + itemUrl;
      newItems.push({
        id: `dl-${Date.now()}-${Math.random().toString(36).slice(2,7)}-${i}`,
        url: itemUrl,
        filename: guessFilenameFromUrl(itemUrl),
        category: guessCategoryFromUrl(itemUrl),
        status: 'pending',
        progress: 0,
        totalSize: 0,
        downloadedSize: 0,
        speed: 0,
        createdAt: new Date().toISOString(),
        tags: [],
      });
    }
    setDownloads(prev => [...newItems, ...prev]);
    setPatternUrl('');
    setPatternFrom('');
    setPatternTo('');
    setShowAddForm(false);
  };

  /* ─── Start / Resume Download ─── */
  const startDownload = useCallback(async (id: string) => {
    const item = downloadsRef.current.find(d => d.id === id);
    if (!item) return;

    const desktopDownloads = getDesktopDownloads();
    if (desktopDownloads) {
      dispatchedToMainRef.current.add(id);
      setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'downloading', errorMessage: undefined } : d));
      try {
        const res = await desktopDownloads.start({
          id: item.id,
          url: item.url,
          filename: item.filename,
        });
        if (res && res.ok === false) {
          dispatchedToMainRef.current.delete(id);
          const msg = formatStartDownloadError(res.error);
          setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'error', errorMessage: msg, speed: 0 } : d));
          return;
        }
      } catch (err: any) {
        dispatchedToMainRef.current.delete(id);
        const msg = formatStartDownloadError(err?.message);
        setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'error', errorMessage: msg, speed: 0 } : d));
      }
      return;
    }

    setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'downloading', errorMessage: undefined } : d));

    const controller = new AbortController();
    abortControllers.current[id] = controller;
    speedTrackers.current[id] = { lastTime: Date.now(), lastBytes: item.downloadedSize };

    try {
      const response = await fetch(item.url, {
        signal: controller.signal,
        headers: item.downloadedSize > 0 ? { 'Range': `bytes=${item.downloadedSize}-` } : {},
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`خطای سرور: ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) + item.downloadedSize : item.totalSize;

      setDownloads(prev => prev.map(d => d.id === id ? { ...d, totalSize: total || d.totalSize } : d));

      const reader = response.body?.getReader();
      if (!reader) throw new Error('امکان خواندن پاسخ وجود ندارد');

      let received = response.status === 200 ? 0 : item.downloadedSize;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        const tracker = speedTrackers.current[id];
        if (tracker) {
          const now = Date.now();
          const dt = (now - tracker.lastTime) / 1000;
          let speed = 0;
          if (dt > 0.5) {
            speed = (received - tracker.lastBytes) / dt;
            tracker.lastTime = now;
            tracker.lastBytes = received;
          }

          const progress = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

          setDownloads(prev => prev.map(d => {
            if (d.id !== id) return d;
            return {
              ...d,
              downloadedSize: received,
              totalSize: total || d.totalSize,
              progress,
              speed,
            };
          }));
        }
      }

      // Build blob and trigger browser save
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

      setDownloads(prev => prev.map(d =>
        d.id === id ? { ...d, status: 'completed', progress: 100, completedAt: new Date().toISOString(), speed: 0 } : d
      ));

      if (!notifiedCompletedRef.current.has(id)) {
        notifiedCompletedRef.current.add(id);
        if (isDownloadNotificationEnabled(settings)) {
          notify({
            title: isEn ? 'Download complete' : 'دانلود کامل شد',
            body: item.filename,
          });
        }
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setDownloads(prev => prev.map(d => {
          if (d.id !== id) return d;
          if (d.status === 'cancelled') return d;
          return { ...d, status: 'paused', speed: 0 };
        }));
      } else {
        const msg = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
          ? 'خطا در دانلود، دکمهی «تلاش دوباره» را بزنید'
          : (err.message || 'خطا در دانلود، دکمهی «تلاش دوباره» را بزنید');

        setDownloads(prev => prev.map(d =>
          d.id === id ? { ...d, status: 'error', errorMessage: msg, speed: 0 } : d
        ));
      }
    } finally {
      delete abortControllers.current[id];
      delete speedTrackers.current[id];
    }
  }, []);

  // Sequential queue: all pending items auto-advance one by one
  useEffect(() => {
    const anyActive = downloads.some(d => d.status === 'downloading' || (d.status === 'pending' && dispatchedToMainRef.current.has(d.id)));
    if (anyActive) return;
    const nextPending = downloads.find(d => d.status === 'pending' && !dispatchedToMainRef.current.has(d.id));
    if (nextPending) { startDownload(nextPending.id); }
  }, [downloads, startDownload]);

  /* ─── Pause ─── */
  const pauseDownload = (id: string) => {
    dispatchedToMainRef.current.delete(id);
    const desktopDownloads = getDesktopDownloads();
    if (desktopDownloads) {
      desktopDownloads.pause(id);
      setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'paused', speed: 0 } : d));
    } else {
      abortControllers.current[id]?.abort();
    }
  };

  /* ─── Cancel ─── */
  const cancelDownload = (id: string) => {
    dispatchedToMainRef.current.delete(id);
    const desktopDownloads = getDesktopDownloads();
    if (desktopDownloads) {
      desktopDownloads.cancel(id);
    } else {
      abortControllers.current[id]?.abort();
    }
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, status: 'cancelled', speed: 0, progress: 0, downloadedSize: 0 } : d));
  };

  /* ─── Retry ─── */
  const retryDownload = async (id: string) => {
    dispatchedToMainRef.current.delete(id);
    const desktopDownloads = getDesktopDownloads();
    if (desktopDownloads) {
      try {
        await desktopDownloads.cancel(id);
      } catch {}
    }
    setDownloads(prev => prev.map(d =>
      d.id === id ? { ...d, status: 'pending', progress: 0, downloadedSize: 0, errorMessage: undefined, speed: 0 } : d
    ));
  };

  /* ─── Delete ─── */
  const deleteDownload = (id: string) => {
    dispatchedToMainRef.current.delete(id);
    const desktopDownloads = getDesktopDownloads();
    if (desktopDownloads) {
      desktopDownloads.remove(id);
    } else {
      abortControllers.current[id]?.abort();
      delete abortControllers.current[id];
      delete speedTrackers.current[id];
    }
    setDownloads(prev => prev.filter(d => d.id !== id));
  };

  /* ─── Clear Completed ─── */
  const clearCompleted = () => {
    setDownloads(prev => prev.filter(d => d.status !== 'completed'));
  };

  /* ─── Copy Link ─── */
  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ─── Filtered & Sorted ─── */
  const filtered = downloads
    .filter(d => {
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (filterCategory !== 'all' && d.category !== filterCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return d.filename.toLowerCase().includes(q) || d.url.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0);
      if (sortBy === 'progress') return b.progress - a.progress;
      if (sortBy === 'size') return (b.totalSize || 0) - (a.totalSize || 0);
      return 0;
    });

  /* ─── Stats ─── */
  const stats = {
    total: downloads.length,
    downloading: downloads.filter(d => d.status === 'downloading').length,
    completed: downloads.filter(d => d.status === 'completed').length,
    pending: downloads.filter(d => d.status === 'pending').length,
    error: downloads.filter(d => d.status === 'error').length,
    totalDownloaded: downloads.reduce((sum, d) => sum + (d.status === 'completed' ? d.totalSize : d.downloadedSize), 0),
  };

  const StatusIcon = ({ status }: { status: DownloadStatus }) => {
    switch (status) {
      case 'downloading': return <Zap className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />;
      case 'completed':   return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'paused':      return <Pause className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':       return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'cancelled':   return <X className="w-4 h-4 text-slate-400 shrink-0" />;
      default:            return <Clock className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  const categoryLabelMap: Record<DownloadCategory, string> = {
    video: isEn ? 'Video' : 'ویدیو',
    music: isEn ? 'Music' : 'موسیقی',
    image: isEn ? 'Image' : 'تصویر',
    document: isEn ? 'Document' : 'سند',
    archive: isEn ? 'Archive' : 'فشرده',
    software: isEn ? 'Software' : 'نرم‌افزار',
    other: isEn ? 'Other' : 'سایر',
  };

  const getStatusLabel = (status: DownloadStatus) => {
    const map: Record<DownloadStatus, string> = {
      pending: isEn ? 'Pending' : 'در انتظار',
      downloading: isEn ? 'Downloading' : 'در حال دانلود',
      paused: isEn ? 'Paused' : 'متوقف',
      completed: isEn ? 'Completed' : 'تکمیل شده',
      error: isEn ? 'Error' : 'خطا',
      cancelled: isEn ? 'Cancelled' : 'لغو شده',
    };
    return map[status] || status;
  };

  const StatusLabel = ({ status }: { status: DownloadStatus }) => {
    return <span>{getStatusLabel(status)}</span>;
  };

  const STATUS_OPTIONS: { key: DownloadStatus | 'all'; label: string }[] = [
    { key: 'all', label: isEn ? 'All' : 'همه' },
    { key: 'downloading', label: isEn ? 'Downloading' : 'در حال دانلود' },
    { key: 'completed', label: isEn ? 'Completed' : 'تکمیل شده' },
    { key: 'paused', label: isEn ? 'Paused' : 'متوقف' },
    { key: 'pending', label: isEn ? 'Pending' : 'در انتظار' },
    { key: 'error', label: isEn ? 'Error' : 'خطا' },
  ];

  const SORT_OPTIONS: { key: 'date' | 'progress' | 'size'; label: string }[] = [
    { key: 'date', label: isEn ? 'Sort: Newest' : 'ترتیب: جدیدترین' },
    { key: 'progress', label: isEn ? 'Sort: Progress' : 'ترتیب: پیشرفت' },
    { key: 'size', label: isEn ? 'Sort: Size' : 'ترتیب: حجم' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="h-full flex flex-col gap-5 p-4 sm:p-6 overflow-y-auto"
    >


      {/* Add Form Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] p-5 sm:p-6 shadow-2xl space-y-4 text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-[var(--text)]">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <span>{isEn ? 'Add New Download Link' : 'افزودن لینک جدید برای دانلود'}</span>
                </div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-2 rounded-xl text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)]">
                  <button
                    type="button"
                    onClick={() => setAddMode('single')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${addMode === 'single' ? 'bg-blue-600 text-white' : 'text-[var(--text2)]'}`}
                  >
                    {isEn ? 'Single Link' : 'لینک تکی'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('pattern')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${addMode === 'pattern' ? 'bg-blue-600 text-white' : 'text-[var(--text2)]'}`}
                  >
                    {isEn ? 'Part Range (*)' : 'بازه پارتها (الگو)'}
                  </button>
                </div>

                {addMode === 'single' && (
                  <div>
                    <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">
                      {isEn ? 'Direct File URL:' : 'آدرس فایل یا لینک مستقیم (URL):'}
                    </label>
                    <input
                      type="url"
                      value={newUrl}
                      onChange={e => setNewUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddDownload()}
                      placeholder="https://example.com/file.mp4"
                      className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs sm:text-sm placeholder:text-[var(--text3)] focus:outline-none focus:border-blue-500 transition"
                      dir="ltr"
                      autoFocus
                    />
                  </div>
                )}

                {addMode === 'pattern' && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">
                        {isEn ? 'URL pattern (use * instead of the part number):' : 'الگوی آدرس (بهجای شمارهی پارت از * استفاده کن):'}
                      </label>
                      <input
                        type="text"
                        value={patternUrl}
                        onChange={e => setPatternUrl(e.target.value)}
                        placeholder="https://example.com/file.part*.rar"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs sm:text-sm placeholder:text-[var(--text3)] focus:outline-none focus:border-blue-500 transition"
                        dir="ltr"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">{isEn ? 'From:' : 'از پارت:'}</label>
                        <input
                          type="number"
                          value={patternFrom}
                          onChange={e => setPatternFrom(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs text-center focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">{isEn ? 'To:' : 'تا پارت:'}</label>
                        <input
                          type="number"
                          value={patternTo}
                          onChange={e => setPatternTo(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs text-center focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                  </div>
                )}



                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Custom Styled Category Dropdown */}
                  <div className="relative" ref={categoryDropdownRef}>
                    <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">
                      {isEn ? 'File Category:' : 'دسته‌بندی فایل:'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs font-bold focus:outline-none focus:border-blue-500 flex items-center justify-between cursor-pointer transition"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {newCategory === 'other' ? (
                          <>{isEn ? '🎯 Auto Detect Category' : '🎯 تشخیص خودکار دسته‌بندی'}</>
                        ) : (
                          <>
                            {React.createElement(CATEGORY_CONFIG[newCategory].icon, { className: 'w-4 h-4 text-blue-400' })}
                            <span>{categoryLabelMap[newCategory]}</span>
                          </>
                        )}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-[var(--text3)] transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isCategoryDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 left-0 top-full mt-1 z-50 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xl p-1.5 space-y-0.5 max-h-56 overflow-y-auto"
                        >
                          <button
                            type="button"
                            onClick={() => { setNewCategory('other'); setIsCategoryDropdownOpen(false); }}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between text-right transition cursor-pointer ${
                              newCategory === 'other'
                                ? 'bg-blue-600 text-white'
                                : 'text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
                            }`}
                          >
                            <span>{isEn ? '🎯 Auto Detect Category' : '🎯 تشخیص خودکار دسته‌بندی'}</span>
                            {newCategory === 'other' && <Check className="w-3.5 h-3.5" />}
                          </button>
                          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                            const IconComp = cfg.icon;
                            const isSelected = newCategory === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => { setNewCategory(key as DownloadCategory); setIsCategoryDropdownOpen(false); }}
                                className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between text-right transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <IconComp className="w-4 h-4" />
                                  <span>{categoryLabelMap[key as DownloadCategory]}</span>
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text2)] mb-1.5">
                      {isEn ? 'Description (Optional):' : 'توضیحات (اختیاری):'}
                    </label>
                    <input
                      type="text"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder={isEn ? "Note..." : "یادداشت..."}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs placeholder:text-[var(--text3)] focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--sidebar-hover)] text-[var(--text2)] text-xs font-bold hover:bg-[var(--border)] transition cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  onClick={addMode === 'single' ? handleAddDownload : handleAddPatternRange}
                  disabled={addMode === 'single' ? !newUrl.trim() : (!patternUrl.includes('*') || patternFrom === '' || patternTo === '')}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isEn ? 'Start Download' : 'شروع دانلود'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Duplicate URL Confirmation Modal */}
      <AnimatePresence>
        {duplicatePrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] p-5 sm:p-6 shadow-2xl space-y-4 text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-[var(--text)]">
                    {isEn ? 'Duplicate Link' : 'لینک تکراری'}
                  </h3>
                  <p className="text-xs text-[var(--text3)] mt-0.5 truncate max-w-[280px]" dir="ltr">
                    {duplicatePrompt.url}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-xs text-[var(--text)] leading-relaxed">
                {isEn
                  ? `This link is already in your list (status: ${getStatusLabel(duplicatePrompt.existingStatus)}). Download it again?`
                  : `این لینک قبلاً در لیست هست (وضعیت: ${getStatusLabel(duplicatePrompt.existingStatus)}). دوباره دانلود شود؟`}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setDuplicatePrompt(null)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--sidebar-hover)] text-[var(--text2)] text-xs font-bold hover:bg-[var(--border)] transition cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="button"
                  onClick={() => confirmAddDownload(duplicatePrompt.url)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black transition cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Download again' : 'دانلود دوباره'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filters & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text3)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isEn ? "Search in downloads..." : "جستجو در دانلودها..."}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs placeholder:text-[var(--text3)] focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Custom Styled Status Dropdown */}
          <div className="relative shrink-0" ref={statusDropdownRef}>
            <button
              type="button"
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs font-bold focus:outline-none flex items-center gap-2 cursor-pointer transition hover:border-blue-500/50"
            >
              <Filter className="w-3.5 h-3.5 text-[var(--text3)]" />
              <span>{STATUS_OPTIONS.find(o => o.key === filterStatus)?.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--text3)] transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isStatusDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 z-50 min-w-40 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xl p-1.5 space-y-0.5"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setFilterStatus(opt.key); setIsStatusDropdownOpen(false); }}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between text-right transition cursor-pointer ${
                        filterStatus === opt.key
                          ? 'bg-blue-600 text-white'
                          : 'text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {filterStatus === opt.key && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Custom Styled Sort Dropdown */}
          <div className="relative shrink-0" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className="px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text)] text-xs font-bold focus:outline-none flex items-center gap-2 cursor-pointer transition hover:border-blue-500/50"
            >
              <span>{SORT_OPTIONS.find(o => o.key === sortBy)?.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--text3)] transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isSortDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 z-50 min-w-40 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xl p-1.5 space-y-0.5"
                >
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setSortBy(opt.key); setIsSortDropdownOpen(false); }}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between text-right transition cursor-pointer ${
                        sortBy === opt.key
                          ? 'bg-blue-600 text-white'
                          : 'text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.key && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Clear Completed (only when completed > 0) */}
          {stats.completed > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
              title={isEn ? 'Clear Completed' : 'پاک‌سازی تکمیل‌شده‌ها'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Clear Completed' : 'پاک‌سازی تکمیل‌شده‌ها'}</span>
            </button>
          )}

          {/* Add New Download Button */}
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-blue-500/20 active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEn ? 'Add New Download' : 'افزودن دانلود جدید'}</span>
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer shrink-0 ${
            filterCategory === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-[var(--text3)] hover:text-[var(--text)] bg-[var(--card-bg)] border border-[var(--border)]'
          }`}
        >
          {isEn ? 'All Categories' : 'همه دسته‌ها'}
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([catKey, cfg]) => (
          <button
            key={catKey}
            onClick={() => setFilterCategory(catKey as DownloadCategory)}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              filterCategory === catKey
                ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                : 'text-[var(--text3)] hover:text-[var(--text)] bg-[var(--card-bg)] border border-[var(--border)]'
            }`}
          >
            <cfg.icon className="w-3.5 h-3.5" />
            <span>{categoryLabelMap[catKey as DownloadCategory]}</span>
          </button>
        ))}
      </div>

      {/* Downloads List */}
      <div className="flex-1 space-y-3 min-h-0">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 bg-[var(--card-bg)] rounded-2xl border border-dashed border-[var(--border)] text-[var(--text3)] text-center p-6 space-y-2"
            >
              <Download className="w-12 h-12 text-blue-500/30 mx-auto" />
              <p className="text-xs font-black text-[var(--text)]">{isEn ? 'No downloads found in this section' : 'هیچ دانلودی در این بخش یافت نشد'}</p>
              <p className="text-[11px] text-[var(--text3)] max-w-sm">
                {isEn ? 'Add a new link or adjust search and status filters.' : 'لینک جدیدی اضافه کنید یا فیلترهای جستجو و وضعیت را تغییر دهید.'}
              </p>
            </motion.div>
          ) : (
            filtered.map((item, idx) => {
              const CatIcon = CATEGORY_CONFIG[item.category]?.icon || File;
              const remaining = item.speed > 0 && item.totalSize > item.downloadedSize
                ? (item.totalSize - item.downloadedSize) / item.speed
                : Infinity;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-4 hover:border-blue-500/40 transition-all shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${CATEGORY_CONFIG[item.category]?.color || 'text-slate-400 bg-slate-500/10 border-slate-500/20'}`}>
                      <CatIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-[var(--text)] truncate" title={item.filename}>
                            {item.filename}
                          </h4>
                          <p className="text-[11px] text-[var(--text3)] mt-0.5 truncate font-mono" dir="ltr">{item.url}</p>
                          {item.description && (
                            <p className="text-[11px] text-[var(--text2)] mt-1 font-medium bg-[var(--sidebar-hover)] px-2 py-0.5 rounded-md inline-block">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {item.status === 'downloading' && (
                            <button
                              onClick={() => pauseDownload(item.id)}
                              className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition cursor-pointer"
                              title={isEn ? "Pause" : "توقف موقت"}
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}

                          {item.status === 'paused' && (
                            <button
                              onClick={() => startDownload(item.id)}
                              className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition cursor-pointer"
                              title={isEn ? "Resume" : "ادامه دانلود"}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {item.status === 'error' && (
                            <button
                              onClick={() => retryDownload(item.id)}
                              className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition cursor-pointer"
                              title={isEn ? "Retry" : "تلاش مجدد"}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {item.status !== 'downloading' && item.status !== 'completed' && (
                            <button
                              onClick={() => cancelDownload(item.id)}
                              className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition cursor-pointer"
                              title={isEn ? "Cancel" : "لغو"}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}

                          {item.status === 'completed' && !!getDesktopDownloads()?.showInFolder && (
                            <button
                              onClick={() => getDesktopDownloads()?.showInFolder(item.id)}
                              className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition cursor-pointer"
                              title={isEn ? "Show in folder" : "نمایش در پوشه"}
                            >
                              <Folder className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => deleteDownload(item.id)}
                            className="p-2 rounded-xl hover:bg-red-500/10 text-[var(--text3)] hover:text-red-500 transition cursor-pointer"
                            title={isEn ? "Delete this download" : "حذف این دانلود"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Status indicator row */}
                      <div className="mt-3 flex items-center justify-between text-[11px] font-bold mb-1.5 flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={item.status} />
                          <StatusLabel status={item.status} />
                          {item.errorMessage && (
                            <span className="text-red-400 text-[10px] font-normal mr-1 truncate max-w-xs" title={item.errorMessage}>
                              — {item.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar & Large Percentage */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-[var(--input-bg)] border border-[var(--input-border)] overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              item.status === 'error' ? 'bg-red-500' :
                              item.status === 'completed' ? 'bg-emerald-500' :
                              'bg-gradient-to-r from-blue-500 to-indigo-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <span dir="ltr" className={`text-sm sm:text-base font-black tabular-nums font-mono shrink-0 ${
                          item.status === 'completed' ? 'text-emerald-500' :
                          item.status === 'error' ? 'text-red-400' :
                          'text-blue-500'
                        }`}>
                          {item.progress}%
                        </span>
                      </div>

                      {/* Metric Blocks under Progress Bar */}
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        {item.status === 'downloading' && (
                          <>
                            {/* Volume */}
                            <div className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] flex flex-col">
                              <span className="text-[10px] text-[var(--text3)] font-medium">{isEn ? 'Size' : 'حجم'}</span>
                              <span dir="ltr" className="text-xs font-bold text-[var(--text)] tabular-nums font-mono">
                                {formatBytes(item.downloadedSize)} / {item.totalSize > 0 ? formatBytes(item.totalSize) : '؟'}
                              </span>
                            </div>

                            {/* Speed */}
                            <div className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] flex flex-col">
                              <span className="text-[10px] text-[var(--text3)] font-medium">{isEn ? 'Speed' : 'سرعت'}</span>
                              <span dir="ltr" className="text-xs font-bold text-[var(--text)] tabular-nums font-mono">
                                {formatSpeed(item.speed)}
                              </span>
                            </div>

                            {/* Remaining */}
                            <div className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] flex flex-col">
                              <span className="text-[10px] text-[var(--text3)] font-medium">{isEn ? 'Remaining' : 'باقی‌مانده'}</span>
                              <span dir="ltr" className="text-xs font-bold text-[var(--text)] tabular-nums font-mono">
                                {formatDuration(remaining)}
                              </span>
                            </div>
                          </>
                        )}

                        {item.status === 'completed' && (
                          <>
                            {/* Final Size */}
                            <div className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] flex flex-col">
                              <span className="text-[10px] text-[var(--text3)] font-medium">{isEn ? 'Size' : 'حجم'}</span>
                              <span dir="ltr" className="text-xs font-bold text-[var(--text)] tabular-nums font-mono">
                                {formatBytes(item.totalSize || item.downloadedSize)}
                              </span>
                            </div>

                            {/* Date */}
                            <div className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] flex flex-col">
                              <span className="text-[10px] text-[var(--text3)] font-medium">{isEn ? 'Date' : 'تاریخ'}</span>
                              <span dir="ltr" className="text-xs font-bold text-[var(--text)] tabular-nums font-mono">
                                {isEn ? new Date(item.completedAt || item.createdAt).toLocaleDateString('en-US') : formatShamsi(new Date(item.completedAt || item.createdAt))}
                              </span>
                            </div>
                          </>
                        )}

                        {(item.status === 'paused' || item.status === 'pending' || item.status === 'error' || item.status === 'cancelled') && (
                          <div className="px-2.5 py-1 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] flex flex-col">
                            <span className="text-[10px] text-[var(--text3)] font-medium">{isEn ? 'Size' : 'حجم'}</span>
                            <span dir="ltr" className="text-xs font-bold text-[var(--text)] tabular-nums font-mono">
                              {formatBytes(item.downloadedSize)} / {item.totalSize > 0 ? formatBytes(item.totalSize) : '؟'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Footer Meta */}
                      <div className="flex items-center justify-between mt-2.5 text-[10px] text-[var(--text3)] font-medium flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--text2)]">{categoryLabelMap[item.category] || item.category}</span>
                          <span>•</span>
                          <span>{isEn ? 'Added:' : 'ثبت:'} {isEn ? new Date(item.createdAt).toLocaleDateString('en-US') : formatShamsi(new Date(item.createdAt))}</span>
                          {item.completedAt && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-500 font-bold">{isEn ? 'Completed:' : 'تکمیل:'} {isEn ? new Date(item.completedAt).toLocaleDateString('en-US') : formatShamsi(new Date(item.completedAt))}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyLink(item.id, item.url)}
                            className="px-2 py-1 rounded-lg bg-[var(--sidebar-hover)] hover:bg-[var(--border)] text-[var(--text2)] transition cursor-pointer flex items-center gap-1"
                            title={isEn ? "Copy Link" : "کپی لینک"}
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedId === item.id ? (isEn ? 'Copied' : 'کپی شد') : (isEn ? 'Copy Link' : 'کپی لینک')}</span>
                          </button>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition cursor-pointer flex items-center gap-1 font-bold"
                            title={isEn ? "Direct Download" : "دانلود مستقیم"}
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{isEn ? 'Direct Download' : 'دانلود مستقیم'}</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Stats Bar */}
      <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-2.5 bg-[var(--card-bg)]/95 backdrop-blur-md border-t border-[var(--border)] shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3.5 sm:gap-5 flex-wrap">
          <div className="flex items-center gap-1.5 text-[var(--text2)]">
            <Download className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[11px] font-medium">{isEn ? 'Total:' : 'کل دانلودها:'}</span>
            <span dir="ltr" className="font-mono font-bold text-[var(--text)]">{stats.total}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[var(--text2)]">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] font-medium">{isEn ? 'Downloading:' : 'در حال دانلود:'}</span>
            <span dir="ltr" className="font-mono font-bold text-[var(--text)]">{stats.downloading}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[var(--text2)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-medium">{isEn ? 'Completed:' : 'تکمیل‌شده:'}</span>
            <span dir="ltr" className="font-mono font-bold text-[var(--text)]">{stats.completed}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[var(--text2)]">
            <HardDrive className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[11px] font-medium">{isEn ? 'Volume:' : 'حجم دانلودشده:'}</span>
            <span dir="ltr" className="font-mono font-bold text-[var(--text)]">{formatBytes(stats.totalDownloaded)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text3)] font-medium">
          <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{isEn ? 'Files are saved in the Downloads folder' : 'فایل‌ها در پوشه‌ی Downloads ذخیره می‌شوند'}</span>
        </div>
      </div>
    </motion.div>
  );
}


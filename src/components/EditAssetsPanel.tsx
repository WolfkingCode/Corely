/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Bookmark, 
  Search, 
  Video, 
  Music, 
  Filter, 
  Trash2, 
  Clapperboard, 
  X,
  ExternalLink,
  Upload,
  FileUp,
  Image as ImageIcon,
  CheckCircle2,
  ZoomIn,
  FolderPlus,
  Folder,
  Pencil,
  AlertCircle,
  FolderSync,
  Link2,
  FileText,
  Files,
  Package,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  ChevronLeft,
  Tag,
  Plus
} from 'lucide-react';
import { EditAsset, EditPackage, AppSettings } from '../types';
import { 
  dbGetEditAssets, 
  dbSaveEditAssets, 
  dbPutMedia, 
  dbGetMedia, 
  dbDeleteMedia,
  makeImageThumbnailBlob,
  runSequentially
} from '../lib/utils';
import {
  getMediaObjectUrl,
  releaseMediaObjectUrl,
  revokeAllMediaObjectUrls,
  setProtectedOriginalIds,
  libraryMediaUrl
} from '../lib/mediaUrlCache';
import { LibraryEntry } from '../declarations';
import Select from './Select';

type DesktopLibrary = {
  pickFiles(): Promise<{ entries: LibraryEntry[] }>;
  pickFolder(): Promise<{ entries: LibraryEntry[]; truncated: boolean }>;
  status(ids: string[]): Promise<Record<string, 'ok' | 'missing'>>;
  open(id: string): Promise<{ ok: boolean; error?: string }>;
  showInFolder(id: string): Promise<{ ok: boolean; error?: string }>;
  relink(id: string, kind?: 'video' | 'audio' | 'image'): Promise<{ ok: boolean }>;
  relinkFolder(items: { id: string; name: string; size?: number }[]): Promise<{ relinked: number; total: number }>;
  forget(ids: string[]): Promise<{ ok: boolean }>;
  clearAll(): Promise<{ ok: boolean }>;
};

const getDesktopLibrary = (): DesktopLibrary | undefined => {
  return typeof window !== 'undefined' ? (window as any).corelyDesktop?.library : undefined;
};

interface EditAssetsPanelProps {
  key?: string;
  onOpenLightbox?: (src: string) => void;
  settings?: AppSettings;
}

const DEFAULT_ASSETS: EditAsset[] = [];

// Assets with a mediaId or libraryId keep only light metadata in persistence; url is empty string.
const toPersistable = (a: EditAsset): EditAsset => {
  if (a.libraryId || a.mediaId) {
    return {
      ...a,
      url: '',
      thumbnailUrl: a.thumbMediaId || a.type === 'image' || (a.thumbnailUrl && a.thumbnailUrl.startsWith('blob:')) ? undefined : a.thumbnailUrl,
    };
  }
  return a;
};

const formatMediaDuration = (totalSeconds: number): string => {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

const probeMedia = (
  kind: 'video' | 'audio',
  src: string
): Promise<{ thumbnailBlob?: Blob; duration?: string }> =>
  new Promise((resolve) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio') as HTMLVideoElement | HTMLAudioElement;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: { thumbnailBlob?: Blob; duration?: string }) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      resolve(result);
    };
    timer = setTimeout(() => finish({}), 6000);
    el.preload = 'metadata';
    el.muted = true;
    if (src.startsWith('corely-media:')) {
      el.crossOrigin = 'anonymous';
    }
    el.onerror = () => finish({});
    el.onloadedmetadata = () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 0;
      const durationText = dur > 0 ? formatMediaDuration(dur) : undefined;
      if (kind === 'audio') {
        finish({ duration: durationText });
        return;
      }
      const video = el as HTMLVideoElement;
      video.onseeked = () => {
        try {
          const maxW = 480;
          const srcW = video.videoWidth || maxW;
          const srcH = video.videoHeight || 360;
          const scale = Math.min(1, maxW / srcW);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(srcW * scale));
          canvas.height = Math.max(1, Math.round(srcH * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            finish({ duration: durationText });
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (b) => {
              finish({ thumbnailBlob: b || undefined, duration: durationText });
            },
            'image/jpeg',
            0.75
          );
        } catch {
          finish({ duration: durationText });
        }
      };
      video.currentTime = dur > 0.4 ? Math.min(1, dur * 0.1) : 0.1;
    };
    el.src = src;
  });

interface LazyThumbProps {
  asset: EditAsset;
  className?: string;
  alt?: string;
  objectFit?: 'cover' | 'contain';
}

function LazyThumb({ asset, className = '', alt = '', objectFit = 'cover' }: LazyThumbProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [isNear, setIsNear] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNear) return;
    let isCancelled = false;

    const load = async () => {
      let resolvedSrc: string | null = null;
      if (asset.thumbMediaId) {
        resolvedSrc = await getMediaObjectUrl(asset.thumbMediaId, 'thumb');
      } else if (asset.libraryId && asset.type === 'image') {
        resolvedSrc = libraryMediaUrl(asset.libraryId);
      } else if (asset.type === 'image' && asset.mediaId) {
        resolvedSrc = await getMediaObjectUrl(asset.mediaId, 'thumb');
      } else if (asset.thumbnailUrl) {
        resolvedSrc = asset.thumbnailUrl;
      } else if (asset.url) {
        resolvedSrc = asset.url;
      }

      if (!isCancelled && resolvedSrc) {
        setSrc(resolvedSrc);
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [isNear, asset.thumbMediaId, asset.mediaId, asset.libraryId, asset.thumbnailUrl, asset.url, asset.type]);

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  if (!src) {
    return (
      <div
        ref={containerRef}
        className={`w-full h-full bg-black/60 flex items-center justify-center ${className}`}
      />
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <img
        src={src}
        alt={alt || asset.title}
        loading="lazy"
        decoding="async"
        className={`w-full h-full ${fitClass} ${className}`}
        onError={() => setSrc(null)}
      />
    </div>
  );
}

function AssetMosaic({ assets, fallbackIcon }: { assets: EditAsset[]; fallbackIcon: React.ReactNode }) {
  const previewable = assets.filter(a => a.type === 'image' || a.type === 'video').slice(0, 4);
  if (previewable.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-purple-400/60">{fallbackIcon}</div>;
  }
  const cols = previewable.length === 1 ? 'grid-cols-1' : previewable.length === 3 ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={`grid ${cols} ${previewable.length === 4 ? 'grid-rows-2' : ''} h-full gap-0.5`}>
      {previewable.map((a) => (
        <div key={a.id} className="relative overflow-hidden w-full h-full">
          <LazyThumb asset={a} className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function useChunkedList<T>(items: T[], resetKey: string, chunk = 48) {
  const [visibleCount, setVisibleCount] = useState(chunk);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(chunk);
  }, [resetKey, chunk]);

  const hasMore = visibleCount < items.length;

  const showMore = () => {
    setVisibleCount((prev) => Math.min(prev + chunk, items.length));
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + chunk, items.length));
        }
      },
      { rootMargin: '800px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, items.length, chunk]);

  const visible = items.slice(0, visibleCount);

  return { visible, hasMore, showMore, sentinelRef };
}

export default function EditAssetsPanel({ onOpenLightbox, settings }: EditAssetsPanelProps = {}) {
  const isEn = settings?.language === 'en';
  const [assets, setAssets] = useState<EditAsset[]>(() => {
    try {
      const saved = localStorage.getItem('v3_edit_assets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasImages = parsed.some((a: EditAsset) => a.type === 'image');
          if (!hasImages) {
            const defaultImages = DEFAULT_ASSETS.filter(a => a.type === 'image');
            return [...parsed, ...defaultImages];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load edit assets:', e);
    }
    return DEFAULT_ASSETS;
  });

  const assetsRef = useRef<EditAsset[]>(assets);
  assetsRef.current = assets;
  const hasLoadedRef = useRef(false);
  const [activePreviewMediaId, setActivePreviewMediaId] = useState<string | null>(null);

  const isLinked = !!getDesktopLibrary();
  const [missingIds, setMissingIds] = useState<Set<string>>(() => new Set());
  const [libraryToast, setLibraryToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewProgress, setPreviewProgress] = useState<{ current: number; total: number } | null>(null);

  const showNotification = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setLibraryToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setLibraryToast(null);
      toastTimerRef.current = null;
    }, 4000);
  };

  // Pending import and naming modal state
  const [pendingImport, setPendingImport] = useState<{
    entries: LibraryEntry[];
    truncated: boolean;
    packageId?: string;
  } | null>(null);
  const [singleCustomTitle, setSingleCustomTitle] = useState('');
  const [multiNamingMode, setMultiNamingMode] = useState<'filename' | 'prefix'>('filename');
  const [multiPrefix, setMultiPrefix] = useState('');
  const singleTitleInputRef = useRef<HTMLInputElement>(null);
  const multiPrefixInputRef = useRef<HTMLInputElement>(null);

  const handleCancelPendingImport = useCallback(() => {
    if (pendingImport && pendingImport.entries.length > 0) {
      const ids = pendingImport.entries.map(e => e.id);
      const lib = getDesktopLibrary();
      if (lib?.forget) {
        lib.forget(ids).catch(() => {});
      }
    }
    setPendingImport(null);
  }, [pendingImport]);

  // Global Esc key listener for naming modal
  useEffect(() => {
    if (!pendingImport) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelPendingImport();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingImport, handleCancelPendingImport]);

  // Auto-focus effect for inputs
  useEffect(() => {
    if (!pendingImport) return;
    if (pendingImport.entries.length === 1) {
      setTimeout(() => {
        singleTitleInputRef.current?.focus();
        singleTitleInputRef.current?.select();
      }, 50);
    } else if (pendingImport.entries.length > 1 && multiNamingMode === 'prefix') {
      setTimeout(() => {
        multiPrefixInputRef.current?.focus();
        multiPrefixInputRef.current?.select();
      }, 50);
    }
  }, [pendingImport, multiNamingMode]);

  const refreshLinkStatus = useCallback(async () => {
    const lib = getDesktopLibrary();
    if (!lib) return;
    const linked = assetsRef.current.filter(a => a.libraryId);
    if (linked.length === 0) {
      setMissingIds(new Set());
      return;
    }
    const newMissing = new Set<string>();
    const BATCH_SIZE = 1000;
    for (let i = 0; i < linked.length; i += BATCH_SIZE) {
      const slice = linked.slice(i, i + BATCH_SIZE);
      const idMap = new Map<string, string[]>();
      for (const a of slice) {
        if (!a.libraryId) continue;
        const list = idMap.get(a.libraryId) || [];
        list.push(a.id);
        idMap.set(a.libraryId, list);
      }
      const libIds = Array.from(idMap.keys());
      try {
        const statusMap = await lib.status(libIds);
        if (statusMap && typeof statusMap === 'object') {
          for (const [libId, st] of Object.entries(statusMap)) {
            if (st === 'missing') {
              const assetIds = idMap.get(libId);
              if (assetIds) {
                for (const aid of assetIds) {
                  newMissing.add(aid);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to check library status:', e);
      }
    }
    setMissingIds(newMissing);
  }, []);

  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio' | 'image' | 'bookmarked'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Media playback states (no autoplay on load)
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [mutedIds, setMutedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [localLightboxSrc, setLocalLightboxSrc] = useState<string | null>(null);

  // Modal State for adding new asset
  const [showAddModal, setShowAddModal] = useState(false);
  const [sourceMode, setSourceMode] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'video' | 'audio' | 'image'>('video');
  const [newCategory, setNewCategory] = useState('میم');
  const [newUrl, setNewUrl] = useState('');
  const [newThumbnail, setNewThumbnail] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_CATEGORIES = ['میم', 'گرین اسکرین', 'ساند افکت', 'ری‌اکشن', 'ترانزیشن', 'ویروسی'];
  const DEFAULT_CATEGORY_EN: Record<string, string> = {
    'میم': 'Meme',
    'گرین اسکرین': 'Green Screen',
    'ساند افکت': 'Sound Effect',
    'ری‌اکشن': 'Reaction',
    'ترانزیشن': 'Transition',
    'ویروسی': 'Viral',
  };
  const [categoryList, setCategoryList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('v3_edit_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((c: unknown) => typeof c === 'string' && c.trim());
      }
    } catch (e) {
      // ignore corrupted data
    }
    return DEFAULT_CATEGORIES;
  });
  const [categoryView, setCategoryView] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [importCategory, setImportCategory] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('v3_edit_categories', JSON.stringify(categoryList));
    } catch (e) {
      // ignore
    }
  }, [categoryList]);

  useEffect(() => {
    setSelectedCategory('همه');
    setCategoryView(false);
    setIsAddingCategory(false);
    setNewCategoryInput('');
  }, [activeTab]);

  const categoryLabel = (cat: string): string =>
    cat ? (isEn ? DEFAULT_CATEGORY_EN[cat] || cat : cat) : isEn ? 'Uncategorized' : 'بدون دسته‌بندی';

  // Default category preselected in the "add files" dialog
  useEffect(() => {
    if (!pendingImport) return;
    const first = pendingImport.entries[0];
    const preferred = selectedCategory !== 'همه' ? selectedCategory : first?.kind === 'audio' ? 'ساند افکت' : 'میم';
    setImportCategory(categoryList.includes(preferred) ? preferred : categoryList[0] ?? '');
  }, [pendingImport]);

  const handleSubmitCategory = () => {
    const name = newCategoryInput.trim().slice(0, 30);
    if (!name) return;
    if (!categoryList.includes(name)) setCategoryList(prev => [...prev, name]);
    setIsAddingCategory(false);
    setNewCategoryInput('');
  };

  const confirmDeleteCategory = () => {
    const cat = categoryToDelete;
    if (cat === null) return;
    setCategoryList(prev => prev.filter(c => c !== cat));
    const updated = assetsRef.current.map(a => (a.category === cat ? { ...a, category: '' } : a));
    setAssets(updated);
    persistAssetsNow(updated);
    if (selectedCategory === cat) setSelectedCategory('همه');
    setCategoryToDelete(null);
  };

  // Packages state (persisted to localStorage under 'v3_edit_packages')
  const [packages, setPackages] = useState<EditPackage[]>(() => {
    try {
      const saved = localStorage.getItem('v3_edit_packages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return [];
  });
  const [showPackages, setShowPackages] = useState<boolean>(false);
  const [packageToDelete, setPackageToDelete] = useState<EditPackage | null>(null);
  const [openPackageId, setOpenPackageId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('v3_edit_packages', JSON.stringify(packages));
    } catch (e) {
      // ignore
    }
  }, [packages]);

  // Modal for creating / renaming a package
  const [packageModal, setPackageModal] = useState<{ mode: 'create'; assignAssetId?: string } | { mode: 'rename'; pkg: EditPackage } | { mode: 'fromFolder'; entries: LibraryEntry[]; truncated: boolean; defaultName: string } | null>(null);
  const [packageNameInput, setPackageNameInput] = useState('');
  const packageNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!packageModal) return;
    if (packageModal.mode === 'rename') {
      setPackageNameInput(packageModal.pkg.name);
    } else if (packageModal.mode === 'fromFolder') {
      setPackageNameInput(packageModal.defaultName || '');
    } else {
      setPackageNameInput('');
    }
    setTimeout(() => {
      packageNameInputRef.current?.focus();
      packageNameInputRef.current?.select();
    }, 50);
  }, [packageModal]);

  const cancelPackageModal = useCallback(() => {
    if (packageModal && packageModal.mode === 'fromFolder' && packageModal.entries.length > 0) {
      const lib = getDesktopLibrary();
      if (lib?.forget) {
        lib.forget(packageModal.entries.map(e => e.id)).catch(() => {});
      }
    }
    setPackageModal(null);
  }, [packageModal]);

  useEffect(() => {
    if (!packageModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelPackageModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [packageModal, cancelPackageModal]);

  const handleSavePackage = async () => {
    const name = packageNameInput.trim().slice(0, 60);
    if (!name || !packageModal) return;
    if (packageModal.mode === 'create') {
      const newPkg: EditPackage = {
        id: 'pkg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name,
        createdAt: new Date().toISOString(),
      };
      setPackages(prev => [newPkg, ...prev]);
      const assignId = packageModal.assignAssetId;
      if (assignId) {
        setAssets(prev => prev.map(a => (a.id === assignId ? { ...a, packageId: newPkg.id } : a)));
      }
    } else if (packageModal.mode === 'rename') {
      const pkgId = packageModal.pkg.id;
      setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, name } : p));
    } else if (packageModal.mode === 'fromFolder') {
      const { entries, truncated } = packageModal;
      const newPkg: EditPackage = {
        id: 'pkg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        name,
        createdAt: new Date().toISOString(),
      };
      setPackages(prev => [newPkg, ...prev]);
      setPackageModal(null);
      setPackageNameInput('');
      setShowPackages(true);
      setOpenPackageId(newPkg.id);
      await processImportedEntries(entries, truncated, { mode: 'filename' }, newPkg.id);
      return;
    }
    setPackageModal(null);
    setPackageNameInput('');
  };

  const handleDeletePackage = (pkg: EditPackage) => {
    setPackageToDelete(pkg);
  };

  const confirmDeletePackage = () => {
    const pkg = packageToDelete;
    if (!pkg) return;
    const targets = assetsRef.current.filter(a => a.packageId === pkg.id);
    const targetIds = new Set(targets.map(a => a.id));
    const lib = getDesktopLibrary();
    const libraryIds: string[] = [];
    for (const t of targets) {
      if (t.mediaId) {
        dbDeleteMedia(t.mediaId);
        releaseMediaObjectUrl(t.mediaId);
      }
      if (t.thumbMediaId) {
        dbDeleteMedia(t.thumbMediaId);
        releaseMediaObjectUrl(t.thumbMediaId);
      }
      if (t.libraryId) libraryIds.push(t.libraryId);
    }
    if (libraryIds.length > 0 && lib?.forget) {
      lib.forget(libraryIds).catch(() => {});
    }
    if (playingId && targetIds.has(playingId)) setPlayingId(null);
    setMissingIds(prev => {
      const next = new Set(prev);
      targetIds.forEach(id => next.delete(id));
      return next;
    });
    setPackages(prev => prev.filter(p => p.id !== pkg.id));
    const updated = assetsRef.current.filter(a => a.packageId !== pkg.id);
    setAssets(updated);
    persistAssetsNow(updated);
    if (openPackageId === pkg.id) {
      setOpenPackageId(null);
    }
    setPackageToDelete(null);
  };

  useEffect(() => {
    if (!packageToDelete) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        setPackageToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [packageToDelete]);

  const [initialLoaded, setInitialLoaded] = useState(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistAssetsNow = (list: EditAsset[]) => {
    if (!hasLoadedRef.current) return;
    const persistable = list.map(toPersistable);
    dbSaveEditAssets(persistable);
    try {
      localStorage.setItem('v3_edit_assets', JSON.stringify(persistable));
    } catch (e) {
      // Quota exceeded in localStorage - safely ignored since data is persisted in IndexedDB
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      let source: EditAsset[] = assetsRef.current;
      try {
        const dbAssets = await dbGetEditAssets();
        if (dbAssets && Array.isArray(dbAssets) && dbAssets.length > 0) {
          source = dbAssets;
        }
      } catch (e) {
        console.error('Failed to load edit assets from IndexedDB:', e);
      }
      if (!isMounted) return;
      hasLoadedRef.current = true;
      setAssets(source);
      setInitialLoaded(true);
    })();
    return () => {
      isMounted = false;
      revokeAllMediaObjectUrls();
    };
  }, []);

  // Check library status after initial load
  useEffect(() => {
    if (initialLoaded && isLinked) {
      refreshLinkStatus();
    }
  }, [initialLoaded, isLinked, refreshLinkStatus]);

  // Window focus listener with 1s debounce
  useEffect(() => {
    if (!isLinked) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleFocus = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshLinkStatus();
      }, 1000);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      if (timer) clearTimeout(timer);
    };
  }, [isLinked, refreshLinkStatus]);

  // Protect playing and preview media IDs in LRU cache
  useEffect(() => {
    const protectedIds: string[] = [];
    if (playingId) {
      const playingAsset = assets.find(a => a.id === playingId);
      if (playingAsset?.mediaId) protectedIds.push(playingAsset.mediaId);
    }
    if (activePreviewMediaId) {
      protectedIds.push(activePreviewMediaId);
    }
    setProtectedOriginalIds(protectedIds);
  }, [playingId, activePreviewMediaId, assets]);

  // Debounced save (approx 600ms)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistAssetsNow(assets);
      persistTimerRef.current = null;
    }, 600);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [assets]);

  // Immediate save on unmount and pagehide
  useEffect(() => {
    const handlePageHide = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistAssetsNow(assetsRef.current);
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistAssetsNow(assetsRef.current);
    };
  }, []);

  // One-time migration for legacy assets (image/video with mediaId but without thumbMediaId and without noThumb)
  useEffect(() => {
    if (!initialLoaded) return;
    let isCancelled = false;

    const migrate = async () => {
      const candidates = assetsRef.current.filter(
        a => a.mediaId && !a.thumbMediaId && !a.noThumb && (a.type === 'image' || (a.type === 'video' && a.thumbnailUrl?.startsWith('data:')))
      );
      if (candidates.length === 0) return;

      const scheduleIdle = (): Promise<void> =>
        new Promise((resolve) => {
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => resolve());
          } else {
            setTimeout(resolve, 50);
          }
        });

      const pendingUpdates: { id: string; thumbMediaId?: string; noThumb?: boolean }[] = [];

      const flushBatch = () => {
        if (pendingUpdates.length === 0) return;
        const batch = [...pendingUpdates];
        pendingUpdates.length = 0;
        const updateMap = new Map(batch.map(u => [u.id, u]));
        setAssets(prev =>
          prev.map(a => {
            const u = updateMap.get(a.id);
            if (!u) return a;
            return {
              ...a,
              ...(u.thumbMediaId ? { thumbMediaId: u.thumbMediaId, thumbnailUrl: undefined } : {}),
              ...(u.noThumb ? { noThumb: true } : {}),
            };
          })
        );
      };

      for (const item of candidates) {
        if (isCancelled) break;
        await scheduleIdle();
        if (isCancelled) break;

        await runSequentially(async () => {
          if (isCancelled) return;
          try {
            const tId = `${item.mediaId}-t`;
            let thumbBlob: Blob | null = null;

            if (item.type === 'image') {
              const mainBlob = await dbGetMedia(item.mediaId!);
              if (!mainBlob) return;
              thumbBlob = await makeImageThumbnailBlob(mainBlob);
              if (!thumbBlob) {
                pendingUpdates.push({ id: item.id, noThumb: true });
                if (pendingUpdates.length >= 20) flushBatch();
                return;
              }
            } else if (item.type === 'video' && item.thumbnailUrl?.startsWith('data:')) {
              try {
                const res = await fetch(item.thumbnailUrl);
                thumbBlob = await res.blob();
              } catch {
                thumbBlob = null;
              }
            }

            if (!thumbBlob || isCancelled) return;

            const saved = await dbPutMedia(tId, thumbBlob);
            if (!saved || isCancelled) return;

            pendingUpdates.push({
              id: item.id,
              thumbMediaId: tId,
            });

            if (pendingUpdates.length >= 20) {
              flushBatch();
            }
          } catch (err) {
            console.warn('Migration error for asset:', item.id, err);
          }
        });
      }

      flushBatch();
    };

    migrate();

    return () => {
      isCancelled = true;
    };
  }, [initialLoaded]);

  // Background thumbnail generation for linked assets
  useEffect(() => {
    if (!initialLoaded) return;
    let isCancelled = false;

    const generateThumbnails = async () => {
      const candidates = assetsRef.current.filter(
        a => a.libraryId && !a.thumbMediaId && !a.noThumb
      );
      if (candidates.length === 0) {
        setPreviewProgress(null);
        return;
      }

      const total = candidates.length;
      let completed = 0;
      setPreviewProgress({ current: 0, total });

      const pendingUpdates: { id: string; thumbMediaId?: string; noThumb?: boolean; duration?: string }[] = [];

      const flushBatch = () => {
        if (pendingUpdates.length === 0) return;
        const batch = [...pendingUpdates];
        pendingUpdates.length = 0;
        const updateMap = new Map(batch.map(u => [u.id, u]));
        setAssets(prev =>
          prev.map(a => {
            const u = updateMap.get(a.id);
            if (!u) return a;
            return {
              ...a,
              ...(u.thumbMediaId ? { thumbMediaId: u.thumbMediaId } : {}),
              ...(u.noThumb ? { noThumb: true } : {}),
              ...(u.duration ? { duration: u.duration } : {}),
            };
          })
        );
      };

      for (const item of candidates) {
        if (isCancelled) break;

        await runSequentially(async () => {
          if (isCancelled) return;
          try {
            const mediaUrl = libraryMediaUrl(item.libraryId!);
            if (item.type === 'image') {
              const res = await fetch(mediaUrl);
              if (!res.ok) {
                pendingUpdates.push({ id: item.id, noThumb: true });
              } else {
                const blob = await res.blob();
                const thumbBlob = await makeImageThumbnailBlob(blob);
                if (thumbBlob && !isCancelled) {
                  const tId = `${item.id}-t`;
                  const saved = await dbPutMedia(tId, thumbBlob);
                  if (saved) {
                    pendingUpdates.push({ id: item.id, thumbMediaId: tId });
                  } else {
                    pendingUpdates.push({ id: item.id, noThumb: true });
                  }
                } else {
                  pendingUpdates.push({ id: item.id, noThumb: true });
                }
              }
            } else if (item.type === 'video') {
              const probe = await probeMedia('video', mediaUrl);
              if (isCancelled) return;
              if (probe.thumbnailBlob) {
                const tId = `${item.id}-t`;
                const saved = await dbPutMedia(tId, probe.thumbnailBlob);
                if (saved) {
                  pendingUpdates.push({ id: item.id, thumbMediaId: tId, duration: probe.duration });
                } else {
                  pendingUpdates.push({ id: item.id, noThumb: true, duration: probe.duration });
                }
              } else {
                pendingUpdates.push({ id: item.id, noThumb: true, duration: probe.duration });
              }
            } else if (item.type === 'audio') {
              const probe = await probeMedia('audio', mediaUrl);
              if (isCancelled) return;
              pendingUpdates.push({ id: item.id, noThumb: true, duration: probe.duration || '0:03' });
            }
          } catch (err) {
            console.warn('Failed preview generation for linked asset:', item.id, err);
            pendingUpdates.push({ id: item.id, noThumb: true });
          }

          completed++;
          if (!isCancelled) {
            setPreviewProgress({ current: completed, total });
          }

          if (pendingUpdates.length >= 20) {
            flushBatch();
          }
        });
      }

      flushBatch();
      if (!isCancelled) {
        setPreviewProgress(null);
      }
    };

    generateThumbnails();

    return () => {
      isCancelled = true;
      setPreviewProgress(null);
    };
  }, [initialLoaded, assets.length]);

  interface ImportNamingOption {
    mode: 'filename' | 'single' | 'prefix';
    title?: string;
    prefix?: string;
  }

  const processImportedEntries = async (
    entries: LibraryEntry[],
    truncated: boolean,
    namingOption?: ImportNamingOption,
    packageId?: string,
    chosenCategory?: string
  ) => {
    if (!entries || entries.length === 0) return;

    const existingByKey = new Map<string, EditAsset>();
    for (const a of assetsRef.current) {
      if (a.libraryId && a.fileName) {
        existingByKey.set(`${a.fileName}:::${a.fileSize ?? 0}`, a);
      }
    }

    const seenNewKeys = new Set<string>();
    const validEntries: LibraryEntry[] = [];
    const duplicateIds: string[] = [];
    const moveToPackageIds = new Set<string>();
    let skippedCount = 0;

    for (const entry of entries) {
      const key = `${entry.name}:::${entry.size}`;
      const existing = existingByKey.get(key);
      if (existing || seenNewKeys.has(key)) {
        duplicateIds.push(entry.id);
        if (existing && packageId && existing.packageId !== packageId) {
          // The file is already in the library: move it into this package instead of skipping it
          moveToPackageIds.add(existing.id);
        } else {
          skippedCount++;
        }
      } else {
        seenNewKeys.add(key);
        validEntries.push(entry);
      }
    }

    if (moveToPackageIds.size > 0 && packageId) {
      setAssets(prev => prev.map(a => (moveToPackageIds.has(a.id) ? { ...a, packageId } : a)));
    }

    const lib = getDesktopLibrary();
    if (duplicateIds.length > 0 && lib?.forget) {
      lib.forget(duplicateIds).catch(() => {});
    }

    const targetCategory = (kind: 'video' | 'audio' | 'image'): string => {
      if (chosenCategory !== undefined) return chosenCategory;
      if (selectedCategory && selectedCategory !== 'همه') {
        return selectedCategory;
      }
      return kind === 'audio' ? 'ساند افکت' : 'میم';
    };

    const newAssets: EditAsset[] = validEntries.map((entry, idx) => {
      const dotIndex = entry.name.lastIndexOf('.');
      const baseName = dotIndex > 0 ? entry.name.substring(0, dotIndex) : entry.name;

      let title = baseName;
      if (namingOption) {
        if (namingOption.mode === 'single') {
          title = namingOption.title?.trim() || baseName;
        } else if (namingOption.mode === 'prefix') {
          const p = namingOption.prefix?.trim() || (isEn ? 'File' : 'فایل');
          title = `${p} ${idx + 1}`;
        }
      }

      return {
        id: `lib_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        type: entry.kind,
        category: targetCategory(entry.kind),
        url: '',
        libraryId: entry.id,
        fileName: entry.name,
        fileSize: entry.size,
        tags: [],
        packageId: packageId || undefined,
        isBookmarked: false,
      };
    });

    const BATCH_SIZE = 200;
    for (let i = 0; i < newAssets.length; i += BATCH_SIZE) {
      const batch = newAssets.slice(i, i + BATCH_SIZE);
      setAssets(prev => [...batch, ...prev]);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const addedCount = newAssets.length;
    const movedCount = moveToPackageIds.size;
    let message = isEn
      ? `${addedCount} added, ${skippedCount} skipped (already in library)`
      : `${addedCount} مورد اضافه شد، ${skippedCount} مورد تکراری رد شد`;
    if (movedCount > 0) {
      message += isEn
        ? `, ${movedCount} existing moved into the package`
        : `، ${movedCount} فایل موجود به پکیج منتقل شد`;
    }

    if (truncated) {
      message += isEn
        ? ' (first 20,000 files only)'
        : ' (فقط ۲۰,۰۰۰ فایل اول بررسی شد)';
    }

    showNotification(message);
    await refreshLinkStatus();
  };

  const handlePickFiles = async (targetPackageId?: string) => {
    const lib = getDesktopLibrary();
    if (!lib) return;
    const pkgId = typeof targetPackageId === 'string' ? targetPackageId : undefined;
    try {
      const res = await lib.pickFiles();
      if (res && res.entries && res.entries.length > 0) {
        if (res.entries.length === 1) {
          const entry = res.entries[0];
          const dotIndex = entry.name.lastIndexOf('.');
          const baseName = dotIndex > 0 ? entry.name.substring(0, dotIndex) : entry.name;
          setSingleCustomTitle(baseName);
          setPendingImport({ entries: res.entries, truncated: false, packageId: pkgId });
        } else {
          setMultiNamingMode('filename');
          setMultiPrefix(isEn ? 'File' : 'فایل');
          setPendingImport({ entries: res.entries, truncated: false, packageId: pkgId });
        }
      }
    } catch (err) {
      console.error('Failed to pick files:', err);
    }
  };

  const handleConfirmSingle = async (useFileNameOnly: boolean) => {
    if (!pendingImport || pendingImport.entries.length === 0) return;
    const entry = pendingImport.entries[0];
    const dotIndex = entry.name.lastIndexOf('.');
    const baseName = dotIndex > 0 ? entry.name.substring(0, dotIndex) : entry.name;
    const title = useFileNameOnly ? baseName : (singleCustomTitle.trim() || baseName);

    const { entries, truncated, packageId: pendingPkgId } = pendingImport;
    setPendingImport(null);

    await processImportedEntries(entries, truncated, {
      mode: 'single',
      title,
    }, pendingPkgId, importCategory);
  };

  const handleConfirmMulti = async () => {
    if (!pendingImport || pendingImport.entries.length === 0) return;
    const { entries, truncated, packageId: pendingPkgId } = pendingImport;
    const mode = multiNamingMode;
    const prefix = multiPrefix.trim() || (isEn ? 'File' : 'فایل');
    setPendingImport(null);

    if (mode === 'prefix') {
      await processImportedEntries(entries, truncated, {
        mode: 'prefix',
        prefix,
      }, pendingPkgId, importCategory);
    } else {
      await processImportedEntries(entries, truncated, {
        mode: 'filename',
      }, pendingPkgId, importCategory);
    }
  };

  const handleCreatePackageFromFolder = async () => {
    const lib = getDesktopLibrary();
    if (!lib) return;
    try {
      const res = await lib.pickFolder();
      if (res && res.entries && res.entries.length > 0) {
        const counts = new Map<string, number>();
        for (const e of res.entries) {
          const n = (e.parentName || '').trim();
          if (n) counts.set(n, (counts.get(n) || 0) + 1);
        }
        let best = '';
        let bestCount = 0;
        counts.forEach((c, n) => {
          if (c > bestCount) {
            best = n;
            bestCount = c;
          }
        });
        setPackageModal({
          mode: 'fromFolder',
          entries: res.entries,
          truncated: !!res.truncated,
          defaultName: best.slice(0, 60),
        });
      }
    } catch (err) {
      console.error('Failed to pick folder for package:', err);
    }
  };

  const handlePickFolder = async () => {
    const lib = getDesktopLibrary();
    if (!lib) return;
    try {
      const res = await lib.pickFolder();
      if (res && res.entries && res.entries.length > 0) {
        await processImportedEntries(res.entries, !!res.truncated);
      }
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  const handleRelinkAsset = async (asset: EditAsset) => {
    const lib = getDesktopLibrary();
    if (!lib || !asset.libraryId) return;
    try {
      const res = await lib.relink(asset.libraryId, asset.type);
      if (res && res.ok) {
        showNotification(isEn ? 'File relinked successfully' : 'پیوند فایل با موفقیت برقرار شد');
        await refreshLinkStatus();
      }
    } catch (err) {
      console.error('Failed to relink asset:', err);
    }
  };

  const handleRelinkFolder = async () => {
    const lib = getDesktopLibrary();
    if (!lib) return;
    const missingAssets = assetsRef.current.filter(a => a.libraryId && missingIds.has(a.id));
    if (missingAssets.length === 0) return;
    const items = missingAssets.map(a => ({
      id: a.libraryId!,
      name: a.fileName || (a.title ? `${a.title}.${a.type === 'video' ? 'mp4' : a.type === 'audio' ? 'mp3' : 'png'}` : 'file'),
      size: a.fileSize,
    }));
    try {
      const res = await lib.relinkFolder(items);
      if (res) {
        const msg = isEn
          ? `${res.relinked} of ${res.total} relinked`
          : `${res.relinked} از ${res.total} مورد پیوند خورد`;
        showNotification(msg);
        await refreshLinkStatus();
      }
    } catch (err) {
      console.error('Failed to relink folder:', err);
    }
  };

  // Handle local file selection
  const handleFileChange = (file: File) => {
    if (!file) return;
    setSelectedFile(file);
    setSelectedFileName(file.name);

    // Auto set title if empty
    const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    if (!newTitle.trim()) {
      setNewTitle(fileNameWithoutExt);
    }

    // Auto detect type
    if (file.type.startsWith('video/')) {
      setNewType('video');
    } else if (file.type.startsWith('audio/')) {
      setNewType('audio');
    } else if (file.type.startsWith('image/')) {
      setNewType('image');
    }

    // Preview via a temporary object URL (the file itself is stored as a Blob on submit)
    if (newUrl && newUrl.startsWith('blob:')) {
      URL.revokeObjectURL(newUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setNewUrl(objUrl);
    if (file.type.startsWith('image/') || newType === 'image') {
      setNewThumbnail(objUrl);
    }
    setIsProcessingFile(false);
  };

  // Handle thumbnail image file selection
  const handleThumbnailFileChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setNewThumbnail(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Reset modal state
  const handleOpenModal = () => {
    setSourceMode(isLinked ? 'url' : 'file');
    setSelectedFile(null);
    setSelectedFileName('');
    setNewTitle('');
    setNewUrl('');
    setNewThumbnail('');
    setNewTags('');
    setShowAddModal(true);
  };

  // Handle Play/Pause
  const handleTogglePlay = (id: string) => {
    if (missingIds.has(id)) return;
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const handleToggleMute = (id: string) => {
    setMutedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLink = (asset: EditAsset) => {
    if (asset.mediaId || asset.libraryId) return;
    navigator.clipboard.writeText(asset.url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleBookmark = (id: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, isBookmarked: !a.isBookmarked } : a));
  };

  const handleDeleteAsset = (id: string) => {
    if (playingId === id) setPlayingId(null);
    const target = assets.find(a => a.id === id);
    if (target?.mediaId) {
      dbDeleteMedia(target.mediaId);
      releaseMediaObjectUrl(target.mediaId);
    }
    if (target?.thumbMediaId) {
      dbDeleteMedia(target.thumbMediaId);
      releaseMediaObjectUrl(target.thumbMediaId);
    }
    const lib = getDesktopLibrary();
    if (target?.libraryId && lib?.forget) {
      lib.forget([target.libraryId]).catch(() => {});
    }
    setMissingIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleMoveToPackage = (assetId: string, packageId: string | undefined) => {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, packageId } : a));
  };

  const handleOpenImagePreview = async (asset: EditAsset) => {
    if (missingIds.has(asset.id)) return;
    let targetSrc = asset.url;
    if (asset.libraryId) {
      targetSrc = libraryMediaUrl(asset.libraryId);
    } else if (asset.mediaId) {
      setActivePreviewMediaId(asset.mediaId);
      const originalUrl = await getMediaObjectUrl(asset.mediaId, 'original');
      if (originalUrl) {
        targetSrc = originalUrl;
      }
    }
    if (targetSrc) {
      if (onOpenLightbox) {
        onOpenLightbox(targetSrc);
      } else {
        setLocalLightboxSrc(targetSrc);
      }
    }
  };

  const handleAddAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingFile) return;
    if (!newTitle.trim() || !newUrl.trim()) return;

    const id = 'asset_' + Date.now();
    let url = newUrl.trim();
    let mediaId: string | undefined;
    let thumbMediaId: string | undefined;
    let isNoThumb = false;

    if (sourceMode === 'file' && selectedFile) {
      const saved = await dbPutMedia(id, selectedFile);
      if (!saved) {
        alert(isEn ? 'Could not save this file. Storage may be full.' : 'ذخیره‌ی فایل ناموفق بود. ممکن است فضای ذخیره‌سازی پر باشد.');
        return;
      }
      mediaId = id;
      url = '';
    }

    let autoThumbnailBlob: Blob | undefined;
    let autoDuration: string | undefined;
    if (newType === 'video' || newType === 'audio') {
      setIsProcessingFile(true);
      let probeUrl = url;
      let tempProbeUrl = false;
      if (sourceMode === 'file' && selectedFile) {
        probeUrl = URL.createObjectURL(selectedFile);
        tempProbeUrl = true;
      }
      const probe = await probeMedia(newType, probeUrl);
      if (tempProbeUrl) {
        URL.revokeObjectURL(probeUrl);
      }
      setIsProcessingFile(false);
      autoDuration = probe.duration;
      if (newType === 'video' && probe.thumbnailBlob) {
        autoThumbnailBlob = probe.thumbnailBlob;
      }
    }

    if (sourceMode === 'file' && mediaId) {
      if (newType === 'image' && selectedFile) {
        const thumbBlob = await runSequentially(() => makeImageThumbnailBlob(selectedFile));
        if (thumbBlob) {
          const tId = `${mediaId}-t`;
          const savedThumb = await runSequentially(() => dbPutMedia(tId, thumbBlob));
          if (savedThumb) {
            thumbMediaId = tId;
          } else {
            isNoThumb = true;
          }
        } else {
          isNoThumb = true;
        }
      } else if (newType === 'video' && autoThumbnailBlob) {
        const tId = `${mediaId}-t`;
        const savedThumb = await runSequentially(() => dbPutMedia(tId, autoThumbnailBlob!));
        if (savedThumb) {
          thumbMediaId = tId;
        }
      }
    }

    const tagsArr = newTags.split(',').map(t => t.trim()).filter(Boolean);
    const categoryToSave = categoryList.includes(newCategory) ? newCategory : categoryList[0] ?? '';
    const newAsset: EditAsset = {
      id,
      title: newTitle.trim(),
      type: newType,
      category: categoryToSave,
      url: sourceMode === 'file' ? '' : newUrl.trim(),
      mediaId,
      thumbMediaId,
      noThumb: isNoThumb || undefined,
      thumbnailUrl: sourceMode === 'file' ? undefined : (newThumbnail.trim() || undefined),
      duration: newType === 'image' ? undefined : (autoDuration || (newType === 'audio' ? '0:03' : '0:10')),
      tags: tagsArr.length > 0 ? tagsArr : categoryToSave ? ['جدید', categoryToSave] : ['جدید'],
      isBookmarked: false
    };

    setAssets(prev => [newAsset, ...prev]);
    setShowAddModal(false);
    setSelectedFile(null);
    setSelectedFileName('');
    setNewTitle('');
    setNewUrl('');
    setNewThumbnail('');
    setNewTags('');
  };

  const categoryTabType: 'video' | 'audio' | 'image' | null =
    activeTab === 'video' || activeTab === 'audio' || activeTab === 'image' ? activeTab : null;
  const showCategoryCards = !!categoryTabType && !openPackageId && categoryView && selectedCategory === 'همه';

  // Filtering assets
  const filteredAssets = assets.filter(asset => {
    // If inside a package, show only its assets
    if (openPackageId && asset.packageId !== openPackageId) return false;

    // Tab filter
    if (activeTab === 'video' && asset.type !== 'video') return false;
    if (activeTab === 'audio' && asset.type !== 'audio') return false;
    if (activeTab === 'image' && asset.type !== 'image') return false;
    if (activeTab === 'bookmarked' && !asset.isBookmarked) return false;

    // Category filter
    if (selectedCategory !== 'همه' && (asset.category || '') !== selectedCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = asset.title?.toLowerCase().includes(q);
      const matchCategory = asset.category?.toLowerCase().includes(q);
      const matchTags = asset.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchCategory && !matchTags) return false;
    }

    return true;
  });

  const currentPackage = openPackageId ? packages.find(p => p.id === openPackageId) : null;
  const packageTotalCount = openPackageId ? assets.filter(a => a.packageId === openPackageId).length : 0;

  const videos = filteredAssets.filter(a => a.type === 'video');
  const audios = filteredAssets.filter(a => a.type === 'audio');
  const images = filteredAssets.filter(a => a.type === 'image');

  const listResetKey = `${activeTab}_${selectedCategory}_${searchQuery}_${openPackageId || 'all'}`;
  const { visible: visibleVideos, hasMore: hasMoreVideos, showMore: showMoreVideos, sentinelRef: videoSentinelRef } = useChunkedList(videos, listResetKey, 48);
  const { visible: visibleImages, hasMore: hasMoreImages, showMore: showMoreImages, sentinelRef: imageSentinelRef } = useChunkedList(images, listResetKey, 48);
  const { visible: visibleAudios, hasMore: hasMoreAudios, showMore: showMoreAudios, sentinelRef: audioSentinelRef } = useChunkedList(audios, listResetKey, 48);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              {isEn ? 'Edit Assets, Memes & Sounds' : 'منابع، میم‌ها و افکت‌های ادیت'}
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {assets.length} {isEn ? 'items' : 'آیتم'}
              </span>
            </h2>
            <p className="text-xs text-[var(--text3)]">
              {isEn ? 'Complete bank of video memes, sound effects and editing images with instant preview' : 'بانک کامل میم‌های ویدیویی، افکت‌های صوتی و عکس‌های تدوین با پیش‌نمایش و دانلود'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {previewProgress && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400 font-medium">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>
                {isEn 
                  ? `Generating previews ${previewProgress.current} / ${previewProgress.total}`
                  : `ساخت پیش‌نمایش ${previewProgress.current} از ${previewProgress.total}`}
              </span>
            </div>
          )}

          {isLinked && (
            <button
              type="button"
              onClick={() => handlePickFiles()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <FileUp className="w-4 h-4" />
              <span>{isEn ? 'Add files' : 'افزودن فایل‌ها'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowPackages(true);
              setOpenPackageId(null);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Package className="w-4 h-4" />
            <span>{isEn ? 'Packages' : 'پکیج‌ها'}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
              {packages.length}
            </span>
          </button>

          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>{isLinked ? (isEn ? 'Add via link' : 'افزودن با لینک') : (isEn ? 'Upload file from system' : 'آپلود فایل از سیستم')}</span>
          </button>
        </div>
      </div>

      {/* Missing Files Alert Bar */}
      <AnimatePresence>
        {isLinked && missingIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs shadow-sm backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-red-200">
                  {isEn 
                    ? `${missingIds.size} ${missingIds.size === 1 ? 'file' : 'files'} not found` 
                    : `${missingIds.size} فایل پیدا نشد`}
                </span>
                <p className="text-[11px] text-red-300/80 mt-0.5">
                  {isEn
                    ? 'Some linked files were moved, renamed or unavailable.'
                    : 'برخی از فایل‌های پیوندی جابجا شده‌اند یا در دسترس نیستند.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRelinkFolder}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95 shrink-0 self-end sm:self-center"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>{isEn ? 'Relink with folder' : 'پیوند دوباره با یک پوشه'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showPackages && openPackageId === null ? (
        /* Packages Page */
        <div className="space-y-6">
          {/* Packages Header Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPackages(false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text)] border border-[var(--border)] text-xs font-medium cursor-pointer transition-all shrink-0"
                title={isEn ? 'Back to assets' : 'بازگشت به دارایی‌ها'}
              >
                {isEn ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                <span>{isEn ? 'Back' : 'بازگشت'}</span>
              </button>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <span>{isEn ? 'Packages' : 'پکیج‌ها'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {packages.length}
                  </span>
                </h3>
                <p className="text-[11px] text-[var(--text3)]">
                  {isEn 
                    ? 'Group videos, images, and sounds together in customized packages' 
                    : 'دسته‌بندی همزمان ویدیوها، عکس‌ها و صداها در مجموعه‌های اختصاصی'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setPackageNameInput('');
                setPackageModal({ mode: 'create' });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95 shrink-0 self-end sm:self-center"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{isEn ? 'New package' : 'پکیج جدید'}</span>
            </button>
              {isLinked && (
                <button
                  type="button"
                  onClick={handleCreatePackageFromFolder}
                  title={isEn
                    ? 'The Windows folder window shows only folders. Select a folder and press "Select Folder"; the files inside will be imported.'
                    : 'پنجره‌ی انتخاب پوشه‌ی ویندوز فقط پوشه‌ها را نشان می‌دهد. یک پوشه را انتخاب و «Select Folder» را بزنید؛ فایل‌های داخل آن وارد می‌شوند.'}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text)] border border-[var(--border)] text-xs font-semibold transition-all cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  <span>{isEn ? 'Create package from a disk folder' : 'ساخت پکیج از یک پوشه روی دیسک'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Packages Grid or Empty State */}
          {packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {isEn ? 'No packages created yet' : 'هنوز پکیجی ساخته نشده است'}
              </div>
              <p className="text-xs text-[var(--text3)] max-w-sm">
                {isEn
                  ? 'Create a package to organize your favorite video memes, audio effects, and images in one collection.'
                  : 'یک پکیج جدید بسازید تا بتوانید انواع میم‌های ویدیویی، افکت‌های صوتی و تصاویر را در یک مجموعه قرار دهید.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPackageNameInput('');
                  setPackageModal({ mode: 'create' });
                }}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
              >
                <FolderPlus className="w-4 h-4" />
                <span>{isEn ? 'New package' : 'پکیج جدید'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {packages.map((pkg) => {
                const pkgAssets = assets.filter((a) => a.packageId === pkg.id);
                const count = pkgAssets.length;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      setOpenPackageId(pkg.id);
                      setActiveTab('all');
                      setSelectedCategory('همه');
                      setSearchQuery('');
                    }}
                    className="group flex flex-col justify-between p-3.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-indigo-500/50 hover:shadow-lg transition-all cursor-pointer space-y-3"
                  >
                    {/* Mosaic Preview Container */}
                    <div className="w-full aspect-video rounded-xl bg-black/40 overflow-hidden relative border border-[var(--border)] group-hover:border-indigo-500/30 transition-colors">
                      {count === 0 ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text3)] gap-1.5 p-3">
                          <Package className="w-8 h-8 opacity-30 text-indigo-400" />
                          <span className="text-[11px] font-medium opacity-60">
                            {isEn ? 'Empty package' : 'پکیج خالی'}
                          </span>
                        </div>
                      ) : count === 1 ? (
                        <div className="w-full h-full">
                          <LazyThumb asset={pkgAssets[0]} className="w-full h-full object-cover" />
                        </div>
                      ) : count === 2 ? (
                        <div className="grid grid-cols-2 h-full gap-0.5">
                          <div className="relative overflow-hidden h-full">
                            <LazyThumb asset={pkgAssets[0]} className="w-full h-full object-cover" />
                          </div>
                          <div className="relative overflow-hidden h-full">
                            <LazyThumb asset={pkgAssets[1]} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ) : count === 3 ? (
                        <div className="grid grid-cols-3 h-full gap-0.5">
                          <div className="relative overflow-hidden h-full">
                            <LazyThumb asset={pkgAssets[0]} className="w-full h-full object-cover" />
                          </div>
                          <div className="relative overflow-hidden h-full">
                            <LazyThumb asset={pkgAssets[1]} className="w-full h-full object-cover" />
                          </div>
                          <div className="relative overflow-hidden h-full">
                            <LazyThumb asset={pkgAssets[2]} className="w-full h-full object-cover" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
                          {pkgAssets.slice(0, 4).map((a) => (
                            <div key={a.id} className="relative overflow-hidden w-full h-full">
                              <LazyThumb asset={a} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Info & Action Buttons */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className="text-sm font-bold text-[var(--text)] truncate group-hover:text-indigo-400 transition-colors"
                          title={pkg.name}
                        >
                          {pkg.name}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--input-bg)] text-[var(--text2)] border border-[var(--border)] shrink-0 font-medium">
                          {count} {isEn ? (count === 1 ? 'item' : 'items') : 'مورد'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-[var(--border)]/60">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenPackageId(pkg.id);
                            setActiveTab('all');
                            setSelectedCategory('همه');
                            setSearchQuery('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                        >
                          {isEn ? 'Open' : 'باز کردن'}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPackageModal({ mode: 'rename', pkg });
                            }}
                            className="p-1.5 rounded-lg text-[var(--text3)] hover:text-amber-400 hover:bg-[var(--sidebar-hover)] transition-colors cursor-pointer"
                            title={isEn ? 'Rename package' : 'تغییر نام پکیج'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePackage(pkg);
                            }}
                            className="p-1.5 rounded-lg text-[var(--text3)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title={isEn ? 'Delete package' : 'حذف پکیج'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Assets View (Inside an open package or Normal View) */
        <div className="space-y-6">
          {/* Top Banner when a package is open */}
          {openPackageId && currentPackage && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-[var(--text)] shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPackageId(null);
                    setShowPackages(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text)] border border-[var(--border)] text-xs font-medium cursor-pointer transition-all shrink-0"
                  title={isEn ? 'Back to packages' : 'بازگشت به صفحه‌ی پکیج‌ها'}
                >
                  {isEn ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{isEn ? 'Packages' : 'پکیج‌ها'}</span>
                </button>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text)]">{currentPackage.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                      {packageTotalCount} {isEn ? (packageTotalCount === 1 ? 'item' : 'items') : 'مورد'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text3)] mt-0.5">
                    {isEn ? 'Viewing package contents' : 'مشاهده محتویات این پکیج'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                {isLinked && (
                  <button
                    type="button"
                    onClick={() => handlePickFiles(currentPackage.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Add files to this package' : 'افزودن فایل‌ها به این پکیج'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPackageModal({ mode: 'rename', pkg: currentPackage })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text)] border border-[var(--border)] text-xs font-medium cursor-pointer transition-all"
                >
                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isEn ? 'Rename' : 'تغییر نام'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePackage(currentPackage)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs font-medium cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Delete package' : 'حذف پکیج'}</span>
                </button>
              </div>
            </div>
          )}

          {/* If opened package is empty */}
          {openPackageId && packageTotalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-[var(--text)]">
                {isEn ? 'This package is empty' : 'این پکیج خالی است'}
              </div>
              <p className="text-xs text-[var(--text3)] max-w-xs">
                {isEn
                  ? 'No assets have been added to this package yet.'
                  : 'هنوز هیچ دارایی یا فایلی در این پکیج قرار نگرفته است.'}
              </p>
              {isLinked && openPackageId && (
                <button
                  type="button"
                  onClick={() => handlePickFiles(openPackageId)}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <FileUp className="w-4 h-4" />
                  <span>{isEn ? 'Add files to this package' : 'افزودن فایل‌ها به این پکیج'}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tabs & Search controls */}
              <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Main Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'all' 
                  ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <span>{isEn ? 'All' : 'همه'}</span>
            </button>
            <button
              onClick={() => setActiveTab('video')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'video' 
                  ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-purple-400" />
              <span>{isEn ? 'Video Memes' : 'میم‌های ویدیویی'}</span>
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'image' 
                  ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isEn ? 'Images & Memes' : 'عکس‌ها'}</span>
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'audio' 
                  ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-pink-400" />
              <span>{isEn ? 'Sound Effects' : 'افکت‌های صوتی'}</span>
            </button>
            <button
              onClick={() => setActiveTab('bookmarked')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'bookmarked' 
                  ? 'bg-[var(--card-bg)] text-amber-400 shadow-sm font-semibold' 
                  : 'text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEn ? 'Favorites' : 'علاقه‌مندی‌ها'}</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            <input 
              type="text"
              placeholder={isEn ? 'Search meme, image or sound effect...' : 'جستجوی میم، عکس یا افکت صوتی...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text3)] focus:outline-none focus:border-[var(--accent)] transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* All / Categories switch (video, sound and image tabs) */}
        {categoryTabType && !openPackageId && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => {
                setCategoryView(false);
                setSelectedCategory('همه');
              }}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                !categoryView
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] border border-[var(--border)]'
              }`}
            >
              {isEn ? 'All' : 'همه'}
            </button>
            <button
              onClick={() => {
                setCategoryView(true);
                setSelectedCategory('همه');
              }}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                categoryView
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] border border-[var(--border)]'
              }`}
            >
              <Filter className="w-3 h-3" />
              {isEn ? 'Categories' : 'دسته‌بندی'}
            </button>
            {categoryView && selectedCategory !== 'همه' && (
              <>
                <span className="text-[var(--text3)] text-xs">/</span>
                <button
                  onClick={() => setSelectedCategory('همه')}
                  className="px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer whitespace-nowrap bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] border border-[var(--border)] flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3 rtl:rotate-180" />
                  {isEn ? 'Back to categories' : 'بازگشت به دسته‌بندی‌ها'}
                </button>
                <span className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap bg-purple-600/15 text-purple-300 border border-purple-500/30">
                  {categoryLabel(selectedCategory)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Category cards (shown like packages) */}
      {showCategoryCards && categoryTabType && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...categoryList, ''].map((cat) => {
            const catAssets = assets.filter(a => a.type === categoryTabType && (a.category || '') === cat);
            const count = catAssets.length;
            if (cat === '' && count === 0) return null;
            return (
              <div
                key={cat || '__none__'}
                onClick={() => setSelectedCategory(cat)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSelectedCategory(cat);
                }}
                className="group relative p-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] hover:border-purple-500/50 hover:bg-[var(--sidebar-hover)] transition-all cursor-pointer space-y-3"
              >
                <div className="w-full aspect-video rounded-xl bg-black/40 overflow-hidden relative border border-[var(--border)] group-hover:border-purple-500/30 transition-colors">
                  <AssetMosaic
                    assets={catAssets}
                    fallbackIcon={
                      <div className="flex flex-col items-center gap-1.5">
                        <Tag className="w-7 h-7 opacity-60" />
                        {count === 0 && (
                          <span className="text-[11px] font-medium opacity-70">{isEn ? 'Empty' : 'خالی'}</span>
                        )}
                      </div>
                    }
                  />
                </div>
                <div>
                  <div dir="auto" className="text-sm font-semibold text-[var(--text)] truncate">{categoryLabel(cat)}</div>
                  <div className="text-[11px] text-[var(--text3)] mt-0.5">{count} {isEn ? 'items' : 'مورد'}</div>
                </div>
                {cat !== '' && (
                  <button
                    type="button"
                    title={isEn ? 'Delete category' : 'حذف دسته‌بندی'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryToDelete(cat);
                    }}
                    className="absolute top-2 end-2 p-1.5 rounded-lg text-[var(--text3)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {isAddingCategory ? (
            <div className="p-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card-bg)] space-y-2">
              <input
                autoFocus
                type="text"
                value={newCategoryInput}
                maxLength={30}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitCategory();
                  if (e.key === 'Escape') {
                    setIsAddingCategory(false);
                    setNewCategoryInput('');
                  }
                }}
                placeholder={isEn ? 'Category name' : 'نام دسته‌بندی'}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={handleSubmitCategory} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 cursor-pointer">
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryInput('');
                  }}
                  className="p-1.5 rounded-lg text-[var(--text3)] hover:bg-[var(--sidebar-hover)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewCategoryInput('');
                setIsAddingCategory(true);
              }}
              className="p-4 rounded-2xl border border-dashed border-[var(--border)] text-[var(--text2)] hover:bg-[var(--sidebar-hover)] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 min-h-[110px]"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-medium">{isEn ? 'New category' : 'دسته‌بندی جدید'}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Grid Content */}
      {showCategoryCards ? null : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] space-y-3">
          <Clapperboard className="w-10 h-10 text-[var(--text3)] opacity-40" />
          <div className="text-sm font-semibold text-[var(--text2)]">{isEn ? 'No assets found' : 'هیچ منبعی پیدا نشد'}</div>
          <p className="text-xs text-[var(--text3)] max-w-xs">
            {isEn ? 'Try another search query or upload a new asset using the button above.' : 'عبارت دیگری جستجو کنید یا با دکمه بالا یک میم، عکس یا فایل صوتی جدید اضافه کنید.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Video Memes */}
          {(activeTab === 'all' || activeTab === 'video' || activeTab === 'bookmarked') && videos.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <Video className="w-4 h-4 text-purple-400" />
                  <span>{isEn ? 'Video Memes & Green Screen' : 'میم‌های ویدیویی و گرین اسکرین'}</span>
                  <span className="text-xs font-normal text-[var(--text3)]">({videos.length} {isEn ? 'items' : 'مورد'})</span>
                </h3>
              </div>

              {/* Large Video Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleVideos.map((asset) => (
                  <VideoMemeCard 
                    key={asset.id}
                    asset={asset}
                    isPlaying={playingId === asset.id}
                    isMuted={!!mutedIds[asset.id]}
                    isCopied={copiedId === asset.id}
                    isMissing={missingIds.has(asset.id)}
                    onRelink={() => handleRelinkAsset(asset)}
                    onTogglePlay={() => handleTogglePlay(asset.id)}
                    onToggleMute={() => handleToggleMute(asset.id)}
                    onCopyLink={() => handleCopyLink(asset)}
                    onToggleBookmark={() => handleToggleBookmark(asset.id)}
                    onDelete={() => handleDeleteAsset(asset.id)}
                    packages={packages}
                    onMoveToPackage={(packageId) => handleMoveToPackage(asset.id, packageId)}
                    onCreatePackage={() => {
                      setPackageNameInput('');
                      setPackageModal({ mode: 'create', assignAssetId: asset.id });
                    }}
                    isEn={isEn}
                  />
                ))}
              </div>
              {hasMoreVideos && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                  <span className="text-xs text-[var(--text3)]">
                    {isEn ? `Showing ${visibleVideos.length} of ${videos.length}` : `نمایش ${visibleVideos.length} از ${videos.length}`}
                  </span>
                  <button
                    onClick={showMoreVideos}
                    className="px-4 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer"
                  >
                    {isEn ? 'Show more' : 'نمایش بیشتر'}
                  </button>
                </div>
              )}
              <div ref={videoSentinelRef} className="h-1 w-full" />
            </div>
          )}

          {/* Section 2: Image Memes & Graphics */}
          {(activeTab === 'all' || activeTab === 'image' || activeTab === 'bookmarked') && images.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>{isEn ? 'Image Memes & Graphic Assets' : 'عکس‌ها و میم‌های تصویری'}</span>
                  <span className="text-xs font-normal text-[var(--text3)]">({images.length} {isEn ? 'items' : 'مورد'})</span>
                </h3>
              </div>

              {/* Image Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleImages.map((asset) => (
                  <ImageMemeCard 
                    key={asset.id}
                    asset={asset}
                    isCopied={copiedId === asset.id}
                    isMissing={missingIds.has(asset.id)}
                    onRelink={() => handleRelinkAsset(asset)}
                    onCopyLink={() => handleCopyLink(asset)}
                    onToggleBookmark={() => handleToggleBookmark(asset.id)}
                    onDelete={() => handleDeleteAsset(asset.id)}
                    packages={packages}
                    onMoveToPackage={(packageId) => handleMoveToPackage(asset.id, packageId)}
                    onCreatePackage={() => {
                      setPackageNameInput('');
                      setPackageModal({ mode: 'create', assignAssetId: asset.id });
                    }}
                    onOpenPreview={() => handleOpenImagePreview(asset)}
                    isEn={isEn}
                  />
                ))}
              </div>
              {hasMoreImages && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                  <span className="text-xs text-[var(--text3)]">
                    {isEn ? `Showing ${visibleImages.length} of ${images.length}` : `نمایش ${visibleImages.length} از ${images.length}`}
                  </span>
                  <button
                    onClick={showMoreImages}
                    className="px-4 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer"
                  >
                    {isEn ? 'Show more' : 'نمایش بیشتر'}
                  </button>
                </div>
              )}
              <div ref={imageSentinelRef} className="h-1 w-full" />
            </div>
          )}

          {/* Section 3: Sound Effects */}
          {(activeTab === 'all' || activeTab === 'audio' || activeTab === 'bookmarked') && audios.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <Music className="w-4 h-4 text-pink-400" />
                  <span>{isEn ? 'Sound & Audio Effects' : 'افکت‌های صوتی و ساند افکت‌ها'}</span>
                  <span className="text-xs font-normal text-[var(--text3)]">({audios.length} {isEn ? 'items' : 'مورد'})</span>
                </h3>
              </div>

              {/* Audio Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleAudios.map((asset) => (
                  <AudioEffectCard 
                    key={asset.id}
                    asset={asset}
                    isPlaying={playingId === asset.id}
                    isCopied={copiedId === asset.id}
                    isMissing={missingIds.has(asset.id)}
                    onRelink={() => handleRelinkAsset(asset)}
                    onTogglePlay={() => handleTogglePlay(asset.id)}
                    onCopyLink={() => handleCopyLink(asset)}
                    onToggleBookmark={() => handleToggleBookmark(asset.id)}
                    onDelete={() => handleDeleteAsset(asset.id)}
                    packages={packages}
                    onMoveToPackage={(packageId) => handleMoveToPackage(asset.id, packageId)}
                    onCreatePackage={() => {
                      setPackageNameInput('');
                      setPackageModal({ mode: 'create', assignAssetId: asset.id });
                    }}
                    isEn={isEn}
                  />
                ))}
              </div>
              {hasMoreAudios && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
                  <span className="text-xs text-[var(--text3)]">
                    {isEn ? `Showing ${visibleAudios.length} of ${audios.length}` : `نمایش ${visibleAudios.length} از ${audios.length}`}
                  </span>
                  <button
                    onClick={showMoreAudios}
                    className="px-4 py-2 rounded-xl bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer"
                  >
                    {isEn ? 'Show more' : 'نمایش بیشتر'}
                  </button>
                </div>
              )}
              <div ref={audioSentinelRef} className="h-1 w-full" />
            </div>
          )}
        </div>
      )}
            </>
          )}
        </div>
      )}

      {/* Modal for adding new meme / sound effect / image */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl space-y-5 text-right rtl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  {isLinked 
                    ? (isEn ? 'Add Web Asset' : 'افزودن منبع اینترنتی') 
                    : (isEn ? 'Upload Edit Asset' : 'آپلود منبع ادیت از سیستم')}
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddAssetSubmit} className="space-y-4">
                {/* Source Mode Toggle (Local File vs Web Link) - only when not in linked mode */}
                {!isLinked && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--input-bg)] border border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setSourceMode('file')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        sourceMode === 'file' 
                          ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
                          : 'text-[var(--text2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isEn ? 'Upload File' : 'آپلود فایل از سیستم'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceMode('url')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        sourceMode === 'url' 
                          ? 'bg-[var(--card-bg)] text-[var(--text)] shadow-sm font-semibold' 
                          : 'text-[var(--text2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isEn ? 'Web Link' : 'لینک اینترنتی'}</span>
                    </button>
                  </div>
                )}

                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1.5">{isEn ? 'Asset Type:' : 'نوع منبع:'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewType('video')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
                        newType === 'video' 
                          ? 'bg-purple-600 border-purple-500 text-white font-semibold shadow-sm' 
                          : 'bg-[var(--input-bg)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span className="truncate">{isEn ? 'Video' : 'ویدیو'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('image')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
                        newType === 'image' 
                          ? 'bg-emerald-600 border-emerald-500 text-white font-semibold shadow-sm' 
                          : 'bg-[var(--input-bg)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span className="truncate">{isEn ? 'Image' : 'عکس'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('audio')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium border cursor-pointer transition-all ${
                        newType === 'audio' 
                          ? 'bg-pink-600 border-pink-500 text-white font-semibold shadow-sm' 
                          : 'bg-[var(--input-bg)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Music className="w-3.5 h-3.5" />
                      <span className="truncate">{isEn ? 'Sound' : 'صوت'}</span>
                    </button>
                  </div>
                </div>

                {/* Local File Selector Dropzone */}
                {!isLinked && sourceMode === 'file' ? (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text2)] mb-1">
                      {isEn 
                        ? `Select ${newType === 'video' ? 'video file (MP4, WEBM, MOV)' : newType === 'image' ? 'image file (JPG, PNG, GIF, WEBP)' : 'audio file (MP3, WAV, OGG)'}:` 
                        : `انتخاب فایل ${newType === 'video' ? 'ویدیویی (MP4, WEBM, MOV)' : newType === 'image' ? 'تصویری (JPG, PNG, GIF, WEBP)' : 'صوتی (MP3, WAV, OGG)'}:`}
                    </label>

                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept={
                        newType === 'video' 
                          ? 'video/mp4,video/webm,video/quicktime,video/*' 
                          : newType === 'image'
                          ? 'image/jpeg,image/png,image/webp,image/gif,image/*'
                          : 'audio/mp3,audio/wav,audio/ogg,audio/*'
                      }
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                    />

                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileChange(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`group relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                        selectedFileName 
                          ? 'bg-purple-500/10 border-purple-500/50 text-purple-300' 
                          : 'bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border-[var(--border)] hover:border-purple-500/40 text-[var(--text2)]'
                      }`}
                    >
                      {selectedFileName ? (
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          {newType === 'image' && newUrl ? (
                            <img 
                              src={newUrl} 
                              alt="preview" 
                              className="w-16 h-16 object-cover rounded-xl border border-emerald-500/50 shadow-md mb-1" 
                            />
                          ) : (
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                          )}
                          <span className="text-xs font-bold text-[var(--text)] line-clamp-1 max-w-[260px]" title={selectedFileName}>
                            {selectedFileName}
                          </span>
                          <span className="text-[10px] text-purple-400 font-medium">
                            {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : (isEn ? 'Ready to save' : 'آماده برای ذخیره')}
                          </span>
                          <span className="text-[10px] text-[var(--text3)] underline mt-1">{isEn ? 'Click to change file' : 'برای تغییر فایل کلیک کنید'}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileUp className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold text-[var(--text)]">
                            {isEn ? 'Click to choose file from computer' : 'برای انتخاب فایل از کامپیوتر کلیک کنید'}
                          </span>
                          <span className="text-[10px] text-[var(--text3)]">
                            {isEn ? 'or drag & drop file here' : 'یا فایل را کشیده و در این کادر رها کنید (Drag & Drop)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* URL Input */
                  <div>
                    <label className="block text-xs font-medium text-[var(--text2)] mb-1">
                      {isEn 
                        ? `Direct File URL (${newType === 'video' ? 'MP4' : newType === 'image' ? 'JPG/PNG/GIF' : 'MP3'}):` 
                        : `لینک مستقیم فایل (${newType === 'video' ? 'MP4' : newType === 'image' ? 'JPG/PNG/GIF' : 'MP3'}):`}
                    </label>
                    <input 
                      type="url"
                      required={sourceMode === 'url'}
                      placeholder={newType === 'image' ? 'https://example.com/meme.jpg' : newType === 'video' ? 'https://example.com/video.mp4' : 'https://example.com/sound.mp3'}
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)] text-left"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1">{isEn ? 'Asset Title:' : 'عنوان منبع:'}</label>
                  <input 
                    type="text"
                    required
                    placeholder={isEn ? 'e.g. Laughing Meme or Boom Sound' : 'مثال: میم خنده‌دار یا صدا زنگ بوم'}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {/* Category & Optional Thumbnail */}
                <div className={`grid ${newType === 'video' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text2)] mb-1">{isEn ? 'Category:' : 'دسته‌بندی:'}</label>
                    <Select
                      value={newCategory}
                      onChange={setNewCategory}
                      className="w-full"
                      options={[
                        ...categoryList.map(c => ({ value: c, label: categoryLabel(c) })),
                        { value: '', label: categoryLabel('') },
                      ]}
                    />
                  </div>

                  {newType === 'video' && (
                    <div>
                      <label className="block text-xs font-medium text-[var(--text2)] mb-1">{isEn ? 'Video Thumbnail:' : 'کاور ویدیو (از سیستم):'}</label>
                      <input 
                        type="file"
                        ref={thumbnailInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleThumbnailFileChange(e.target.files[0])}
                      />
                      <button
                        type="button"
                        onClick={() => thumbnailInputRef.current?.click()}
                        className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--accent)] flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">{newThumbnail ? (isEn ? 'Thumbnail Selected' : 'کاور انتخاب شد') : (isEn ? 'Choose Thumbnail' : 'انتخاب تصویر کاور')}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1">{isEn ? 'Tags (comma separated):' : 'تگ‌ها (با کاما جدا کنید):'}</label>
                  <input 
                    type="text"
                    placeholder={isEn ? 'funny, transition, viral' : 'خنده‌دار, ترانزیشن, ویروسی'}
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] cursor-pointer"
                  >
                    {isEn ? 'Cancel' : 'انصراف'}
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingFile || (!newUrl && !selectedFile)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white shadow-md hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Save Asset' : 'ذخیره در بانک ادیت'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Single File Naming */}
      <AnimatePresence>
        {pendingImport && pendingImport.entries.length === 1 && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={handleCancelPendingImport}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl space-y-4 ${
                isEn ? 'text-left ltr' : 'text-right rtl'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>{isEn ? 'File name' : 'نام فایل'}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelPendingImport}
                  className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] cursor-pointer"
                  title={isEn ? 'Cancel' : 'لغو'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmSingle(false);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1.5">
                    {isEn ? 'Enter asset title:' : 'عنوان فایل:'}
                  </label>
                  <input
                    ref={singleTitleInputRef}
                    type="text"
                    value={singleCustomTitle}
                    onChange={(e) => setSingleCustomTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={(() => {
                      const name = pendingImport.entries[0]?.name || '';
                      const dot = name.lastIndexOf('.');
                      return dot > 0 ? name.substring(0, dot) : name;
                    })()}
                  />
                  <p className="text-[11px] text-[var(--text3)] mt-1.5 truncate" title={pendingImport.entries[0]?.name}>
                    <span className="opacity-70">{isEn ? 'Original file: ' : 'فایل اصلی: '}</span>
                    <span className="font-mono text-[10px]">{pendingImport.entries[0]?.name}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1.5">
                    {isEn ? 'Category:' : 'دسته‌بندی:'}
                  </label>
                  <Select
                    value={importCategory}
                    onChange={setImportCategory}
                    className="w-full"
                    options={[
                      ...categoryList.map(c => ({ value: c, label: categoryLabel(c) })),
                      { value: '', label: categoryLabel('') },
                    ]}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => handleConfirmSingle(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer transition-all"
                  >
                    {isEn ? 'Use file name' : 'استفاده از اسم فایل'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] hover:opacity-90 text-white shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Add' : 'افزودن'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Multiple Files Naming */}
      <AnimatePresence>
        {pendingImport && pendingImport.entries.length > 1 && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={handleCancelPendingImport}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl space-y-4 ${
                isEn ? 'text-left ltr' : 'text-right rtl'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Files className="w-4 h-4 text-indigo-400" />
                  <span>
                    {isEn 
                      ? `${pendingImport.entries.length} files selected` 
                      : `${pendingImport.entries.length} فایل انتخاب شد`}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelPendingImport}
                  className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] cursor-pointer"
                  title={isEn ? 'Cancel' : 'لغو'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmMulti();
                }}
                className="space-y-4"
              >
                <div className="space-y-2.5">
                  <label className="block text-xs font-medium text-[var(--text2)]">
                    {isEn ? 'How would you like to name these assets?' : 'نحوه نام‌گذاری دارایی‌ها:'}
                  </label>

                  {/* Option 1: File names */}
                  <label 
                    onClick={() => setMultiNamingMode('filename')}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      multiNamingMode === 'filename'
                        ? 'bg-[var(--card-bg)] border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--input-bg)] border-[var(--border)] hover:border-[var(--text3)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="multiNamingMode"
                      value="filename"
                      checked={multiNamingMode === 'filename'}
                      onChange={() => setMultiNamingMode('filename')}
                      className="accent-[var(--accent)] cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-[var(--text)]">
                        {isEn ? 'File names' : 'اسم خود فایل‌ها'}
                      </div>
                      <div className="text-[11px] text-[var(--text3)] mt-0.5">
                        {isEn ? 'Keep original file names (without extensions)' : 'نام اصلی هر فایل بدون پسوند استفاده می‌شود'}
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Prefix + number */}
                  <div 
                    onClick={() => setMultiNamingMode('prefix')}
                    className={`p-3 rounded-xl border transition-all space-y-2.5 cursor-pointer ${
                      multiNamingMode === 'prefix'
                        ? 'bg-[var(--card-bg)] border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--input-bg)] border-[var(--border)] hover:border-[var(--text3)]'
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="multiNamingMode"
                        value="prefix"
                        checked={multiNamingMode === 'prefix'}
                        onChange={() => setMultiNamingMode('prefix')}
                        className="accent-[var(--accent)] cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-[var(--text)]">
                          {isEn ? 'Prefix + number' : 'پیشوند + شماره'}
                        </div>
                        <div className="text-[11px] text-[var(--text3)] mt-0.5">
                          {isEn ? 'Sequential titles with a custom prefix' : 'نام‌گذاری متوالی مانند «پیشوند 1»، «پیشوند 2» و ...'}
                        </div>
                      </div>
                    </label>

                    {multiNamingMode === 'prefix' && (
                      <div className="pt-1 ps-7 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={multiPrefixInputRef}
                          type="text"
                          value={multiPrefix}
                          onChange={(e) => setMultiPrefix(e.target.value)}
                          placeholder={isEn ? 'e.g. Meme' : 'مثلاً میم'}
                          className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        />
                        <div className="text-[11px] text-[var(--text3)] font-mono">
                          {isEn
                            ? `Preview: "${multiPrefix.trim() || 'File'} 1", "${multiPrefix.trim() || 'File'} 2", ...`
                            : `پیش‌نمایش: «${multiPrefix.trim() || 'فایل'} 1»، «${multiPrefix.trim() || 'فایل'} 2»، ...`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1.5">
                    {isEn ? 'Category:' : 'دسته‌بندی:'}
                  </label>
                  <Select
                    value={importCategory}
                    onChange={setImportCategory}
                    className="w-full"
                    options={[
                      ...categoryList.map(c => ({ value: c, label: categoryLabel(c) })),
                      { value: '', label: categoryLabel('') },
                    ]}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={handleCancelPendingImport}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] cursor-pointer transition-all"
                  >
                    {isEn ? 'Cancel' : 'لغو'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] hover:opacity-90 text-white shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Add' : 'افزودن'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Creating or Renaming a Package */}
      <AnimatePresence>
        {packageToDelete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPackageToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
              className={`w-full max-w-sm p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl space-y-4 ${
                isEn ? 'text-left ltr' : 'text-right rtl'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {isEn ? 'Delete package' : 'حذف پکیج'}
                </h3>
              </div>

              <div className="px-3 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] flex items-center justify-between gap-3">
                <span dir="auto" className="text-sm font-semibold text-[var(--text)] truncate">
                  {packageToDelete.name}
                </span>
                <span className="text-[11px] text-[var(--text3)] shrink-0">
                  {assets.filter(a => a.packageId === packageToDelete.id).length} {isEn ? 'items' : 'مورد'}
                </span>
              </div>

              <p className="text-xs leading-6 text-[var(--text2)]">
                {isEn
                  ? 'The package and all the items inside it will be removed from the app (including the "All" list). The original files on your disk are not deleted.'
                  : 'پکیج و همه‌ی آیتم‌های داخل آن از برنامه (از جمله از لیست «همه») حذف می‌شوند. فایل‌های اصلی روی دیسک شما پاک نمی‌شوند.'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setPackageToDelete(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePackage}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md transition-all cursor-pointer"
                >
                  {isEn ? 'Delete package and items' : 'حذف پکیج و آیتم‌ها'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {packageModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => cancelPackageModal()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl space-y-4 ${
                isEn ? 'text-left ltr' : 'text-right rtl'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-400" />
                  <span>
                    {packageModal.mode === 'create'
                      ? (isEn ? 'New package' : 'پکیج جدید')
                      : packageModal.mode === 'fromFolder'
                        ? (isEn ? 'Create package from folder' : 'ساخت پکیج از پوشه')
                        : (isEn ? 'Rename package' : 'تغییر نام پکیج')}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => cancelPackageModal()}
                  className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] cursor-pointer"
                  title={isEn ? 'Cancel' : 'لغو'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSavePackage();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-[var(--text2)] mb-1.5">
                    {isEn ? 'Package name:' : 'نام پکیج:'}
                  </label>
                  <input
                    ref={packageNameInputRef}
                    type="text"
                    required
                    value={packageNameInput}
                    onChange={(e) => setPackageNameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    placeholder={isEn ? 'e.g. Gaming Memes or Project X' : 'مثال: میم‌های گیمینگ یا پروژه یوتیوب'}
                  />
                  {packageModal.mode === 'fromFolder' && (
                    <p className="text-[11px] text-[var(--text3)] mt-1.5">
                      {isEn
                        ? `${packageModal.entries.length} files from the folder will be added to this package.`
                        : `${packageModal.entries.length} فایل از این پوشه به پکیج اضافه می‌شود.`}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => cancelPackageModal()}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer transition-all"
                  >
                    {isEn ? 'Cancel' : 'انصراف'}
                  </button>
                  <button
                    type="submit"
                    disabled={!packageNameInput.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {packageModal.mode === 'create'
                        ? (isEn ? 'Create' : 'ایجاد پکیج')
                        : (isEn ? 'Save' : 'ذخیره')}
                    </span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Internal Lightbox Fallback */}
      <AnimatePresence>
        {localLightboxSrc && (
          <div 
            onClick={() => { setLocalLightboxSrc(null); setActivePreviewMediaId(null); }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer"
          >
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setLocalLightboxSrc(null); setActivePreviewMediaId(null); }}
                className="absolute -top-10 left-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img 
                src={localLightboxSrc} 
                alt="Enlarged meme" 
                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoryToDelete !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setCategoryToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(ev) => ev.stopPropagation()}
              className={`w-full max-w-sm p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-2xl space-y-4 ${
                isEn ? 'text-left ltr' : 'text-right rtl'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {isEn ? 'Delete category' : 'حذف دسته‌بندی'}
                </h3>
              </div>
              <div dir="auto" className="px-3 py-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-sm font-semibold text-[var(--text)] truncate">
                {categoryLabel(categoryToDelete)}
              </div>
              <p className="text-xs leading-6 text-[var(--text2)]">
                {isEn
                  ? 'Only the category is removed. Items inside it are kept and become "Uncategorized".'
                  : 'فقط خود دسته‌بندی حذف می‌شود. آیتم‌های داخل آن می‌مانند و «بدون دسته‌بندی» می‌شوند.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] text-[var(--text2)] hover:text-[var(--text)] transition-all cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCategory}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md transition-all cursor-pointer"
                >
                  {isEn ? 'Delete category' : 'حذف دسته‌بندی'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification for Library actions */}
      <AnimatePresence>
        {libraryToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 end-6 z-50 px-4 py-2.5 rounded-xl bg-[var(--card-bg)] text-[var(--text)] border border-[var(--border)] shadow-xl text-xs font-medium flex items-center gap-2 backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{libraryToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PackageMoveButton({
  packages,
  currentPackageId,
  onMove,
  onCreate,
  isEn = false,
}: {
  packages: EditPackage[];
  currentPackageId?: string;
  onMove: (packageId: string | undefined) => void;
  onCreate?: () => void;
  isEn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const options: { id: string | undefined; label: string }[] = [
    { id: undefined, label: isEn ? 'No package' : 'بدون پکیج' },
    ...packages.map((pkg) => ({ id: pkg.id as string | undefined, label: pkg.name })),
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`p-1.5 rounded-lg transition-all cursor-pointer hover:bg-[var(--sidebar-hover)] ${
          currentPackageId ? 'text-purple-400' : 'text-[var(--text3)] hover:text-[var(--text)]'
        }`}
        title={isEn ? 'Add to package' : 'افزودن به پکیج'}
      >
        <Package className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full end-0 mb-1 z-30 min-w-[160px] max-h-48 overflow-y-auto rounded-xl bg-[var(--card-bg)] border border-[var(--border)] shadow-xl p-1">
          {options.map((opt) => (
            <button
              key={opt.id || 'none'}
              type="button"
              dir="auto"
              onClick={() => {
                onMove(opt.id);
                setOpen(false);
              }}
              className={`w-full text-start px-2.5 py-1.5 rounded-lg text-[11px] cursor-pointer transition-all hover:bg-[var(--sidebar-hover)] truncate ${
                (opt.id || '') === (currentPackageId || '') ? 'text-purple-400 font-semibold' : 'text-[var(--text2)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {onCreate && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              className="w-full text-start px-2.5 py-1.5 mt-1 border-t border-[var(--border)] rounded-lg text-[11px] cursor-pointer transition-all hover:bg-[var(--sidebar-hover)] text-[var(--text)] font-semibold"
            >
              {isEn ? '+ New package…' : '+ پکیج جدید…'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Subcomponent: Large Video Meme Card
interface VideoMemeCardProps {
  key?: string;
  asset: EditAsset;
  isPlaying: boolean;
  isMuted: boolean;
  isCopied: boolean;
  isMissing?: boolean;
  onRelink?: () => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onCopyLink: () => void;
  onToggleBookmark: () => void;
  onDelete: () => void;
  packages?: EditPackage[];
  onMoveToPackage?: (packageId: string | undefined) => void;
  onCreatePackage?: () => void;
  isEn?: boolean;
}

function VideoMemeCard({
  asset,
  isPlaying,
  isMuted,
  isCopied,
  isMissing = false,
  onRelink,
  onTogglePlay,
  onToggleMute,
  onCopyLink,
  onToggleBookmark,
  onDelete,
  packages = [],
  onMoveToPackage,
  onCreatePackage,
  isEn = false
}: VideoMemeCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(() => {
    if (asset.libraryId) return libraryMediaUrl(asset.libraryId);
    if (asset.mediaId) return null;
    return asset.url;
  });
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (isPlaying && !isMissing) {
      if (asset.libraryId) {
        setPlayUrl(libraryMediaUrl(asset.libraryId));
      } else if (asset.mediaId) {
        getMediaObjectUrl(asset.mediaId, 'original').then((url) => {
          if (!isCancelled && url) {
            setPlayUrl(url);
          }
        });
      } else {
        setPlayUrl(asset.url);
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [isPlaying, isMissing, asset.mediaId, asset.libraryId, asset.url]);

  const activeSrc = asset.libraryId ? libraryMediaUrl(asset.libraryId) : (asset.mediaId ? playUrl : asset.url);

  // Strictly controlled playback: NO AUTOPLAY ON LOAD
  useEffect(() => {
    if (!videoRef.current || !activeSrc || isMissing) return;
    if (isPlaying && !playbackError) {
      videoRef.current.play().catch(e => console.log('Video play prevented:', e));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, activeSrc, playbackError, isMissing]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted, isPlaying]);

  const catMap: Record<string, string> = {
    'میم': isEn ? 'Meme' : 'میم',
    'گرین اسکرین': isEn ? 'Green Screen' : 'گرین اسکرین',
    'ساند افکت': isEn ? 'Sound Effect' : 'ساند افکت',
    'ری‌اکشن': isEn ? 'Reaction' : 'ری‌اکشن',
    'ترانزیشن': isEn ? 'Transition' : 'ترانزیشن',
    'ویروسی': isEn ? 'Viral' : 'ویروسی'
  };

  const deleteTooltip = asset.libraryId
    ? (isEn ? 'Removes from the list only; the original file is untouched' : 'فقط از فهرست حذف می‌شود، فایل اصلی دست نمی‌خورد')
    : (isEn ? 'Delete' : 'حذف');

  return (
    <div className={`group relative flex flex-col rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
      isMissing ? 'opacity-70 border-red-500/30' : ''
    }`}>
      {/* Large Video Preview Viewport (Aspect Ratio 16:9) */}
      <div className="relative aspect-video w-full bg-black/80 overflow-hidden flex items-center justify-center">
        {/* Actual Video Element - NO autoplay */}
        {!isMissing && isPlaying && activeSrc ? (
          playbackError ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-black/90 backdrop-blur-sm gap-2.5">
              <p className="text-xs text-amber-300 font-medium leading-relaxed max-w-[260px]">
                {isEn 
                  ? 'This format cannot be played inside the app; open with default app' 
                  : 'این قالب داخل برنامه پخش نمی‌شود؛ با برنامه‌ی پیش‌فرض باز کنید'}
              </p>
              {asset.libraryId && getDesktopLibrary() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    getDesktopLibrary()?.open(asset.libraryId!);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Open with default app' : 'باز کردن با برنامه‌ی پیش‌فرض'}</span>
                </button>
              )}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={activeSrc}
              poster={asset.thumbnailUrl}
              muted={isMuted}
              loop
              playsInline
              className="w-full h-full object-cover"
              onEnded={() => onTogglePlay()}
              onError={() => setPlaybackError(true)}
            />
          )
        ) : (
          <LazyThumb
            asset={asset}
            alt={asset.title}
            objectFit="cover"
            className="w-full h-full"
          />
        )}

        {/* Overlay Play / Pause Button or Relink if missing */}
        {isMissing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-2">
            {onRelink && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRelink();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer active:scale-95"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Relink' : 'پیوند دوباره'}</span>
              </button>
            )}
          </div>
        ) : (
          <div 
            onClick={() => {
              if (playbackError) setPlaybackError(false);
              onTogglePlay();
            }}
            className={`absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 cursor-pointer ${
              isPlaying && !playbackError ? 'opacity-0 hover:opacity-100' : 'opacity-100'
            }`}
          >
            {!playbackError && (
              <div className="w-14 h-14 rounded-full bg-purple-600/90 hover:bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/40 transition-all transform hover:scale-110 active:scale-95">
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white translate-x-[-1px]" />
                )}
              </div>
            )}
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10">
              {catMap[asset.category] || asset.category}
            </span>
            {isMissing && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-600/90 text-white backdrop-blur-md shadow-sm">
                <AlertCircle className="w-3 h-3" />
                <span>{isEn ? 'File not found' : 'فایل پیدا نشد'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            {asset.duration && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/60 text-white/90 backdrop-blur-md">
                {asset.duration}
              </span>
            )}
            <button
              onClick={onToggleBookmark}
              className={`p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer ${
                asset.isBookmarked 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : 'bg-black/50 hover:bg-black/80 text-white/80 hover:text-white'
              }`}
              title={asset.isBookmarked ? (isEn ? 'Remove from favorites' : 'حذف از علاقه‌مندی‌ها') : (isEn ? 'Add to favorites' : 'افزودن به علاقه‌مندی‌ها')}
            >
              <Bookmark className={`w-3.5 h-3.5 ${asset.isBookmarked ? 'fill-white' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Audio Mute control on video */}
        {!isMissing && isPlaying && !playbackError && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="absolute bottom-2.5 left-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all cursor-pointer"
            title={isMuted ? (isEn ? 'Unmute' : 'وصل صدا') : (isEn ? 'Mute' : 'قطع صدا')}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
          </button>
        )}
      </div>

      {/* Card Info & Footer */}
      <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-[var(--text)] line-clamp-1 mb-1" title={asset.title}>
            {asset.title}
          </h4>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--input-bg)] text-[var(--text3)] border border-[var(--border)]">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          {!asset.mediaId && !asset.libraryId && (
            <button
              onClick={onCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                isCopied 
                  ? 'bg-green-500/20 border-green-500/40 text-green-400' 
                  : 'bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span>{isEn ? 'Copied!' : 'کپی شد!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isEn ? 'Copy Link' : 'کپی لینک'}</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-1 ms-auto">
            {asset.libraryId && (
              <>
                {isMissing && onRelink && (
                  <button
                    type="button"
                    onClick={onRelink}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
                    title={isEn ? 'Relink' : 'پیوند دوباره'}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={isMissing}
                  onClick={() => !isMissing && getDesktopLibrary()?.open(asset.libraryId!)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isMissing 
                      ? 'opacity-30 cursor-not-allowed text-[var(--text3)]' 
                      : 'text-[var(--text3)] hover:text-purple-400 hover:bg-[var(--sidebar-hover)] cursor-pointer'
                  }`}
                  title={isEn ? 'Open with default app' : 'باز کردن با برنامه‌ی پیش‌فرض'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isMissing}
                  onClick={() => !isMissing && getDesktopLibrary()?.showInFolder(asset.libraryId!)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isMissing 
                      ? 'opacity-30 cursor-not-allowed text-[var(--text3)]' 
                      : 'text-[var(--text3)] hover:text-indigo-400 hover:bg-[var(--sidebar-hover)] cursor-pointer'
                  }`}
                  title={isEn ? 'Show in folder' : 'نمایش در پوشه'}
                >
                  <Folder className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {onMoveToPackage && (
              <PackageMoveButton
                packages={packages}
                currentPackageId={asset.packageId}
                onMove={onMoveToPackage}
                onCreate={onCreatePackage}
                isEn={isEn}
              />
            )}
            {!asset.libraryId && asset.url && (
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-all cursor-pointer"
                title={isEn ? 'Open or download' : 'باز کردن یا دانلود'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-[var(--text3)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              title={deleteTooltip}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Image Meme Card
interface ImageMemeCardProps {
  key?: string;
  asset: EditAsset;
  isCopied: boolean;
  isMissing?: boolean;
  onRelink?: () => void;
  onCopyLink: () => void;
  onToggleBookmark: () => void;
  onDelete: () => void;
  packages?: EditPackage[];
  onMoveToPackage?: (packageId: string | undefined) => void;
  onCreatePackage?: () => void;
  onOpenPreview: () => void;
  isEn?: boolean;
}

function ImageMemeCard({
  asset,
  isCopied,
  isMissing = false,
  onRelink,
  onCopyLink,
  onToggleBookmark,
  onDelete,
  packages = [],
  onMoveToPackage,
  onCreatePackage,
  onOpenPreview,
  isEn = false
}: ImageMemeCardProps) {
  const catMap: Record<string, string> = {
    'میم': isEn ? 'Meme' : 'میم',
    'گرین اسکرین': isEn ? 'Green Screen' : 'گرین اسکرین',
    'ساند افکت': isEn ? 'Sound Effect' : 'ساند افکت',
    'ری‌اکشن': isEn ? 'Reaction' : 'ری‌اکشن',
    'ترانزیشن': isEn ? 'Transition' : 'ترانزیشن',
    'ویروسی': isEn ? 'Viral' : 'ویروسی'
  };

  const deleteTooltip = asset.libraryId
    ? (isEn ? 'Removes from the list only; the original file is untouched' : 'فقط از فهرست حذف می‌شود، فایل اصلی دست نمی‌خورد')
    : (isEn ? 'Delete' : 'حذف');

  return (
    <div className={`group relative flex flex-col rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${
      isMissing ? 'opacity-70 border-red-500/30' : ''
    }`}>
      {/* Large Image Preview Viewport (Aspect Ratio 16:9) */}
      <div 
        onClick={isMissing ? undefined : onOpenPreview}
        className={`relative aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center ${
          isMissing ? 'cursor-default' : 'cursor-pointer group/img'
        }`}
        title={isMissing ? (isEn ? 'File not found' : 'فایل پیدا نشد') : (isEn ? 'Click to preview / zoom' : 'برای بزرگنمایی کلیک کنید')}
      >
        <LazyThumb
          asset={asset}
          alt={asset.title}
          objectFit="contain"
          className={!isMissing ? "group-hover/img:scale-105 transition-transform duration-300" : ""}
        />

        {/* Overlay on hover for preview/zoom */}
        {!isMissing && (
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-600/90 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all transform scale-90 group-hover/img:scale-100">
              <ZoomIn className="w-5 h-5" />
            </div>
          </div>
        )}

        {/* Center overlay button for Relink if missing */}
        {isMissing && onRelink && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRelink();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Relink' : 'پیوند دوباره'}</span>
            </button>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10">
              {catMap[asset.category] || asset.category}
            </span>
            {isMissing && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-600/90 text-white backdrop-blur-md shadow-sm">
                <AlertCircle className="w-3 h-3" />
                <span>{isEn ? 'File not found' : 'فایل پیدا نشد'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onToggleBookmark}
              className={`p-1.5 rounded-lg backdrop-blur-md transition-all cursor-pointer ${
                asset.isBookmarked 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : 'bg-black/50 hover:bg-black/80 text-white/80 hover:text-white'
              }`}
              title={asset.isBookmarked ? (isEn ? 'Remove from favorites' : 'حذف از علاقه‌مندی‌ها') : (isEn ? 'Add to favorites' : 'افزودن به علاقه‌مندی‌ها')}
            >
              <Bookmark className={`w-3.5 h-3.5 ${asset.isBookmarked ? 'fill-white' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Card Info & Footer */}
      <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-[var(--text)] line-clamp-1 mb-1" title={asset.title}>
            {asset.title}
          </h4>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {asset.tags.map((tag, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--input-bg)] text-[var(--text3)] border border-[var(--border)]">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          {!asset.mediaId && !asset.libraryId && (
            <button
              onClick={onCopyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                isCopied 
                  ? 'bg-green-500/20 border-green-500/40 text-green-400' 
                  : 'bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span>{isEn ? 'Copied!' : 'کپی شد!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isEn ? 'Copy Link' : 'کپی لینک'}</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-1 ms-auto">
            {asset.libraryId && (
              <>
                {isMissing && onRelink && (
                  <button
                    type="button"
                    onClick={onRelink}
                    className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
                    title={isEn ? 'Relink' : 'پیوند دوباره'}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={isMissing}
                  onClick={() => !isMissing && getDesktopLibrary()?.open(asset.libraryId!)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isMissing 
                      ? 'opacity-30 cursor-not-allowed text-[var(--text3)]' 
                      : 'text-[var(--text3)] hover:text-purple-400 hover:bg-[var(--sidebar-hover)] cursor-pointer'
                  }`}
                  title={isEn ? 'Open with default app' : 'باز کردن با برنامه‌ی پیش‌فرض'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isMissing}
                  onClick={() => !isMissing && getDesktopLibrary()?.showInFolder(asset.libraryId!)}
                  className={`p-1.5 rounded-lg transition-all ${
                    isMissing 
                      ? 'opacity-30 cursor-not-allowed text-[var(--text3)]' 
                      : 'text-[var(--text3)] hover:text-indigo-400 hover:bg-[var(--sidebar-hover)] cursor-pointer'
                  }`}
                  title={isEn ? 'Show in folder' : 'نمایش در پوشه'}
                >
                  <Folder className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={onToggleBookmark}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                asset.isBookmarked 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
              }`}
              title={asset.isBookmarked ? (isEn ? 'Remove from favorites' : 'حذف از علاقه‌مندی‌ها') : (isEn ? 'Add to favorites' : 'افزودن به علاقه‌مندی‌ها')}
            >
              <Bookmark className={`w-3.5 h-3.5 ${asset.isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
            {onMoveToPackage && (
              <PackageMoveButton
                packages={packages}
                currentPackageId={asset.packageId}
                onMove={onMoveToPackage}
                onCreate={onCreatePackage}
                isEn={isEn}
              />
            )}
            {!asset.libraryId && asset.url && (
              <a
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition-all cursor-pointer"
                title={isEn ? 'Open or download' : 'باز کردن یا دانلود'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-[var(--text3)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              title={deleteTooltip}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: Audio Effect Card
interface AudioEffectCardProps {
  key?: string;
  asset: EditAsset;
  isPlaying: boolean;
  isCopied: boolean;
  isMissing?: boolean;
  onRelink?: () => void;
  onTogglePlay: () => void;
  onCopyLink: () => void;
  onToggleBookmark: () => void;
  onDelete: () => void;
  packages?: EditPackage[];
  onMoveToPackage?: (packageId: string | undefined) => void;
  onCreatePackage?: () => void;
  isEn?: boolean;
}

function AudioEffectCard({
  asset,
  isPlaying,
  isCopied,
  isMissing = false,
  onRelink,
  onTogglePlay,
  onCopyLink,
  onToggleBookmark,
  onDelete,
  packages = [],
  onMoveToPackage,
  onCreatePackage,
  isEn = false
}: AudioEffectCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(() => {
    if (asset.libraryId) return libraryMediaUrl(asset.libraryId);
    if (asset.mediaId) return null;
    return asset.url;
  });
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (isPlaying && !isMissing) {
      if (asset.libraryId) {
        setPlayUrl(libraryMediaUrl(asset.libraryId));
      } else if (asset.mediaId) {
        getMediaObjectUrl(asset.mediaId, 'original').then((url) => {
          if (!isCancelled && url) {
            setPlayUrl(url);
          }
        });
      } else {
        setPlayUrl(asset.url);
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [isPlaying, isMissing, asset.mediaId, asset.libraryId, asset.url]);

  const activeSrc = asset.libraryId ? libraryMediaUrl(asset.libraryId) : (asset.mediaId ? playUrl : asset.url);

  // Strictly controlled audio playback: NO AUTOPLAY ON LOAD
  useEffect(() => {
    if (!audioRef.current || !activeSrc || isMissing) return;
    if (isPlaying && !playbackError) {
      audioRef.current.play().catch(e => console.log('Audio play prevented:', e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, activeSrc, playbackError, isMissing]);

  const catMap: Record<string, string> = {
    'میم': isEn ? 'Meme' : 'میم',
    'گرین اسکرین': isEn ? 'Green Screen' : 'گرین اسکرین',
    'ساند افکت': isEn ? 'Sound Effect' : 'ساند افکت',
    'ری‌اکشن': isEn ? 'Reaction' : 'ری‌اکشن',
    'ترانزیشن': isEn ? 'Transition' : 'ترانزیشن',
    'ویروسی': isEn ? 'Viral' : 'ویروسی'
  };

  const deleteTooltip = asset.libraryId
    ? (isEn ? 'Removes from the list only; the original file is untouched' : 'فقط از فهرست حذف می‌شود، فایل اصلی دست نمی‌خورد')
    : (isEn ? 'Delete' : 'حذف');

  return (
    <div className={`group relative flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-sm hover:shadow-md transition-all duration-200 ${
      isMissing ? 'opacity-70 border-red-500/30' : ''
    }`}>
      {!isMissing && isPlaying && activeSrc && (
        <audio
          ref={audioRef}
          src={activeSrc}
          preload="none"
          onEnded={onTogglePlay}
          onError={() => setPlaybackError(true)}
        />
      )}

      {/* Play/Pause Audio Button */}
      {isMissing ? (
        <button
          disabled
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[var(--input-bg)] opacity-40 cursor-not-allowed border border-[var(--border)] text-[var(--text3)]"
          title={isEn ? 'File not found' : 'فایل پیدا نشد'}
        >
          <Play className="w-5 h-5 fill-[var(--text3)] translate-x-[-1px]" />
        </button>
      ) : (
        <button
          onClick={() => {
            if (playbackError) setPlaybackError(false);
            onTogglePlay();
          }}
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm ${
            isPlaying 
              ? 'bg-pink-600 text-white shadow-pink-600/30' 
              : 'bg-[var(--input-bg)] hover:bg-pink-600/10 hover:border-pink-500/30 text-pink-400 border border-[var(--border)]'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-white" />
          ) : (
            <Play className="w-5 h-5 fill-pink-400 translate-x-[-1px]" />
          )}
        </button>
      )}

      {/* Audio Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-bold text-[var(--text)] truncate" title={asset.title}>
            {asset.title}
          </h4>
          <span className="text-[10px] font-mono text-[var(--text3)] shrink-0">
            {asset.duration || '0:03'}
          </span>
        </div>

        {/* Waveform / Visual animation, Error message or Missing Badge */}
        {isMissing ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded font-medium">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>{isEn ? 'File not found' : 'فایل پیدا نشد'}</span>
            </span>
            {onRelink && (
              <button
                type="button"
                onClick={onRelink}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Link2 className="w-2.5 h-2.5" />
                <span>{isEn ? 'Relink' : 'پیوند دوباره'}</span>
              </button>
            )}
          </div>
        ) : playbackError ? (
          <div className="flex items-center justify-between gap-1 p-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300">
            <span className="truncate">
              {isEn ? 'Format cannot be played inside app' : 'این قالب داخل برنامه پخش نمی‌شود'}
            </span>
            {asset.libraryId && getDesktopLibrary() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  getDesktopLibrary()?.open(asset.libraryId!);
                }}
                className="px-1.5 py-0.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-semibold shrink-0 cursor-pointer"
              >
                {isEn ? 'Open' : 'باز کردن'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 h-3">
            {isPlaying ? (
              <div className="flex items-center gap-0.5 h-full py-0.5">
                {[0.4, 0.9, 0.3, 0.8, 0.5, 1, 0.4, 0.7].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ['20%', '100%', '30%'] }}
                    transition={{ repeat: Infinity, duration: 0.5 + i * 0.1, ease: 'easeInOut' }}
                    className="w-0.5 bg-pink-500 rounded-full"
                  />
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-pink-400/80 bg-pink-500/10 px-1.5 py-0.2 rounded font-medium">
                {catMap[asset.category] || asset.category}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {!asset.mediaId && !asset.libraryId && (
          <button
            onClick={onCopyLink}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isCopied 
                ? 'bg-green-500/20 border-green-500/40 text-green-400' 
                : 'bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border-[var(--border)] text-[var(--text2)]'
            }`}
            title={isEn ? 'Copy direct link' : 'کپی لینک مستقیم'}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
          </button>
        )}

        {asset.libraryId && (
          <>
            {isMissing && onRelink && (
              <button
                type="button"
                onClick={onRelink}
                className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
                title={isEn ? 'Relink' : 'پیوند دوباره'}
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={isMissing}
              onClick={() => !isMissing && getDesktopLibrary()?.open(asset.libraryId!)}
              className={`p-1.5 rounded-lg transition-all ${
                isMissing 
                  ? 'opacity-30 cursor-not-allowed text-[var(--text3)]' 
                  : 'text-[var(--text3)] hover:text-purple-400 hover:bg-[var(--sidebar-hover)] cursor-pointer'
              }`}
              title={isEn ? 'Open with default app' : 'باز کردن با برنامه‌ی پیش‌فرض'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={isMissing}
              onClick={() => !isMissing && getDesktopLibrary()?.showInFolder(asset.libraryId!)}
              className={`p-1.5 rounded-lg transition-all ${
                isMissing 
                  ? 'opacity-30 cursor-not-allowed text-[var(--text3)]' 
                  : 'text-[var(--text3)] hover:text-indigo-400 hover:bg-[var(--sidebar-hover)] cursor-pointer'
              }`}
              title={isEn ? 'Show in folder' : 'نمایش در پوشه'}
            >
              <Folder className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          onClick={onToggleBookmark}
          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
            asset.isBookmarked 
              ? 'bg-amber-500/20 text-amber-400' 
              : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)]'
          }`}
          title={asset.isBookmarked ? (isEn ? 'Remove from favorites' : 'حذف از علاقه‌مندی‌ها') : (isEn ? 'Add to favorites' : 'افزودن به علاقه‌مندی‌ها')}
        >
          <Bookmark className={`w-3.5 h-3.5 ${asset.isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>

            {onMoveToPackage && (
              <PackageMoveButton
                packages={packages}
                currentPackageId={asset.packageId}
                onMove={onMoveToPackage}
                onCreate={onCreatePackage}
                isEn={isEn}
              />
            )}

        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-[var(--text3)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          title={deleteTooltip}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

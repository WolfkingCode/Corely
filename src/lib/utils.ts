/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Shamsi months in Persian
export const SHAMSI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

export const DAYS_FA = [
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه'
];

export const DAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export interface ShamsiDate {
  jy: number;
  jm: number;
  jd: number;
}

export function getShamsiParts(date: Date): ShamsiDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  
  let jm = 0;
  let jd = 0;
  
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  
  return { jy, jm, jd };
}

export function isShamsiLeapYear(jy: number): boolean {
  const r = jy % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(r);
}

export function getDaysInShamsiMonth(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) {
    return isShamsiLeapYear(jy) ? 30 : 29;
  }
  return 30;
}

export function formatShamsi(date: Date): string {
  const p = getShamsiParts(date);
  return `${p.jd} ${SHAMSI_MONTHS[p.jm - 1]} ${p.jy}`;
}

export function getLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getWeekKey(date: Date = new Date()): string {
  const day = date.getDay();
  const m = new Date(date);
  m.setDate(date.getDate() - day);
  return getLocalDateKey(m);
}

// ─── IndexedDB wrapper for large images & assets storage (to bypass LocalStorage quota) ───
let dbPromise: Promise<IDBDatabase> | null = null;

export function openBgDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('myAppBgDB', 3);
    req.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'key', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('media')) {
        db.createObjectStore('media', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e: any) => {
      const db: IDBDatabase = e.target.result;
      // Release the connection if another request (e.g. deleteDatabase) needs it.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = (e: any) => {
      dbPromise = null;
      reject(e.target.error);
    };
  });
  return dbPromise;
}

/** Empties every object store (used by full reset so data is gone even if deleteDatabase is blocked). */
export async function dbClearAll(): Promise<boolean> {
  try {
    const db = await openBgDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(['images', 'assets', 'media'], 'readwrite');
      tx.objectStore('images').clear();
      tx.objectStore('assets').clear();
      tx.objectStore('media').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Closes the cached IndexedDB connection so the database can be deleted. */
export async function closeBgDB(): Promise<void> {
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    db.close();
  } catch {
    // ignore
  }
  dbPromise = null;
}

export async function dbAddImage(dataUrl: string): Promise<number> {
  const db = await openBgDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite');
    const req = tx.objectStore('images').add({ dataUrl });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetAllImages(): Promise<{ key: number; dataUrl: string }[]> {
  const db = await openBgDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readonly');
    const req = tx.objectStore('images').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDeleteImage(key: number): Promise<void> {
  const db = await openBgDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite');
    const req = tx.objectStore('images').delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbSaveEditAssets(assets: any[]): Promise<boolean> {
  try {
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      store.put({ key: 'v3_edit_assets', value: assets });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to save edit assets to IndexedDB:', e);
    return false;
  }
}

export async function dbGetEditAssets(): Promise<any[] | null> {
  try {
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const req = store.get('v3_edit_assets');
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('Failed to load edit assets from IndexedDB:', e);
    return null;
  }
}

/** Stores a media file (video/audio/large image) as a Blob in its own object store. */
export async function dbPutMedia(id: string, blob: Blob): Promise<boolean> {
  try {
    const db = await openBgDB();
    return await new Promise((resolve) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put({ id, blob, type: blob.type, size: blob.size });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to save media to IndexedDB:', e);
    return false;
  }
}

/** Reads a media Blob back by id (null if missing). */
export async function dbGetMedia(id: string): Promise<Blob | null> {
  try {
    const db = await openBgDB();
    return await new Promise((resolve) => {
      const req = db.transaction('media', 'readonly').objectStore('media').get(id);
      req.onsuccess = () => resolve(req.result && req.result.blob instanceof Blob ? req.result.blob : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('Failed to load media from IndexedDB:', e);
    return null;
  }
}

/** Deletes one stored media file. */
export async function dbDeleteMedia(id: string): Promise<boolean> {
  try {
    const db = await openBgDB();
    return await new Promise((resolve) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Lists the ids of all stored media files. */
export async function dbListMediaIds(): Promise<string[]> {
  try {
    const db = await openBgDB();
    return await new Promise((resolve) => {
      const req = db.transaction('media', 'readonly').objectStore('media').getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => String(k)));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

let sequentialQueue: Promise<unknown> = Promise.resolve();

export function runSequentially<T>(job: () => Promise<T>): Promise<T> {
  const run = () => job();
  const result = sequentialQueue.then(run, run);
  sequentialQueue = result.catch(() => {});
  return result;
}

export async function makeImageThumbnailBlob(blob: Blob, maxSide = 360): Promise<Blob | null> {
  if (!blob || blob.size < 60 * 1024) return null;
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob, { resizeWidth: maxSide, resizeQuality: 'medium' });
    } catch {
      bitmap = await createImageBitmap(blob);
    }

    try {
      let targetW = bitmap.width;
      let targetH = bitmap.height;
      if (targetW > maxSide || targetH > maxSide) {
        const scale = Math.min(maxSide / targetW, maxSide / targetH);
        targetW = Math.max(1, Math.round(targetW * scale));
        targetH = Math.max(1, Math.round(targetH * scale));
      }

      let resultBlob: Blob | null = null;
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          try {
            resultBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.72 });
          } catch {
            resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
          }
        }
      } else if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          resultBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else {
                  canvas.toBlob(resolve, 'image/jpeg', 0.75);
                }
              },
              'image/webp',
              0.72
            );
          });
        }
      }
      return resultBlob;
    } finally {
      bitmap.close();
    }
  } catch (err) {
    console.warn('makeImageThumbnailBlob error:', err);
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIndex = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || commaIndex < 0) return null;
  const header = dataUrl.slice(5, commaIndex);
  const isBase64 = header.includes(';base64');
  const mime = header.split(';')[0] || 'application/octet-stream';
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (!isBase64) {
      return new Blob([decodeURIComponent(payload)], { type: mime });
    }
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export async function dbExportAll(): Promise<{
  images: { key: number; dataUrl: string }[];
  assets: { key: string; value: unknown }[];
  media: { id: string; type: string; dataUrl: string }[];
  skippedMedia: { count: number; bytes: number };
}> {
  const db = await openBgDB();
  const MAX_SIZE = 1048576; // 1 MB

  const { images, assets, acceptedMedia, skippedMedia } = await new Promise<{
    images: { key: number; dataUrl: string }[];
    assets: { key: string; value: unknown }[];
    acceptedMedia: { id: string; type: string; blob: Blob }[];
    skippedMedia: { count: number; bytes: number };
  }>((resolve, reject) => {
    const tx = db.transaction(['images', 'assets', 'media'], 'readonly');
    const imagesReq = tx.objectStore('images').getAll();
    const assetsReq = tx.objectStore('assets').getAll();

    const acceptedMedia: { id: string; type: string; blob: Blob }[] = [];
    const skippedMedia = { count: 0, bytes: 0 };

    const mediaCursorReq = tx.objectStore('media').openCursor();
    mediaCursorReq.onsuccess = () => {
      const cursor = mediaCursorReq.result;
      if (cursor) {
        const val = cursor.value;
        if (val && typeof val.id === 'string' && val.blob instanceof Blob) {
          const size = typeof val.blob.size === 'number' ? val.blob.size : 0;
          if (val.id.endsWith('-t') || size <= MAX_SIZE) {
            acceptedMedia.push({
              id: val.id,
              type: val.type || val.blob.type || '',
              blob: val.blob,
            });
          } else {
            skippedMedia.count += 1;
            skippedMedia.bytes += size;
          }
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => {
      resolve({
        images: (imagesReq.result as { key: number; dataUrl: string }[]) || [],
        assets: (assetsReq.result as { key: string; value: unknown }[]) || [],
        acceptedMedia,
        skippedMedia,
      });
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  const media: { id: string; type: string; dataUrl: string }[] = [];
  for (const item of acceptedMedia) {
    try {
      media.push({
        id: item.id,
        type: item.type,
        dataUrl: await blobToDataUrl(item.blob),
      });
    } catch (e) {
      console.warn('Skipping unreadable media item in export:', item.id, e);
    }
  }

  return { images, assets, media, skippedMedia };
}

export async function dbImportAll(data: {
  images?: { key: number; dataUrl: string }[];
  assets?: { key: string; value: unknown }[];
  media?: { id: string; type?: string; dataUrl: string }[];
}): Promise<void> {
  const hasImages = Array.isArray(data?.images);
  const hasAssets = Array.isArray(data?.assets);
  const hasMedia = Array.isArray(data?.media);

  if (!hasImages && !hasAssets && !hasMedia) {
    return;
  }

  // Convert media data URLs back to Blobs BEFORE opening the transaction
  // (a transaction auto-commits if we await non-IndexedDB work inside it).
  const mediaRecords: { id: string; blob: Blob; type: string; size: number }[] = [];
  if (hasMedia && data.media) {
    for (const item of data.media) {
      if (!item || typeof item.id !== 'string' || typeof item.dataUrl !== 'string') continue;
      const blob = dataUrlToBlob(item.dataUrl);
      if (blob) {
        mediaRecords.push({ id: item.id, blob, type: blob.type, size: blob.size });
      } else {
        console.warn('Skipping unreadable media item in import:', item.id);
      }
    }
  }

  const db = await openBgDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['images', 'assets', 'media'], 'readwrite');

    if (hasImages && data.images) {
      const imgStore = tx.objectStore('images');
      imgStore.clear();
      for (const item of data.images) {
        imgStore.put(item);
      }
    }

    if (hasAssets && data.assets) {
      const assetStore = tx.objectStore('assets');
      assetStore.clear();
      for (const item of data.assets) {
        assetStore.put(item);
      }
    }

    if (hasMedia) {
      const mediaStore = tx.objectStore('media');
      // Do not clear mediaStore; only put (merge)
      for (const record of mediaRecords) {
        mediaStore.put(record);
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ─── Goal Images Storage (Multiple PNG/WebP/JPEG Assets with Individual Positions in IndexedDB) ───
import { GoalImageTransform, GoalImageItem, DEFAULT_GOAL_IMAGE_TRANSFORM } from '../types';

export const GOAL_IMAGE_POS_KEY = 'v3_goal_image_position';

export async function dbGetGoalImages(): Promise<GoalImageItem[]> {
  try {
    const db = await openBgDB();
    const images: GoalImageItem[] | null = await new Promise((resolve) => {
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const req = store.get('v3_goal_images');
      req.onsuccess = () => {
        resolve(req.result ? (req.result.value as GoalImageItem[]) : null);
      };
      req.onerror = () => resolve(null);
    });

    if (Array.isArray(images) && images.length > 0) {
      return images;
    }

    // Auto-migration: check if a legacy single goal image exists
    const legacyDataUrl: string | null = await new Promise((resolve) => {
      const tx = db.transaction('assets', 'readonly');
      const store = tx.objectStore('assets');
      const req = store.get('v3_goal_image');
      req.onsuccess = () => {
        resolve(req.result ? (req.result.value as string) : null);
      };
      req.onerror = () => resolve(null);
    });

    if (legacyDataUrl) {
      const legacyTransform = getStoredGoalImageTransform();
      const migratedItem: GoalImageItem = {
        id: 'goal_' + Date.now(),
        dataUrl: legacyDataUrl,
        transform: legacyTransform,
        createdAt: Date.now()
      };
      const migratedList = [migratedItem];
      // Save migrated list to v3_goal_images
      await new Promise<void>((resolve) => {
        const tx = db.transaction('assets', 'readwrite');
        const store = tx.objectStore('assets');
        store.put({ key: 'v3_goal_images', value: migratedList });
        store.delete('v3_goal_image');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return migratedList;
    }

    return [];
  } catch (e) {
    console.warn('Failed to load goal images from IndexedDB:', e);
    return [];
  }
}

export async function dbAddGoalImage(item: GoalImageItem): Promise<boolean> {
  try {
    const current = await dbGetGoalImages();
    const updated = [...current, item];
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      store.put({ key: 'v3_goal_images', value: updated });
      tx.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('goal-images-updated', { detail: updated }));
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to add goal image to IndexedDB:', e);
    return false;
  }
}

export async function dbUpdateGoalImagePosition(id: string, transform: GoalImageTransform): Promise<boolean> {
  try {
    const current = await dbGetGoalImages();
    const updated = current.map((img) => (img.id === id ? { ...img, transform } : img));
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      store.put({ key: 'v3_goal_images', value: updated });
      tx.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('goal-images-updated', { detail: updated }));
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to update goal image position in IndexedDB:', e);
    return false;
  }
}

export async function dbUpdateGoalImageEnabled(id: string, enabled: boolean): Promise<boolean> {
  try {
    const current = await dbGetGoalImages();
    const updated = current.map((img) => (img.id === id ? { ...img, enabled } : img));
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      store.put({ key: 'v3_goal_images', value: updated });
      tx.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('goal-images-updated', { detail: updated }));
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to update goal image enabled state in IndexedDB:', e);
    return false;
  }
}

export async function dbDeleteGoalImage(id: string): Promise<boolean> {
  try {
    const current = await dbGetGoalImages();
    const updated = current.filter((img) => img.id !== id);
    const db = await openBgDB();
    return new Promise((resolve) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      store.put({ key: 'v3_goal_images', value: updated });
      tx.oncomplete = () => {
        window.dispatchEvent(new CustomEvent('goal-images-updated', { detail: updated }));
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to delete goal image from IndexedDB:', e);
    return false;
  }
}

// Legacy single-image helpers for backward compatibility
export async function dbSaveGoalImage(dataUrl: string): Promise<boolean> {
  const item: GoalImageItem = {
    id: 'goal_' + Date.now(),
    dataUrl,
    transform: getStoredGoalImageTransform(),
    createdAt: Date.now()
  };
  return dbAddGoalImage(item);
}

export async function dbGetGoalImage(): Promise<string | null> {
  const list = await dbGetGoalImages();
  return list.length > 0 ? list[0].dataUrl : null;
}

export function getStoredGoalImageTransform(): GoalImageTransform {
  const loaded = loadFromLocalStorage<Partial<GoalImageTransform>>(GOAL_IMAGE_POS_KEY, DEFAULT_GOAL_IMAGE_TRANSFORM);
  return {
    ...DEFAULT_GOAL_IMAGE_TRANSFORM,
    ...loaded,
    rotationDeg: typeof loaded?.rotationDeg === 'number' ? loaded.rotationDeg : 0
  };
}

export function saveStoredGoalImageTransform(transform: GoalImageTransform): boolean {
  const res = saveToLocalStorage(GOAL_IMAGE_POS_KEY, transform);
  window.dispatchEvent(new CustomEvent('goal-image-pos-updated', { detail: transform }));
  return res;
}

// Safe LocalStorage helpers
export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function saveToLocalStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`LocalStorage write skipped or failed for key "${key}":`, e);
    return false;
  }
}

/**
 * Maps weekday name (English/Persian) or date key to the corresponding YYYY-MM-DD date key in the current week
 */
export function getDayKeyFromWeekDay(dayName: string): string {
  if (!dayName) return getLocalDateKey(new Date());

  const trimmed = dayName.trim();
  // If already a YYYY-MM-DD date key, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const today = new Date();
  const todayDow = today.getDay();
  const satOffset = todayDow >= 6 ? 0 : todayDow + 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - satOffset);

  const dayMap: Record<string, number> = {
    saturday: 0,
    sat: 0,
    'شنبه': 0,
    sunday: 1,
    sun: 1,
    'یکشنبه': 1,
    'یک‌شنبه': 1,
    monday: 2,
    mon: 2,
    'دوشنبه': 2,
    tuesday: 3,
    tue: 3,
    'سه‌شنبه': 3,
    'سه شنبه': 3,
    wednesday: 4,
    wed: 4,
    'چهارشنبه': 4,
    thursday: 5,
    thu: 5,
    'پنج‌شنبه': 5,
    'پنجشنبه': 5,
    friday: 6,
    fri: 6,
    'جمعه': 6,
    today: (todayDow >= 6 ? 0 : todayDow + 1),
    'امروز': (todayDow >= 6 ? 0 : todayDow + 1),
    tomorrow: ((todayDow >= 6 ? 0 : todayDow + 1) + 1) % 7,
    'فردا': ((todayDow >= 6 ? 0 : todayDow + 1) + 1) % 7
  };

  const normalized = trimmed.toLowerCase().replace(/[\s_\-‌]/g, '');
  
  let targetIndex = 0;
  let found = false;
  for (const [key, idx] of Object.entries(dayMap)) {
    const cleanKey = key.toLowerCase().replace(/[\s_\-‌]/g, '');
    if (normalized === cleanKey || normalized.includes(cleanKey) || cleanKey.includes(normalized)) {
      targetIndex = idx;
      found = true;
      break;
    }
  }

  if (!found) {
    targetIndex = todayDow >= 6 ? 0 : todayDow + 1;
  }

  const targetDate = new Date(weekStart);
  targetDate.setDate(weekStart.getDate() + targetIndex);
  return getLocalDateKey(targetDate);
}

export function getGeminiKey(): string {
  try {
    const raw = localStorage.getItem('v3_settings');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.geminiApiKey === 'string') {
      return parsed.geminiApiKey.trim();
    }
    return '';
  } catch {
    return '';
  }
}

export function getAiProxyUrl(): string {
  try {
    const raw = localStorage.getItem('v3_settings');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.aiProxyEnabled !== true) {
      return '';
    }
    if (typeof parsed.aiProxyUrl === 'string') {
      return parsed.aiProxyUrl.trim();
    }
    return '';
  } catch {
    return '';
  }
}

export function getAiProviderConfig(): { provider: 'gemini' | 'openai'; baseUrl: string; apiKey: string; model: string } {
  try {
    const raw = localStorage.getItem('v3_settings');
    if (!raw) {
      return { provider: 'gemini', baseUrl: '', apiKey: '', model: '' };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { provider: 'gemini', baseUrl: '', apiKey: '', model: '' };
    }
    const provider: 'gemini' | 'openai' = parsed.aiProvider === 'openai' ? 'openai' : 'gemini';
    const baseUrl = typeof parsed.openaiBaseUrl === 'string' ? parsed.openaiBaseUrl.trim() : '';
    const apiKey = typeof parsed.openaiApiKey === 'string' ? parsed.openaiApiKey.trim() : '';
    const model = typeof parsed.openaiModel === 'string' ? parsed.openaiModel.trim() : '';
    return { provider, baseUrl, apiKey, model };
  } catch {
    return { provider: 'gemini', baseUrl: '', apiKey: '', model: '' };
  }
}


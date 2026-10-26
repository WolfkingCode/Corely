/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbGetMedia } from './utils';

type CacheEntry = {
  url: string;
  kind: 'thumb' | 'original';
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
const originalOrder: string[] = [];
let protectedOriginalIds = new Set<string>();

export function setProtectedOriginalIds(ids: string[]): void {
  protectedOriginalIds = new Set(ids.filter(Boolean));
}

// Concurrency queue: maximum 4 concurrent reads from IndexedDB
let activeReads = 0;
const readQueue: (() => void)[] = [];

function acquireReadSlot(): Promise<void> {
  if (activeReads < 4) {
    activeReads++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    readQueue.push(() => {
      activeReads++;
      resolve();
    });
  });
}

function releaseReadSlot(): void {
  activeReads--;
  if (readQueue.length > 0 && activeReads < 4) {
    const next = readQueue.shift();
    if (next) next();
  }
}

function touchOriginal(id: string): void {
  const idx = originalOrder.indexOf(id);
  if (idx !== -1) {
    originalOrder.splice(idx, 1);
  }
  originalOrder.push(id);
  pruneOriginals();
}

function pruneOriginals(): void {
  // Retain maximum 8 original URLs, skipping protected IDs
  while (originalOrder.length > 8) {
    let evictIndex = -1;
    for (let i = 0; i < originalOrder.length; i++) {
      const candidateId = originalOrder[i];
      if (!protectedOriginalIds.has(candidateId)) {
        evictIndex = i;
        break;
      }
    }
    if (evictIndex === -1) {
      break;
    }
    const [evictedId] = originalOrder.splice(evictIndex, 1);
    const entry = cache.get(evictedId);
    if (entry) {
      try {
        URL.revokeObjectURL(entry.url);
      } catch {
        // ignore
      }
      cache.delete(evictedId);
    }
  }
}

export async function getMediaObjectUrl(
  id: string,
  kind: 'thumb' | 'original' = 'thumb'
): Promise<string | null> {
  if (!id) return null;

  const cached = cache.get(id);
  if (cached) {
    if (kind === 'original') {
      touchOriginal(id);
    }
    return cached.url;
  }

  const pending = inFlight.get(id);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    await acquireReadSlot();
    try {
      const blob = await dbGetMedia(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      cache.set(id, { url, kind });
      if (kind === 'original') {
        touchOriginal(id);
      }
      return url;
    } catch (e) {
      console.warn('Failed to get media object URL for:', id, e);
      return null;
    } finally {
      releaseReadSlot();
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, promise);
  return promise;
}

export function releaseMediaObjectUrl(id: string): void {
  if (!id) return;
  const entry = cache.get(id);
  if (entry) {
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // ignore
    }
    cache.delete(id);
  }
  const idx = originalOrder.indexOf(id);
  if (idx !== -1) {
    originalOrder.splice(idx, 1);
  }
}

export function revokeAllMediaObjectUrls(): void {
  for (const entry of cache.values()) {
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // ignore
    }
  }
  cache.clear();
  inFlight.clear();
  originalOrder.length = 0;
  readQueue.length = 0;
  activeReads = 0;
}

export const libraryMediaUrl = (libraryId: string): string => `corely-media://f/${libraryId}`;

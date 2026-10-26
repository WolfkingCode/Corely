declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

export interface LibraryEntry {
  id: string;
  name: string;
  size: number;
  kind: 'video' | 'audio' | 'image';
  ext: string;
  parentName: string;
}

export interface DownloadProgressEvent {
  id: string;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
  received: number;
  total: number;
  speed: number;
  savedName?: string;
  error?: string;
}

declare global {
  interface Window {
    corelyDesktop?: {
      library?: {
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
      downloads?: {
        start(payload: any): Promise<any>;
        pause(id: string): Promise<any>;
        cancel(id: string): Promise<any>;
        remove(id: string): Promise<any>;
        list(): Promise<any>;
        showInFolder(id: string): Promise<{ ok: boolean; error?: string } | any>;
        onProgress(cb: (data: DownloadProgressEvent) => void): () => void;
      };
      [key: string]: any;
    };
  }
}

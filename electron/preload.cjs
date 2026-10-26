const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('corelyDesktop', {
  showNotification: (opts) => ipcRenderer.send('notify', opts),
  setDns: (opts) => ipcRenderer.invoke('dns:set', opts),
  getDns: () => ipcRenderer.invoke('dns:get'),
  isAdmin: () => ipcRenderer.invoke('app:isAdmin'),
  getAutoStart: () => ipcRenderer.invoke('app:getAutoStart'),
  setAutoStart: (enabled) => ipcRenderer.invoke('app:setAutoStart', enabled),
  ai: {
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    generateRoutineSuggestions: (payload) => ipcRenderer.invoke('ai:generate-routine-suggestions', payload),
    listModels: (payload) => ipcRenderer.invoke('ai:list-models', payload)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (cb) => ipcRenderer.on('window:maximized-changed', (_e, val) => cb(val))
  },
  library: {
    pickFiles: () => ipcRenderer.invoke('library:pick-files'),
    pickFolder: () => ipcRenderer.invoke('library:pick-folder'),
    status: (ids) => ipcRenderer.invoke('library:status', ids),
    open: (id) => ipcRenderer.invoke('library:open', id),
    showInFolder: (id) => ipcRenderer.invoke('library:show-in-folder', id),
    relink: (id, kind) => ipcRenderer.invoke('library:relink', id, kind),
    relinkFolder: (items) => ipcRenderer.invoke('library:relink-folder', items),
    forget: (ids) => ipcRenderer.invoke('library:forget', ids),
    clearAll: () => ipcRenderer.invoke('library:clear-all')
  },
  downloads: {
    start: (payload) => ipcRenderer.invoke('downloads:start', payload),
    pause: (id) => ipcRenderer.invoke('downloads:pause', id),
    cancel: (id) => ipcRenderer.invoke('downloads:cancel', id),
    remove: (id) => ipcRenderer.invoke('downloads:remove', id),
    list: () => ipcRenderer.invoke('downloads:list'),
    showInFolder: (id) => ipcRenderer.invoke('downloads:show-in-folder', id),
    onProgress: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on('downloads:progress', handler);
      return () => ipcRenderer.removeListener('downloads:progress', handler);
    }
  },
  isDesktop: true
});

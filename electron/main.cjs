const { app, BrowserWindow, ipcMain, Notification, Menu, Tray, nativeImage, screen, protocol, shell, dialog } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');

if (process.argv.includes('--corely-dns-helper')) {
  require('./dns-helper.cjs');
  return;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: 'corely-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.onnx': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4'
};

// ─── Security helpers ───
const APP_ORIGIN = 'app://corely';
const DEV_URL = (process.env.ELECTRON_DEV_URL || '').trim();

function getDevOrigin() {
  if (!DEV_URL) return null;
  try {
    return new URL(DEV_URL).origin;
  } catch {
    return null;
  }
}

// Only our own UI (app://corely or the optional dev URL) may talk to the main process.
function isTrustedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const u = new URL(rawUrl);
    if (u.protocol === 'app:' && u.host === 'corely') return true;
    const devOrigin = getDevOrigin();
    return !!devOrigin && u.origin === devOrigin;
  } catch {
    return false;
  }
}

function isTrustedSender(event) {
  const frameUrl = event?.senderFrame?.url || '';
  return isTrustedUrl(frameUrl);
}

function secureHandle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error('untrusted_sender');
    }
    return handler(event, ...args);
  });
}

function secureOn(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event)) return;
    handler(event, ...args);
  });
}

function openExternalSafely(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
      shell.openExternal(u.toString());
    }
  } catch {
    // ignore malformed URLs
  }
}

function isValidIPv4(value) {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

// Adapter names are interpolated into shell commands: reject anything that could break out of quotes.
function isSafeAdapterName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 256 && !/["%^&|<>`\r\n]/.test(name);
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://staticimgly.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: corely-media:",
  "media-src 'self' data: blob: https: corely-media:",
  "connect-src 'self' data: blob: https: http: corely-media:",
  "worker-src 'self' blob: https://staticimgly.com",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

async function getUiLanguage(contents) {
  if (!contents || contents.isDestroyed?.()) return 'en';
  try {
    const raw = await contents.executeJavaScript("localStorage.getItem('v3_settings')");
    if (!raw) return 'en';
    const settings = JSON.parse(raw);
    return settings?.language === 'fa' ? 'fa' : 'en';
  } catch {
    return 'en';
  }
}

// Every web contents (main window or any popup) gets the same guards.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  const blockUntrustedNavigation = (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault();
      openExternalSafely(url);
    }
  };
  contents.on('will-navigate', blockUntrustedNavigation);
  contents.on('will-redirect', blockUntrustedNavigation);

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  contents.on('context-menu', async (_event, params) => {
    if (contents.isDestroyed()) return;
    const lang = await getUiLanguage(contents);
    if (contents.isDestroyed()) return;

    const isFa = lang === 'fa';
    const labels = isFa
      ? { cut: 'برش', copy: 'کپی', paste: 'چسباندن', selectAll: 'انتخاب همه' }
      : { cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all' };

    const hasSelection = typeof params.selectionText === 'string' && params.selectionText.trim().length > 0;
    const template = [];
    if (params.isEditable) {
      template.push(
        { label: labels.cut, role: 'cut', enabled: params.editFlags.canCut },
        { label: labels.copy, role: 'copy', enabled: params.editFlags.canCopy },
        { label: labels.paste, role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { label: labels.selectAll, role: 'selectAll', enabled: params.editFlags.canSelectAll }
      );
    } else if (hasSelection) {
      template.push(
        { label: labels.copy, role: 'copy' },
        { type: 'separator' },
        { label: labels.selectAll, role: 'selectAll' }
      );
    }
    if (template.length === 0) return;
    Menu.buildFromTemplate(template).popup();
  });
});

let genAiModule = null;
async function loadGenAI() {
  if (!genAiModule) {
    genAiModule = await import('@google/genai');
  }
  return genAiModule;
}

const Type = {
  TYPE_UNSPECIFIED: 'TYPE_UNSPECIFIED',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
  NULL: 'NULL'
};

const toolDeclarations = [
  {
    name: 'add_task',
    description: 'افزودن کار یا وظیفه جدید به لیست کارها (todos) یا افزودن قلم جدید به لیست خرید (shopping)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ['todos', 'shopping'],
          description: 'نوع آیتم: "todos" برای لیست کارها، "shopping" برای اقلام لیست خرید'
        },
        text: {
          type: Type.STRING,
          description: 'عنوان یا متن کار یا قلم خرید'
        },
        priority: {
          type: Type.STRING,
          enum: ['urgent', 'important', 'normal'],
          description: 'سطح اولویت کار (اختیاری): "urgent" (فوری)، "important" (مهم)، "normal" (عادی)'
        },
        category: {
          type: Type.STRING,
          description: 'دسته‌بندی اختیاری مانند کار، شخصی، مطالعه'
        }
      },
      required: ['type', 'text']
    }
  },
  {
    name: 'add_weekly_task',
    description: 'افزودن یک کار یا برنامه به یکی از روزهای هفته جاری (شنبه تا جمعه)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        day: {
          type: Type.STRING,
          enum: ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          description: 'روز هفته به انگلیسی: saturday (شنبه), sunday (یکشنبه), monday (دوشنبه), tuesday (سه‌شنبه), wednesday (چهارشنبه), thursday (پنج‌شنبه), friday (جمعه)'
        },
        text: {
          type: Type.STRING,
          description: 'عنوان یا متن کار برای آن روز'
        }
      },
      required: ['day', 'text']
    }
  },
  {
    name: 'add_transaction',
    description: 'ثبت یک تراکنش مالی جدید اعم از درآمد یا هزینه در بخش حسابداری و مدیریت مالی',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ['expense', 'income'],
          description: 'نوع تراکنش: "expense" برای هزینه و مخارج، "income" برای درآمد و دریافتی'
        },
        amount: {
          type: Type.NUMBER,
          description: 'مبلغ تراکنش به عدد (تومان)'
        },
        category: {
          type: Type.STRING,
          description: 'دسته‌بندی تراکنش (مثلا خوراک، حقوق، حمل و نقل، اجاره، خرید، تفریح، آموزش و...)'
        },
        desc: {
          type: Type.STRING,
          description: 'شرح و توضیحات بابت تراکنش'
        }
      },
      required: ['type', 'amount', 'category', 'desc']
    }
  },
  {
    name: 'append_note',
    description: 'افزودن متن به انتهای یادداشت اصلی در بخش یادداشت‌ها بدون پاک کردن محتوای قبلی',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: 'متنی که باید به یادداشت اضافه شود'
        }
      },
      required: ['text']
    }
  }
];

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash'
];

async function generateWithRetryAndFallback(ai, params) {
  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err) {
        lastError = err;
        const errMsg = err?.message || String(err || '');
        const isTemporary =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('403') ||
          errMsg.includes('PERMISSION_DENIED') ||
          errMsg.includes('Forbidden');

        console.warn(`[Gemini API] Model "${model}" attempt ${attempt + 1} failed:`, errMsg);

        if (isTemporary && attempt === 0) {
          // Wait 600ms before retrying the same model
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        if (isTemporary) {
          // Switch to the next fallback candidate model
          break;
        } else {
          // Non-transient error (e.g. invalid arguments/schema) -> throw immediately
          throw err;
        }
      }
    }
  }

  throw lastError;
}

function formatGeminiErrorMessage(error) {
  const raw = error instanceof Error ? error.message : String(error || '');
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE' || String(parsed.error.message).includes('high demand')) {
        return 'مدل هوش مصنوعی در حال حاضر با تقاضای بسیار بالایی مواجه است. لطفاً چند لحظه بعد مجدداً تلاش فرمایید.';
      }
      if (String(parsed.error.message).includes('API_KEY_INVALID') || String(parsed.error.message).includes('API key not valid')) {
        return 'کلید API وارد شده نامعتبر است. لطفاً کلید صحیح را در تنظیمات وارد کنید.';
      }
      if (parsed.error.code === 403 || parsed.error.status === 'PERMISSION_DENIED' || String(parsed.error.message).includes('PERMISSION_DENIED') || String(parsed.error.message).includes('403')) {
        return 'دسترسی رد شد (خطای ۴۰۳). لطفاً کلید API یا منطقه و وی‌پی‌ان خود را بررسی کنید.';
      }
      return parsed.error.message;
    }
  } catch {
    // raw was not valid JSON string
  }

  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'مدل هوش مصنوعی در حال حاضر با تقاضای بسیار بالایی مواجه است. لطفاً چند لحظه بعد مجدداً تلاش فرمایید.';
  }

  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return 'کلید API وارد شده نامعتبر است. لطفاً کلید صحیح را در تنظیمات وارد کنید.';
  }

  if (raw.includes('<!DOCTYPE') || raw.includes('<html') || raw.includes('Error 403')) {
    return 'گوگل دسترسی درخواست را رد کرد (خطای ۴۰۳). احتمالاً به‌خاطر محدودیت منطقه یا وی‌پی‌ان است. اتصال وی‌پی‌ان را بررسی کنید و دوباره امتحان کنید.';
  }

  if (raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return 'دسترسی رد شد (خطای ۴۰۳). لطفاً کلید API یا منطقه و وی‌پی‌ان خود را بررسی کنید.';
  }

  return raw || 'خطایی در برقراری ارتباط با هوش مصنوعی رخ داد.';
}

let currentAiProxyUrl = null;

function applyAiProxy(proxyUrl) {
  if (!proxyUrl || typeof proxyUrl !== 'string' || !proxyUrl.trim()) {
    if (currentAiProxyUrl !== null) {
      const { Agent, setGlobalDispatcher } = require('undici');
      setGlobalDispatcher(new Agent());
      currentAiProxyUrl = null;
    }
    return;
  }

  const trimmed = proxyUrl.trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error('آدرس پروکسی نامعتبر است. نمونه: http://127.0.0.1:10809');
  }

  if (parsedUrl.protocol !== 'http:' || !parsedUrl.hostname) {
    throw new Error('آدرس پروکسی نامعتبر است. نمونه: http://127.0.0.1:10809');
  }

  const normalized = parsedUrl.toString();
  if (currentAiProxyUrl === normalized) {
    return;
  }

  const { ProxyAgent, setGlobalDispatcher } = require('undici');
  setGlobalDispatcher(new ProxyAgent(normalized));
  currentAiProxyUrl = normalized;
}

async function withAiProxyFallback(proxyUrl, fn) {
  applyAiProxy(proxyUrl);

  try {
    return await fn();
  } catch (error) {
    const hasProxy = typeof proxyUrl === 'string' && proxyUrl.trim().length > 0;
    const errText = String(error?.message || '');
    const causeCode = String(error?.cause?.code || '');
    const isProxyConnError =
      errText.includes('ECONNREFUSED') ||
      causeCode.includes('ECONNREFUSED') ||
      causeCode === 'ECONNRESET' ||
      causeCode === 'ENOTFOUND' ||
      causeCode === 'ETIMEDOUT';

    if (hasProxy && isProxyConnError) {
      applyAiProxy('');
      return await fn();
    }

    throw error;
  }
}

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

let mainWindow = null;
let trayIcon = null;
let isCustomMaximized = false;
let previousBounds = null;
let isQuitting = false;

function toggleCustomMaximize() {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
}

function syncMaximizedState() {
  if (!mainWindow || !mainWindow.webContents) return;
  const nowMaximized = mainWindow.isMaximized();
  if (nowMaximized !== isCustomMaximized) {
    isCustomMaximized = nowMaximized;
    mainWindow.webContents.send('window:maximized-changed', isCustomMaximized);
  }
}

function getIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
}

async function refreshTrayMenu() {
  if (!trayIcon || trayIcon.isDestroyed()) return;
  const lang = (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed())
    ? await getUiLanguage(mainWindow.webContents)
    : 'en';
  if (!trayIcon || trayIcon.isDestroyed()) return;

  const isFa = lang === 'fa';
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isFa ? 'باز کردن Corely' : 'Open Corely',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: isFa ? 'خروج' : 'Exit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  trayIcon.setContextMenu(contextMenu);
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(getIconPath());
    if (icon.isEmpty()) {
      console.error('[Electron] Tray icon is empty or invalid, skipping tray creation.');
      return;
    }
    trayIcon = new Tray(icon);
    trayIcon.setToolTip('Corely');
    refreshTrayMenu().catch(() => {});
    trayIcon.on('double-click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (err) {
    console.error('[Electron] Failed to create tray icon:', err);
  }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });

  function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      const output = `${stdout || ''} ${stderr || ''} ${err?.message || ''}`.toLowerCase();
      if (
        output.includes('requires elevation') ||
        output.includes('access is denied') ||
        output.includes('run as administrator') ||
        output.includes('دسترسی') ||
        output.includes('مدیر')
      ) {
        const elevationError = new Error('permission_denied');
        elevationError.code = 'permission_denied';
        return reject(elevationError);
      }

      if (err) {
        return reject(err);
      }
      resolve(stdout || '');
    });
  });
}

function runElevatedCommands(commands) {
  return new Promise((resolve, reject) => {
    try {
      const joined = commands.join(' && ');
      const escaped = joined.replace(/'/g, "''");
      // Exit code 1223 = user declined UAC; any other non-zero code = the netsh command itself failed.
      const psCommand = `try { $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c ${escaped}' -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ErrorAction Stop } catch { exit 1223 }; exit $p.ExitCode`;
      const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');

      exec(
        `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`,
        { windowsHide: true },
        (err) => {
          if (err) {
            if (err.code === 1223) {
              const elevationError = new Error('permission_denied');
              elevationError.code = 'permission_denied';
              return reject(elevationError);
            }
            return reject(new Error('خطا در اجرای دستور تغییر DNS'));
          }
          resolve();
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

let dnsHelperState = null;

function launchElevatedHelper(helperArgs) {
  return new Promise((resolve, reject) => {
    try {
      const formattedArgs = helperArgs.map(arg => {
        if (arg.includes(' ') || arg.includes('\t') || arg.includes('"')) {
          return `\\"${arg.replace(/"/g, '\\"')}\\"`;
        }
        return arg;
      }).join(' ');

      const execPathEscaped = process.execPath.replace(/'/g, "''");
      const argsEscaped = formattedArgs.replace(/'/g, "''");

      const psCommand = `try { Start-Process -FilePath '${execPathEscaped}' -ArgumentList '${argsEscaped}' -Verb RunAs -ErrorAction Stop } catch { exit 1223 }`;
      const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');

      exec(
        `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`,
        { windowsHide: true },
        (err) => {
          if (err) {
            if (err.code === 1223) {
              const elevationError = new Error('permission_denied');
              elevationError.code = 'permission_denied';
              return reject(elevationError);
            }
            const failError = new Error('helper_start_failed');
            failError.code = 'helper_start_failed';
            return reject(failError);
          }
          resolve();
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

async function ensureDnsHelper() {
  if (dnsHelperState) {
    try {
      const res = await sendDnsRequest({ action: 'ping' }, 2000);
      if (res && res.ok) {
        return dnsHelperState;
      }
    } catch {
      // ping failed, restart helper
    }
    dnsHelperState = null;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corely-dns-'));
  const token = crypto.randomBytes(32).toString('hex');

  const helperArgs = app.isPackaged
    ? ['--corely-dns-helper', `--dir=${dir}`, `--parent=${process.pid}`, `--token=${token}`]
    : [app.getAppPath(), '--corely-dns-helper', `--dir=${dir}`, `--parent=${process.pid}`, `--token=${token}`];

  try {
    await launchElevatedHelper(helperArgs);

    const readyFile = path.join(dir, 'ready');
    const startTime = Date.now();
    let isReady = false;
    while (Date.now() - startTime < 30000) {
      if (fs.existsSync(readyFile)) {
        isReady = true;
        break;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    if (!isReady) {
      const startErr = new Error('helper_start_failed');
      startErr.code = 'helper_start_failed';
      throw startErr;
    }

    dnsHelperState = { dir, token, counter: 0 };
    return dnsHelperState;
  } catch (err) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {}
    throw err;
  }
}

async function sendDnsRequest(payload, timeoutMs = 20000) {
  if (!dnsHelperState) {
    const err = new Error('helper_not_running');
    err.code = 'helper_not_running';
    throw err;
  }

  const { dir, token } = dnsHelperState;
  dnsHelperState.counter += 1;
  const currentCount = dnsHelperState.counter;

  const reqFileName = `req-${currentCount}.json`;
  const resFileName = `res-${currentCount}.json`;
  const reqPath = path.join(dir, reqFileName);
  const resPath = path.join(dir, resFileName);
  const tmpPath = path.join(dir, `req-${currentCount}.tmp.${Date.now()}`);

  const fullPayload = {
    ...payload,
    token
  };

  await fs.promises.writeFile(tmpPath, JSON.stringify(fullPayload), 'utf8');
  await fs.promises.rename(tmpPath, reqPath);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(resPath)) {
      try {
        const content = await fs.promises.readFile(resPath, 'utf8');
        try {
          await fs.promises.unlink(resPath);
        } catch {}
        const data = JSON.parse(content);
        return data;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 150));
  }

  try {
    if (fs.existsSync(reqPath)) {
      await fs.promises.unlink(reqPath);
    }
  } catch {}

  const timeoutErr = new Error('helper_timeout');
  timeoutErr.code = 'helper_timeout';
  throw timeoutErr;
}

function getActiveNetworkAdapter() {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('فقط در ویندوز پشتیبانی می‌شود'));
    }

    exec('netsh interface show interface', { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
      if (err) {
        return reject(err);
      }

      const lines = (stdout || '').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('---') || /admin\s*state/i.test(trimmed)) {
          continue;
        }

        const isConnected = /connected|متصل/i.test(trimmed);
        const isEnabled = /enabled|فعال/i.test(trimmed);
        if (isConnected && isEnabled) {
          const parts = trimmed.split(/\s{2,}/);
          if (parts.length >= 4) {
            const iface = parts[3].trim();
            if (iface) return resolve(iface);
          }
        }
      }

      // Fallback: look for any connected row
      for (const line of lines) {
        const trimmed = line.trim();
        if (/connected|متصل/i.test(trimmed)) {
          const parts = trimmed.split(/\s{2,}/);
          const candidate = parts[parts.length - 1]?.trim();
          if (candidate && !/admin|state|interface/i.test(candidate)) {
            return resolve(candidate);
          }
        }
      }

      // Default common adapter name
      resolve('Wi-Fi');
    });
  });
}

async function setDnsOnSystem(opts = {}) {
  if (process.platform !== 'win32') {
    return { success: false, error: 'فقط در ویندوز پشتیبانی میشود' };
  }

  try {
    const adapter = await getActiveNetworkAdapter();
    if (!adapter) {
      return { success: false, error: 'آداپتور شبکه فعال یافت نشد' };
    }
    if (!isSafeAdapterName(adapter)) {
      return { success: false, error: 'نام آداپتور شبکه نامعتبر است' };
    }

    const commands = [];
    if (opts.reset) {
      commands.push(`netsh interface ip set dns name="${adapter}" source=dhcp`);
    } else {
      if (!opts.primary) {
        return { success: false, error: 'آدرس DNS مشخص نشده است' };
      }
      if (!isValidIPv4(opts.primary) || (opts.secondary && !isValidIPv4(opts.secondary))) {
        return { success: false, error: 'آدرس DNS نامعتبر است' };
      }
      opts = { ...opts, primary: opts.primary.trim(), secondary: opts.secondary ? opts.secondary.trim() : '' };
      commands.push(`netsh interface ip set dns name="${adapter}" source=static addr=${opts.primary}`);
      if (opts.secondary) {
        commands.push(`netsh interface ip add dns name="${adapter}" addr=${opts.secondary} index=2`);
      }
    }

    try {
      for (const cmd of commands) {
        await runCommand(cmd);
      }
    } catch (err) {
      if (err.message === 'permission_denied' || err.code === 'permission_denied') {
        try {
          await ensureDnsHelper();
          const helperRes = await sendDnsRequest({
            action: opts.reset ? 'reset' : 'set',
            adapter,
            primary: opts.primary,
            secondary: opts.secondary
          });
          if (!helperRes || !helperRes.ok) {
            throw new Error(helperRes?.error || 'helper_failed');
          }
        } catch (helperErr) {
          if (helperErr.message === 'permission_denied' || helperErr.code === 'permission_denied') {
            throw helperErr;
          }
          await runElevatedCommands(commands);
        }
      } else {
        throw err;
      }
    }

    return { success: true };
  } catch (err) {
    if (err.message === 'permission_denied' || err.code === 'permission_denied') {
      return { success: false, error: 'permission_denied' };
    }
    return { success: false, error: err.message || 'خطا در تغییر DNS' };
  }
}

async function getDnsOnSystem() {
  if (process.platform !== 'win32') {
    return { primary: null, secondary: null };
  }

  try {
    const adapter = await getActiveNetworkAdapter();
    const stdout = await runCommand(`netsh interface ip show dns name="${adapter}"`);
    const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const matches = stdout.match(ipv4Regex) || [];
    
    const validIps = matches.filter((ip) => {
      const parts = ip.split('.').map(Number);
      return parts.every((n) => n >= 0 && n <= 255) && ip !== '255.255.255.255' && ip !== '0.0.0.0';
    });

    return {
      primary: validIps[0] || null,
      secondary: validIps[1] || null
    };
  } catch (_err) {
    return { primary: null, secondary: null };
  }
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const windowWidth = Math.min(1280, workArea.width);
  const windowHeight = Math.min(800, workArea.height - 4);
  const windowX = workArea.x + Math.round((workArea.width - windowWidth) / 2);
  const windowY = workArea.y + Math.round((workArea.height - windowHeight) / 2);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    minWidth: 1024,
    minHeight: 700,
    title: 'Corely',
    icon: getIconPath(),
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadURL(process.env.ELECTRON_DEV_URL || 'app://corely/index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    refreshTrayMenu().catch(() => {});
  });

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  let crashReloadTimestamps = [];
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const reason = details ? details.reason : '';
    console.error('[Electron] Renderer process gone:', reason);
    if (reason === 'clean-exit' || reason === 'killed') return;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const now = Date.now();
    crashReloadTimestamps = crashReloadTimestamps.filter((t) => now - t < 60000);
    if (crashReloadTimestamps.length >= 3) {
      console.error('[Electron] Too many crashes in 60s, skipping reload.');
      return;
    }
    crashReloadTimestamps.push(now);

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reload();
      }
    }, 1000);
  });

  mainWindow.on('maximize', syncMaximizedState);
  mainWindow.on('unmaximize', syncMaximizedState);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      if (trayIcon) {
        event.preventDefault();
        mainWindow.hide();
        refreshTrayMenu().catch(() => {});
      } else {
        isQuitting = true;
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    isCustomMaximized = false;
    previousBounds = null;
  });
}

secureOn('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

secureOn('window:maximize', () => {
  toggleCustomMaximize();
});

secureOn('window:close', () => {
  if (mainWindow) mainWindow.close();
});

secureHandle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

secureOn('notify', (_event, opts) => {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: opts?.title || 'Corely',
        body: opts?.body || '',
        icon: opts?.icon
      }).show();
    }
  } catch (err) {
    console.error('[Electron] Notification error:', err);
  }
});

secureHandle('dns:set', async (_event, opts) => {
  try {
    return await setDnsOnSystem(opts);
  } catch (err) {
    if (err && (err.message === 'permission_denied' || err.code === 'permission_denied')) {
      return { success: false, error: 'permission_denied' };
    }
    return { success: false, error: err?.message || 'خطا در اعمال DNS' };
  }
});

secureHandle('dns:get', async () => {
  try {
    return await getDnsOnSystem();
  } catch (_err) {
    return { primary: null, secondary: null };
  }
});

function buildServiceHttpError(status, bodyText) {
  const text = typeof bodyText === 'string' ? bodyText.trim() : '';
  const looksLikeHtml = text.startsWith('<') || /<html|<!doctype/i.test(text.slice(0, 200));

  let detail = '';
  if (!looksLikeHtml && text) {
    try {
      const parsed = JSON.parse(text);
      const msg = parsed && parsed.error && (parsed.error.message || parsed.error);
      if (typeof msg === 'string') detail = msg;
    } catch {
      detail = text;
    }
    detail = detail.replace(/\s+/g, ' ').slice(0, 160);
  }

  let base;
  if (status === 401 || status === 403) {
    base = 'کلید API نامعتبر است یا دسترسی ندارد';
  } else if (status === 404) {
    base = 'آدرس سرویس یا نام مدل پیدا نشد';
  } else if (status === 429) {
    base = 'تعداد درخواست‌ها زیاد است یا اعتبار تمام شده';
  } else if (status >= 500) {
    base = 'سرویس موقتاً در دسترس نیست';
  } else {
    base = 'خطای سرویس هوش مصنوعی';
  }
  return `${base} (${status}).${detail ? ' ' + detail : ''}`;
}

function toOpenAiSchema(node) {
  if (Array.isArray(node)) return node.map(toOpenAiSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type' && typeof value === 'string') {
      out.type = value.toLowerCase();
    } else if (key === 'properties' && value && typeof value === 'object') {
      out.properties = {};
      for (const [pName, pSchema] of Object.entries(value)) {
        out.properties[pName] = toOpenAiSchema(pSchema);
      }
    } else if (key === 'items') {
      out.items = toOpenAiSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function openAiCompatibleChat(payload) {
  const { prompt, contextData, history, previousFunctionCalls, functionResponses, openaiBaseUrl, openaiApiKey, openaiModel } = payload || {};

  if (!openaiBaseUrl || typeof openaiBaseUrl !== 'string' || !openaiBaseUrl.trim()) {
    throw new Error('آدرس Base URL سرویس هوش مصنوعی در تنظیمات وارد نشده است.');
  }
  if (!openaiApiKey || typeof openaiApiKey !== 'string' || !openaiApiKey.trim()) {
    throw new Error('کلید API سرویس هوش مصنوعی در تنظیمات وارد نشده است.');
  }
  if (!openaiModel || typeof openaiModel !== 'string' || !openaiModel.trim()) {
    throw new Error('نام مدل (Model ID) در تنظیمات وارد نشده است.');
  }
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('پیام نامعتبر است.');
  }

  let base;
  try {
    base = new URL(openaiBaseUrl.trim());
  } catch {
    throw new Error('Base URL معتبر نیست. نمونه: https://api.example.com/v1');
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('Base URL باید با http یا https شروع شود.');
  }
  const endpoint = base.toString().replace(/\/+$/, '') + '/chat/completions';

  const messages = [
    { role: 'system', content: 'تو دستیار هوشمند اپ Corely هستی. به زبان فارسی، کوتاه، دقیق و مفید جواب بده. برای افزودن کار، خرید، برنامه‌ی هفتگی، تراکنش مالی یا یادداشت از ابزارهای در دسترس استفاده کن، و بعد از اجرای ابزار نتیجه را کوتاه و دوستانه به فارسی اعلام کن.' }
  ];
  if (Array.isArray(history)) {
    for (const msg of history) {
      if (msg && msg.text) {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: String(msg.text) });
      }
    }
  }
  let userText = prompt;
  if (contextData) {
    userText = `[اطلاعات کاربر]:\n${JSON.stringify(contextData, null, 2)}\n\n[پیام کاربر]:\n${prompt}`;
  }
  messages.push({ role: 'user', content: userText });

  const hasFunctionResponses = Array.isArray(functionResponses) && functionResponses.length > 0;
  if (hasFunctionResponses) {
    if (Array.isArray(previousFunctionCalls) && previousFunctionCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: previousFunctionCalls.map((fc, i) => ({
          id: String(fc.id || `call_${i}`),
          type: 'function',
          function: { name: fc.name, arguments: JSON.stringify(fc.args || {}) }
        }))
      });
    }
    functionResponses.forEach((fr, i) => {
      messages.push({
        role: 'tool',
        tool_call_id: String((previousFunctionCalls && previousFunctionCalls[i] && previousFunctionCalls[i].id) || fr.id || `call_${i}`),
        content: JSON.stringify(fr.response || { result: 'success' })
      });
    });
  }

  async function sendRequest(includeTools) {
    const requestBody = {
      model: openaiModel.trim(),
      messages,
      temperature: 0.7
    };
    if (includeTools) {
      requestBody.tools = toolDeclarations.map((d) => ({
        type: 'function',
        function: { name: d.name, description: d.description, parameters: toOpenAiSchema(d.parameters) }
      }));
      requestBody.tool_choice = 'auto';
    }

    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey.trim()}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000)
    });
  }

  const isInitialTurn = !hasFunctionResponses;
  let response = await sendRequest(isInitialTurn);

  if (!response.ok && isInitialTurn && (response.status === 400 || response.status === 422)) {
    response = await sendRequest(false);
  }

  if (!response.ok) {
    let bodyText = '';
    try { bodyText = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(buildServiceHttpError(response.status, bodyText));
  }

  const data = await response.json();
  const choice = data && data.choices && data.choices[0];
  const message = choice && choice.message;

  if (message && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return {
      functionCalls: message.tool_calls.map((tc) => {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          args = {};
        }
        return { id: tc.id, name: tc.function.name, args };
      })
    };
  }

  const text = message && message.content;
  return { text: (typeof text === 'string' && text.trim()) ? text : 'پاسخی دریافت نشد.' };
}

async function listOpenAiModels(payload) {
  const { openaiBaseUrl, openaiApiKey } = payload || {};
  if (!openaiBaseUrl || typeof openaiBaseUrl !== 'string' || !openaiBaseUrl.trim()) {
    throw new Error('Base URL وارد نشده است.');
  }
  if (!openaiApiKey || typeof openaiApiKey !== 'string' || !openaiApiKey.trim()) {
    throw new Error('کلید API وارد نشده است.');
  }
  let base;
  try {
    base = new URL(openaiBaseUrl.trim());
  } catch {
    throw new Error('Base URL معتبر نیست.');
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('Base URL باید با http یا https شروع شود.');
  }
  const endpoint = base.toString().replace(/\/+$/, '') + '/models';
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${openaiApiKey.trim()}` },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    let bodyText = '';
    try { bodyText = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(buildServiceHttpError(response.status, bodyText));
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('پاسخ سرویس قابل خواندن نیست.');
  }
  const rawList = Array.isArray(data) ? data : (Array.isArray(data && data.data) ? data.data : (Array.isArray(data && data.models) ? data.models : []));
  const models = rawList
    .map((m) => (typeof m === 'string' ? m : (m && (m.id || m.name))))
    .filter((id) => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim());
  const unique = Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
  return { models: unique };
}

secureHandle('ai:list-models', async (_event, payload) => {
  try {
    return await withAiProxyFallback(payload && payload.aiProxyUrl, () => listOpenAiModels(payload));
  } catch (error) {
    console.error('[Electron IPC ai:list-models] error:', error && error.message ? error.message : error);
    throw new Error(error && error.message ? error.message : 'خطا در دریافت لیست مدلها.');
  }
});

secureHandle('ai:chat', async (_event, payload) => {
  if (payload && payload.aiProvider === 'openai') {
    try {
      return await withAiProxyFallback(payload.aiProxyUrl, () => openAiCompatibleChat(payload));
    } catch (error) {
      console.error('[Electron IPC ai:chat] OpenAI-compatible error:', error && error.message ? error.message : error);
      throw new Error(error && error.message ? error.message : 'خطا در ارتباط با سرویس هوش مصنوعی.');
    }
  }

  const { GoogleGenAI } = await loadGenAI();
  const { prompt, contextData, model, style, history, previousFunctionCalls, functionResponses, geminiApiKey, aiProxyUrl } = payload || {};

  if (!geminiApiKey) {
    throw new Error('کلید API تنظیم نشده است. آن را در تنظیمات اپ وارد کنید.');
  }
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('متن سوال الزامی است.');
  }

  try {
    return await withAiProxyFallback(aiProxyUrl, async () => {
      const selectedStyle = style || model || 'balanced';

    // Define style-specific guidance for Gemini
    let styleInstruction = '';
    switch (selectedStyle) {
      case 'fast-concise':
        styleInstruction = `سبک پاسخ‌دهی درخواستی: «پاسخ سریع و فشرده»
- پاسخ را بسیار کوتاه، صریح، نکته‌محور و ترجیحاً در قالب موارد بالت‌پوینت (Bullet points) ارائه دهید.
- از مقدمه‌چینی، تعارفات و توضیحات غیرضروری خودداری کرده و مستقیماً به اصل پاسخ بپردازید.`;
        break;

      case 'deep-analysis':
        styleInstruction = `سبک پاسخ‌دهی درخواستی: «تحلیل عمیق و تخصصی»
- موضوع را از زوایای گوناگون با استدلال منطقی، محاسبات دقیق و تحلیل جامع بررسی کنید.
- پیامدها، مزایا و معایب و نکات کلیدی تصمیم‌گیری را به صورت ساختاریافته تشریح کنید.`;
        break;

      case 'step-by-step':
        styleInstruction = `سبک پاسخ‌دهی درخواستی: «گام‌به‌گام و آموزشی»
- پاسخ را به مراحل اجرایی منظم، شماره‌گذاری‌شده (۱، ۲، ۳...) و شفاف تفکیک کنید.
- هر گام باید شامل یک اقدام روشن و عملیاتی باشد که به سادگی قابل اجرا باشد.`;
        break;

      case 'creative':
        styleInstruction = `سبک پاسخ‌دهی درخواستی: «خلاق و ایده‌پرداز»
- با زاویه دید نوآورانه، خلاقانه و الهام‌بخش به موضوع بپردازید.
- ایده‌های تازه، پیشنهادهای مکمل و لحن انگیزشی و پرانرژی ارائه دهید.`;
        break;

      case 'balanced':
      default:
        styleInstruction = `سبک پاسخ‌دهی درخواستی: «دستیار جامع و متعادل»
- پاسخی متوازن، دقیق، کاربردی و با لحن صمیمانه، محترمانه و حرفه‌ای ارائه دهید.`;
        break;
    }

    const ai = new GoogleGenAI({ 
      apiKey: geminiApiKey,
    });

    const systemInstruction = `شما دستیار هوشمند و شخصی اپلیکیشن «Corely» (قدرت گرفته از مدل هوش مصنوعی Gemini گوگل) هستید.

وظیفه شما:
کمک به کاربر در سازماندهی کارهای روزانه، برنامه‌ریزی هفتگی، مدیریت مالی، پیگیری اهداف و یادداشت‌ها، و پاسخ به پرسش‌های گوناگون.

دسترسی‌های اجرایی (ابزارها / Functions):
شما به ابزارهای واقعی برای انجام این ۴ عمل در اپلیکیشن مجهز هستید:
۱. add_task: افزودن کار به لیست کارها (todos) یا آیتم به لیست خرید (shopping).
۲. add_weekly_task: افزودن کار یا برنامه به یک روز مشخص از هفته جاری (از saturday تا friday).
۳. add_transaction: ثبت هزینه یا درآمد جدید در بخش مدیریت مالی.
۴. append_note: اضافه کردن متن به انتهای یادداشت اصلی کاربر.

قوانین مهم رفتار، پاسخ‌دهی و اجرای ابزارها:
۱. **فقط هنگام درخواست صریح اقدام**: فقط و فقط زمانی ابزارها (Function Calls) را فراخوانی کنید که کاربر واقعاً و صراحتاً درخواست انجام یا ثبت یک کار مشخص را داشته باشد (نه هنگام سوالات عمومی، مشورت، ایده‌پردازی یا احوالپرسی).
۲. **برخورد با اطلاعات ناقص**: اگر کاربر درخواست انجام کاری داد اما اطلاعات ضروری آن ناقص بود (مثلاً مشخص نکرده چه روزی از هفته، چه مبلغی برای تراکنش، یا چه متنی)، هرگز حدس نزنید و پارامتر الکی نسازید؛ بلکه در پاسخ متنی از کاربر با لحنی صمیمی و شفاف سوال بپرسید تا جزئیات را مشخص کند.
۳. **احوالپرسی و پیام‌های کوتاه**: اگر کاربر پیام کوتاهی مانند «سلام»، «درود»، «چطوری»، «ممنون» یا غیره ارسال کرد، **حتماً** پاسخی کوتاه، صمیمانه و طبیعی بدهید (مثلاً: «سلام! چطور می‌تونم امروز کمکت کنم؟»). از ارائه‌ی گزارش‌های طولانی، خلاصه‌سازی ناخواسته داده‌های داشبورد یا لیست کردن کارها در پاسخ به یک سلام ساده **اکیداً خودداری کنید**.
۴. **استفاده از اطلاعات داشبورد**: اطلاعات داشبورد (کارها، تراکنش‌ها، ایده‌ها) جهت آگاهی پس‌زمینه شماست. فقط زمانی از آن‌ها در پاسخ استفاده کنید که کاربر مستقیماً درباره برنامه‌ها، مالی، وظایف یا ایده‌هایش سوال بپرسد یا راهنمایی بخواهد.
۵. **حفظ پیوستگی گفتگو**: به تمام پیام‌های قبلی موجود در حافظه چت توجه داشته باشید و پیوستگی گفتگو را حفظ کنید.

${styleInstruction}`;

    const contents = [];

    // Add conversation history if present
    if (history && Array.isArray(history) && history.length > 0) {
      for (const msg of history) {
        if (msg.text) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        }
      }
    }

    // Format current user prompt
    let currentPromptText = prompt;
    if (contextData) {
      currentPromptText = `[اطلاعات داشبورد کاربر]:
${JSON.stringify(contextData, null, 2)}

[سوال یا درخواست جدید کاربر]:
${prompt}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: currentPromptText }]
    });

    // If client is responding to a previous function call:
    if (functionResponses && Array.isArray(functionResponses) && functionResponses.length > 0) {
      if (previousFunctionCalls && Array.isArray(previousFunctionCalls) && previousFunctionCalls.length > 0) {
        contents.push({
          role: 'model',
          parts: previousFunctionCalls.map((fc) => ({
            functionCall: {
              name: fc.name,
              args: fc.args,
              id: fc.id
            }
          }))
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponses.map((fr) => ({
          functionResponse: {
            name: fr.name,
            response: fr.response || { result: 'success' },
            id: fr.id
          }
        }))
      });

      const response = await generateWithRetryAndFallback(ai, {
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const text = response.text || 'عملیات با موفقیت انجام شد.';
      return { text };
    }

    // Initial user turn with function calling declarations available
    const response = await generateWithRetryAndFallback(ai, {
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: [{ functionDeclarations: toolDeclarations }],
      },
    });

      if (response.functionCalls && response.functionCalls.length > 0) {
        return { functionCalls: response.functionCalls };
      }

      const text = response.text || 'پاسخی دریافت نشد.';
      return { text };
    });
  } catch (error) {
    console.error('[Electron IPC ai:chat] Gemini API Error:', error);
    throw new Error(formatGeminiErrorMessage(error));
  }
});

async function openAiGenerateRoutineSuggestions(payload) {
  const { role, wakeTime, sleepTime, priorities, openaiBaseUrl, openaiApiKey, openaiModel } = payload || {};

  if (!openaiBaseUrl || typeof openaiBaseUrl !== 'string' || !openaiBaseUrl.trim()) {
    throw new Error('آدرس Base URL سرویس هوش مصنوعی در تنظیمات وارد نشده است.');
  }
  if (!openaiApiKey || typeof openaiApiKey !== 'string' || !openaiApiKey.trim()) {
    throw new Error('کلید API سرویس هوش مصنوعی در تنظیمات وارد نشده است.');
  }
  if (!openaiModel || typeof openaiModel !== 'string' || !openaiModel.trim()) {
    throw new Error('نام مدل (Model ID) در تنظیمات وارد نشده است.');
  }

  let base;
  try {
    base = new URL(openaiBaseUrl.trim());
  } catch {
    throw new Error('Base URL معتبر نیست. نمونه: https://api.example.com/v1');
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('Base URL باید با http یا https شروع شود.');
  }
  const endpoint = base.toString().replace(/\/+$/, '') + '/chat/completions';

  const promptText = `لطفاً برای کاربری با مشخصات زیر، بین ۶ تا ۱۲ مورد «روال ثابت روزانه» (Fixed Daily Habits/Routines) پیشنهاد بده:
- نقش / سبک زندگی کاربر: ${role || 'عمومی'}
- ساعت بیدار شدن: ${wakeTime || 'نامشخص'}
- ساعت خوابیدن: ${sleepTime || 'نامشخص'}
- اولویت‌ها، اهداف و نکات ویژه: ${priorities || 'ندارد'}

نکات مهم:
۱. هر مورد باید یک عادت یا روال روزانه کوتاه، کاربردی، واقع‌گرایانه و مشخص به زبان فارسی باشد (مثلاً: «۲۰ دقیقه ورزش و کشش صبحگاهی»، «مطالعه کتاب یا پادکست آموزشی»، «بررسی لیست وظایف کاری و اولویت‌بندی»، «نوشیدن آب و تغذیه سالم»، «تمرین مهارت یا مطالعه تخصصی»، «پیاده‌روی عصرگاهی»).
۲. روال‌ها باید با سبک زندگی، نقش و بازه زمانی بیداری و خواب کاربر تناسب داشته باشند.
۳. خروجی باید حتماً یک شیء JSON با ساختار {"suggestions": ["...", "..."]} باشد که کلید suggestions آرایه‌ای از ۶ تا ۱۲ رشته کوتاه متنی فارسی است.`;

  const requestBody = {
    model: openaiModel.trim(),
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates daily routine suggestions in Persian. Output ONLY valid JSON adhering to schema {"suggestions": ["string", ...]}. Do not include markdown code block formatting or explanations.'
      },
      {
        role: 'user',
        content: promptText
      }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey.trim()}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000)
    });
  } catch (netErr) {
    throw new Error(netErr && netErr.message ? netErr.message : 'خطا در ارتباط با سرویس هوش مصنوعی.');
  }

  if (!response.ok && response.status === 400) {
    try {
      const errText = await response.text();
      if (errText.includes('response_format') || errText.includes('json_object')) {
        delete requestBody.response_format;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey.trim()}`
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(60000)
        });
      } else {
        throw new Error(buildServiceHttpError(response.status, errText));
      }
    } catch (e) {
      if (e.message && e.message !== 'Failed to fetch') throw e;
    }
  }

  if (!response.ok) {
    let bodyText = '';
    try { bodyText = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(buildServiceHttpError(response.status, bodyText));
  }

  const resJson = await response.json();
  const rawContent = resJson?.choices?.[0]?.message?.content || '';

  let parsed = null;
  const textToParse = typeof rawContent === 'string' ? rawContent.trim() : '';

  try {
    parsed = JSON.parse(textToParse);
  } catch {
    const fenceMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch && fenceMatch[1]) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim());
      } catch {
        parsed = null;
      }
    }
    if (!parsed) {
      const firstBrace = textToParse.indexOf('{');
      const lastBrace = textToParse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(textToParse.slice(firstBrace, lastBrace + 1));
        } catch {
          parsed = null;
        }
      }
    }
  }

  const suggestions = (parsed && Array.isArray(parsed.suggestions))
    ? parsed.suggestions.filter(s => typeof s === 'string' && s.trim().length > 0)
    : [];

  return { suggestions };
}

secureHandle('ai:generate-routine-suggestions', async (_event, payload) => {
  if (payload && payload.aiProvider === 'openai') {
    try {
      return await withAiProxyFallback(payload.aiProxyUrl, () => openAiGenerateRoutineSuggestions(payload));
    } catch (error) {
      console.error('[Electron IPC ai:generate-routine-suggestions] OpenAI Routine Suggestions Error:', error);
      throw new Error(error && error.message ? error.message : 'خطا در ارتباط با سرویس هوش مصنوعی.');
    }
  }

  const { GoogleGenAI, Type } = await loadGenAI();
  const { role, wakeTime, sleepTime, priorities, geminiApiKey, aiProxyUrl } = payload || {};

  if (!geminiApiKey) {
    throw new Error('کلید API تنظیم نشده است. آن را در تنظیمات اپ وارد کنید.');
  }

  try {
    return await withAiProxyFallback(aiProxyUrl, async () => {
      const ai = new GoogleGenAI({ 
        apiKey: geminiApiKey,
      });

    const promptText = `لطفاً برای کاربری با مشخصات زیر، بین ۶ تا ۱۲ مورد «روال ثابت روزانه» (Fixed Daily Habits/Routines) پیشنهاد بده:
- نقش / سبک زندگی کاربر: ${role || 'عمومی'}
- ساعت بیدار شدن: ${wakeTime || 'نامشخص'}
- ساعت خوابیدن: ${sleepTime || 'نامشخص'}
- اولویت‌ها، اهداف و نکات ویژه: ${priorities || 'ندارد'}

نکات مهم:
۱. هر مورد باید یک عادت یا روال روزانه کوتاه، کاربردی، واقع‌گرایانه و مشخص به زبان فارسی باشد (مثلاً: «۲۰ دقیقه ورزش و کشش صبحگاهی»، «مطالعه کتاب یا پادکست آموزشی»، «بررسی لیست وظایف کاری و اولویت‌بندی»، «نوشیدن آب و تغذیه سالم»، «تمرین مهارت یا مطالعه تخصصی»، «پیاده‌روی عصرگاهی»).
۲. روال‌ها باید با سبک زندگی، نقش و بازه زمانی بیداری و خواب کاربر تناسب داشته باشند.
۳. خروجی باید حتماً یک شیء JSON با کلید suggestions باشد که آرایه‌ای از ۶ تا ۱۲ رشته کوتاه متنی فارسی است.`;

    const response = await generateWithRetryAndFallback(ai, {
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description: 'لیست پیشنهادات روال‌های ثابت روزانه به زبان فارسی',
            },
          },
          required: ['suggestions'],
        },
        temperature: 0.7,
      },
    });

    const responseText = response.text?.trim() || '{}';
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Electron IPC ai:generate-routine-suggestions] Failed to parse AI suggestions JSON:', responseText, parseError);
      data = { suggestions: [] };
    }

      const suggestions = Array.isArray(data.suggestions) ? data.suggestions.filter(s => typeof s === 'string' && s.trim().length > 0) : [];
      return { suggestions };
    });
  } catch (error) {
    console.error('[Electron IPC ai:generate-routine-suggestions] AI Routine Suggestions API Error:', error);
    throw new Error(formatGeminiErrorMessage(error));
  }
});


function isRunningAsAdmin() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve(false);
    }
    exec('net session', { windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

secureHandle('app:isAdmin', async () => isRunningAsAdmin());

secureHandle('app:getAutoStart', async () => {
  try {
    return app.getLoginItemSettings().openAtLogin === true;
  } catch {
    return false;
  }
});

secureHandle('app:setAutoStart', async (_event, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: enabled === true });
    return app.getLoginItemSettings().openAtLogin === true;
  } catch {
    return false;
  }
});

// ─── Linked Media Library (Registry & Streaming Protocol) ───

const ALLOWED_MEDIA_EXTS = {
  video: new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']),
  audio: new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']),
  image: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif'])
};

const ALL_ALLOWED_EXTS = [
  'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v',
  'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif'
];

function getMediaKind(ext) {
  if (!ext || typeof ext !== 'string') return null;
  const cleanExt = ext.toLowerCase().replace(/^\./, '').trim();
  if (ALLOWED_MEDIA_EXTS.video.has(cleanExt)) return 'video';
  if (ALLOWED_MEDIA_EXTS.audio.has(cleanExt)) return 'audio';
  if (ALLOWED_MEDIA_EXTS.image.has(cleanExt)) return 'image';
  return null;
}

const MEDIA_MIME_TYPES = {
  'mp4': 'video/mp4',
  'm4v': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'mkv': 'video/x-matroska',
  'avi': 'video/x-msvideo',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'm4a': 'audio/mp4',
  'flac': 'audio/flac',
  'aac': 'audio/aac',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'avif': 'image/avif'
};

function getMediaMimeType(ext) {
  if (!ext || typeof ext !== 'string') return 'application/octet-stream';
  const cleanExt = ext.toLowerCase().replace(/^\./, '').trim();
  return MEDIA_MIME_TYPES[cleanExt] || 'application/octet-stream';
}

const UUID_REGEX = /^[0-9a-f-]{36}$/;

function isValidId(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// In-memory registry: id -> { path, name, size }
const libraryRegistry = new Map();

function getLibraryIndexPath() {
  return path.join(app.getPath('userData'), 'library-index.json');
}

function loadLibraryRegistry() {
  try {
    const indexPath = getLibraryIndexPath();
    if (!fs.existsSync(indexPath)) return;
    const raw = fs.readFileSync(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.entries && typeof parsed.entries === 'object') {
      for (const [id, entry] of Object.entries(parsed.entries)) {
        if (isValidId(id) && entry && typeof entry.path === 'string') {
          libraryRegistry.set(id, {
            path: entry.path,
            name: typeof entry.name === 'string' ? entry.name : path.basename(entry.path),
            size: typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0
          });
        }
      }
    }
  } catch (err) {
    console.error('[Library] Failed to load index, starting empty:', err && err.message ? err.message : err);
  }
}

let librarySaveTimeout = null;
let isSavingLibrary = false;
let pendingSaveAgain = false;

function saveLibraryRegistrySync() {
  try {
    const indexPath = getLibraryIndexPath();
    const tempPath = `${indexPath}.tmp.${Date.now()}`;
    const entriesObj = {};
    for (const [id, val] of libraryRegistry.entries()) {
      entriesObj[id] = val;
    }
    const obj = {
      version: 1,
      entries: entriesObj
    };
    fs.writeFileSync(tempPath, JSON.stringify(obj), 'utf8');
    fs.renameSync(tempPath, indexPath);
  } catch (err) {
    console.error('[Library] Failed to save index:', err && err.message ? err.message : err);
  }
}

async function performLibrarySave() {
  if (isSavingLibrary) {
    pendingSaveAgain = true;
    return;
  }
  isSavingLibrary = true;
  try {
    const indexPath = getLibraryIndexPath();
    const tempPath = `${indexPath}.tmp.${Date.now()}`;
    const entriesObj = {};
    for (const [id, val] of libraryRegistry.entries()) {
      entriesObj[id] = val;
    }
    const obj = {
      version: 1,
      entries: entriesObj
    };
    await fs.promises.writeFile(tempPath, JSON.stringify(obj), 'utf8');
    await fs.promises.rename(tempPath, indexPath);
  } catch (err) {
    console.error('[Library] Failed to save index:', err && err.message ? err.message : err);
  } finally {
    isSavingLibrary = false;
    if (pendingSaveAgain) {
      pendingSaveAgain = false;
      scheduleLibrarySave();
    }
  }
}

function scheduleLibrarySave() {
  if (librarySaveTimeout) {
    clearTimeout(librarySaveTimeout);
  }
  librarySaveTimeout = setTimeout(() => {
    librarySaveTimeout = null;
    performLibrarySave();
  }, 500);
}

function getDialogParent() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  return undefined;
}

async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const SKIP_DIRECTORY_NAMES = new Set(['node_modules', '$recycle.bin', 'system volume information']);

async function scanFolderForMedia(rootDir) {
  const entries = [];
  let truncated = false;

  async function traverse(currentDir, currentDepth) {
    if (truncated) return;
    if (currentDepth > 12) return;

    let dirents;
    try {
      dirents = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const dirent of dirents) {
      if (truncated) return;
      if (dirent.isSymbolicLink()) continue;

      const name = dirent.name;
      if (dirent.isDirectory()) {
        if (name.startsWith('.')) continue;
        if (SKIP_DIRECTORY_NAMES.has(name.toLowerCase())) continue;
        await traverse(path.join(currentDir, name), currentDepth + 1);
      } else if (dirent.isFile()) {
        const ext = path.extname(name).toLowerCase().replace(/^\./, '');
        const kind = getMediaKind(ext);
        if (!kind) continue;

        const fullPath = path.join(currentDir, name);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (!stat.isFile()) continue;
          const id = crypto.randomUUID();
          libraryRegistry.set(id, { path: fullPath, name, size: stat.size });
          entries.push({
            id,
            name,
            size: stat.size,
            kind,
            ext,
            parentName: path.basename(currentDir)
          });
          if (entries.length >= 20000) {
            truncated = true;
            return;
          }
        } catch {}
      }
    }
  }

  await traverse(rootDir, 0);
  return { entries, truncated };
}

async function scanFolderFiles(rootDir) {
  const fileList = [];

  async function traverse(currentDir, currentDepth) {
    if (fileList.length >= 20000) return;
    if (currentDepth > 12) return;

    let dirents;
    try {
      dirents = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const dirent of dirents) {
      if (fileList.length >= 20000) return;
      if (dirent.isSymbolicLink()) continue;

      const name = dirent.name;
      if (dirent.isDirectory()) {
        if (name.startsWith('.')) continue;
        if (SKIP_DIRECTORY_NAMES.has(name.toLowerCase())) continue;
        await traverse(path.join(currentDir, name), currentDepth + 1);
      } else if (dirent.isFile()) {
        const ext = path.extname(name).toLowerCase().replace(/^\./, '');
        if (!getMediaKind(ext)) continue;
        const fullPath = path.join(currentDir, name);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.isFile()) {
            fileList.push({ path: fullPath, name, size: stat.size });
          }
        } catch {}
      }
    }
  }

  await traverse(rootDir, 0);
  return fileList;
}

// ─── IPC Handlers: Linked Media Library ───

secureHandle('library:pick-files', async () => {
  const parent = getDialogParent();
  const options = {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Media', extensions: ALL_ALLOWED_EXTS }]
  };
  const dialogRes = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (dialogRes.canceled || !dialogRes.filePaths || dialogRes.filePaths.length === 0) {
    return { entries: [] };
  }

  const entries = [];
  for (const filePath of dialogRes.filePaths) {
    const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
    const kind = getMediaKind(ext);
    if (!kind) continue;

    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) continue;

      const id = crypto.randomUUID();
      const name = path.basename(filePath);
      const parentName = path.basename(path.dirname(filePath));
      libraryRegistry.set(id, { path: filePath, name, size: stat.size });
      entries.push({
        id,
        name,
        size: stat.size,
        kind,
        ext,
        parentName
      });
    } catch {}
  }

  if (entries.length > 0) {
    scheduleLibrarySave();
  }

  return { entries };
});

secureHandle('library:pick-folder', async () => {
  const parent = getDialogParent();
  const options = {
    properties: ['openDirectory']
  };
  const dialogRes = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (dialogRes.canceled || !dialogRes.filePaths || dialogRes.filePaths.length === 0) {
    return { entries: [], truncated: false };
  }

  const rootDir = dialogRes.filePaths[0];
  const { entries, truncated } = await scanFolderForMedia(rootDir);

  if (entries.length > 0) {
    scheduleLibrarySave();
  }

  return { entries, truncated };
});

secureHandle('library:status', async (_event, ids) => {
  if (!Array.isArray(ids)) return {};
  const list = ids.slice(0, 5000);
  const result = {};
  const toCheck = [];

  for (const id of list) {
    if (typeof id !== 'string') continue;
    if (!isValidId(id) || !libraryRegistry.has(id)) {
      result[id] = 'missing';
    } else {
      toCheck.push({ id, path: libraryRegistry.get(id).path });
    }
  }

  await runWithConcurrency(toCheck, 16, async ({ id, path: filePath }) => {
    try {
      const stat = await fs.promises.stat(filePath);
      result[id] = stat.isFile() ? 'ok' : 'missing';
    } catch {
      result[id] = 'missing';
    }
  });

  return result;
});

secureHandle('library:open', async (_event, id) => {
  if (typeof id !== 'string' || !isValidId(id) || !libraryRegistry.has(id)) {
    return { ok: false, error: 'not_found' };
  }
  const entry = libraryRegistry.get(id);
  const ext = path.extname(entry.path).toLowerCase().replace(/^\./, '');
  if (!getMediaKind(ext)) {
    return { ok: false, error: 'invalid_type' };
  }
  try {
    const errString = await shell.openPath(entry.path);
    if (errString) {
      return { ok: false, error: errString };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'failed_to_open' };
  }
});

secureHandle('library:show-in-folder', async (_event, id) => {
  if (typeof id !== 'string' || !isValidId(id) || !libraryRegistry.has(id)) {
    return { ok: false };
  }
  const entry = libraryRegistry.get(id);
  try {
    shell.showItemInFolder(entry.path);
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

secureHandle('library:relink', async (_event, id, kind) => {
  if (typeof id !== 'string' || !isValidId(id)) {
    return { ok: false };
  }

  const hasEntry = libraryRegistry.has(id);
  const targetKind = (kind === 'video' || kind === 'audio' || kind === 'image') ? kind : null;

  let expectedKind = null;
  if (hasEntry) {
    const currentEntry = libraryRegistry.get(id);
    const oldExt = path.extname(currentEntry.path).toLowerCase().replace(/^\./, '');
    expectedKind = getMediaKind(oldExt);
  } else {
    expectedKind = targetKind;
  }

  const parent = getDialogParent();
  const options = {
    properties: ['openFile'],
    filters: [{ name: 'Media', extensions: ALL_ALLOWED_EXTS }]
  };
  const dialogRes = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (dialogRes.canceled || !dialogRes.filePaths || dialogRes.filePaths.length === 0) {
    return { ok: false };
  }

  const newPath = dialogRes.filePaths[0];
  const newExt = path.extname(newPath).toLowerCase().replace(/^\./, '');
  const newKind = getMediaKind(newExt);
  if (!newKind) {
    return { ok: false };
  }

  if (hasEntry) {
    if (newKind !== expectedKind) {
      return { ok: false };
    }
  } else {
    if (expectedKind && newKind !== expectedKind) {
      return { ok: false };
    }
  }

  try {
    const stat = await fs.promises.stat(newPath);
    if (!stat.isFile()) return { ok: false };

    const entry = libraryRegistry.get(id) || {};
    entry.path = newPath;
    entry.name = path.basename(newPath);
    entry.size = stat.size;
    libraryRegistry.set(id, entry);
    scheduleLibrarySave();
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

secureHandle('library:relink-folder', async (_event, items) => {
  if (!Array.isArray(items)) {
    return { relinked: 0, total: 0 };
  }
  const targetItems = items.slice(0, 5000).filter(item => 
    item && 
    typeof item === 'object' && 
    typeof item.id === 'string' && 
    isValidId(item.id) && 
    typeof item.name === 'string' && 
    item.name.trim().length > 0 &&
    item.name.length <= 260
  );
  if (targetItems.length === 0) {
    return { relinked: 0, total: 0 };
  }

  const parent = getDialogParent();
  const options = {
    properties: ['openDirectory']
  };
  const dialogRes = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (dialogRes.canceled || !dialogRes.filePaths || dialogRes.filePaths.length === 0) {
    return { relinked: 0, total: targetItems.length };
  }

  const rootDir = dialogRes.filePaths[0];
  const foundFiles = await scanFolderFiles(rootDir);

  const byName = new Map();
  for (const f of foundFiles) {
    const key = f.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key).push(f);
  }

  let relinked = 0;
  for (const item of targetItems) {
    const candidates = byName.get(item.name.toLowerCase());
    if (!candidates || candidates.length === 0) continue;

    let match = null;
    if (typeof item.size === 'number' && item.size > 0) {
      match = candidates.find(c => c.size === item.size) || null;
    } else {
      match = candidates[0];
    }

    if (match) {
      const entry = libraryRegistry.get(item.id) || {};
      entry.path = match.path;
      entry.name = match.name;
      entry.size = match.size;
      libraryRegistry.set(item.id, entry);
      relinked++;
    }
  }

  if (relinked > 0) {
    scheduleLibrarySave();
  }

  return { relinked, total: targetItems.length };
});

secureHandle('library:forget', async (_event, ids) => {
  if (!Array.isArray(ids)) return { ok: false };
  let changed = false;
  for (const id of ids.slice(0, 5000)) {
    if (typeof id === 'string' && isValidId(id) && libraryRegistry.has(id)) {
      libraryRegistry.delete(id);
      changed = true;
    }
  }
  if (changed) {
    scheduleLibrarySave();
  }
  return { ok: true };
});

secureHandle('library:clear-all', async () => {
  libraryRegistry.clear();
  scheduleLibrarySave();
  return { ok: true };
});

// ── Downloads engine ──
const { net } = require('electron');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

const downloadsRegistry = new Map();
const MAX_CONCURRENT_DOWNLOADS = 3;

function sanitizeFilename(rawName) {
  if (typeof rawName !== 'string') return 'download';
  let name = path.basename(rawName.trim());
  name = name.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '');
  name = name.replace(/^[. ]+|[. ]+$/g, '');
  const isReserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i.test(name);
  if (isReserved) name = '_' + name;
  if (name.length > 150) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    if (ext.length < 50) {
      name = base.slice(0, 150 - ext.length) + ext;
    } else {
      name = name.slice(0, 150);
    }
    name = name.replace(/^[. ]+|[. ]+$/g, '');
  }
  return name || 'download';
}

function getUniqueFinalPath(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let counter = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${counter})${ext}`;
    counter++;
  }
  return {
    finalPath: path.join(dir, candidate),
    savedName: candidate
  };
}

function sendDownloadProgress(record, immediate = false) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
    return;
  }
  const now = Date.now();
  if (!immediate && now - record.lastProgressSend < 250) {
    return;
  }
  record.lastProgressSend = now;

  try {
    mainWindow.webContents.send('downloads:progress', {
      id: record.id,
      status: record.status,
      received: record.received,
      total: record.total,
      speed: record.speed,
      savedName: record.savedName,
      error: record.error
    });
  } catch (_e) {}
}

function getActiveDownloadCount() {
  let count = 0;
  for (const record of downloadsRegistry.values()) {
    if (record.status === 'downloading') {
      count++;
    }
  }
  return count;
}

function processDownloadQueue() {
  if (getActiveDownloadCount() >= MAX_CONCURRENT_DOWNLOADS) return;

  for (const record of downloadsRegistry.values()) {
    if (record.status === 'queued') {
      executeDownload(record);
      if (getActiveDownloadCount() >= MAX_CONCURRENT_DOWNLOADS) break;
    }
  }
}

function finalizeDownload(record, finalSize) {
  try {
    const downloadDir = app.getPath('downloads');
    const { finalPath, savedName } = getUniqueFinalPath(downloadDir, record.sanitizedName);

    fs.renameSync(record.partPath, finalPath);

    record.status = 'completed';
    record.received = finalSize;
    if (record.total <= 0 || record.received > record.total) {
      record.total = finalSize;
    }
    record.speed = 0;
    record.finalPath = finalPath;
    record.savedName = savedName;
    record.controller = null;

    sendDownloadProgress(record, true);
  } catch (renameErr) {
    record.status = 'error';
    record.speed = 0;
    record.error = renameErr?.code || 'finalize_failed';
    sendDownloadProgress(record, true);
  } finally {
    processDownloadQueue();
  }
}

async function executeDownload(record) {
  record.status = 'downloading';
  record.error = undefined;
  const controller = new AbortController();
  record.controller = controller;
  sendDownloadProgress(record, true);

  try {
    let existingSize = 0;
    try {
      if (fs.existsSync(record.partPath)) {
        existingSize = fs.statSync(record.partPath).size;
      }
    } catch {
      existingSize = 0;
    }

    let response;
    let flags = 'w';
    let received = 0;

    const fetchHeaders = {};
    if (existingSize > 0) {
      fetchHeaders['Range'] = `bytes=${existingSize}-`;
    }

    try {
      response = await net.fetch(record.url, {
        headers: fetchHeaders,
        signal: controller.signal,
        cache: 'no-store'
      });
    } catch (fetchErr) {
      if (controller.signal.aborted) return;
      record.status = 'error';
      record.speed = 0;
      record.error = fetchErr?.code || 'fetch_failed';
      sendDownloadProgress(record, true);
      processDownloadQueue();
      return;
    }

    if (controller.signal.aborted) return;

    if (response.status === 416) {
      const cr = response.headers.get('content-range') || '';
      const crMatch = cr.match(/\/(\d+)$/);
      const serverTotal = crMatch ? parseInt(crMatch[1], 10) : (record.total || 0);

      if (serverTotal > 0 && existingSize === serverTotal) {
        finalizeDownload(record, existingSize);
        return;
      } else {
        try {
          fs.truncateSync(record.partPath, 0);
        } catch {}
        existingSize = 0;

        try {
          response = await net.fetch(record.url, {
            signal: controller.signal,
            cache: 'no-store'
          });
        } catch (fetchErr) {
          if (controller.signal.aborted) return;
          record.status = 'error';
          record.speed = 0;
          record.error = fetchErr?.code || 'fetch_failed';
          sendDownloadProgress(record, true);
          processDownloadQueue();
          return;
        }
      }
    }

    if (response.status === 206) {
      flags = 'a';
      received = existingSize;
      const cl = response.headers.get('content-length');
      const cr = response.headers.get('content-range');
      if (cr) {
        const crMatch = cr.match(/\/(\d+)$/);
        if (crMatch) {
          record.total = parseInt(crMatch[1], 10);
        }
      } else if (cl) {
        record.total = existingSize + parseInt(cl, 10);
      }
    } else if (response.status === 200) {
      flags = 'w';
      received = 0;
      const cl = response.headers.get('content-length');
      if (cl) {
        record.total = parseInt(cl, 10);
      }
    } else {
      record.status = 'error';
      record.speed = 0;
      record.error = `http_${response.status}`;
      sendDownloadProgress(record, true);
      processDownloadQueue();
      return;
    }

    record.received = received;
    record.speedTracker = { lastTime: Date.now(), lastBytes: received };

    const nodeStream = Readable.fromWeb(response.body);
    const fileStream = fs.createWriteStream(record.partPath, { flags });

    const progressTracker = new Transform({
      transform(chunk, _encoding, callback) {
        record.received += chunk.length;
        const now = Date.now();
        const dt = (now - record.speedTracker.lastTime) / 1000;
        if (dt >= 0.5) {
          record.speed = Math.round((record.received - record.speedTracker.lastBytes) / dt);
          record.speedTracker.lastTime = now;
          record.speedTracker.lastBytes = record.received;
        }
        sendDownloadProgress(record, false);
        callback(null, chunk);
      }
    });

    await pipeline(nodeStream, progressTracker, fileStream);

    if (controller.signal.aborted) return;

    finalizeDownload(record, record.received);
  } catch (err) {
    if (controller.signal.aborted) return;
    record.status = 'error';
    record.speed = 0;
    record.error = err?.code || err?.message || 'stream_error';
    sendDownloadProgress(record, true);
    processDownloadQueue();
  }
}

secureHandle('downloads:start', async (_event, payload) => {
  try {
    const { id, url, filename } = payload || {};

    if (!id || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      return { ok: false, error: 'invalid_id' };
    }

    if (!url || typeof url !== 'string') {
      return { ok: false, error: 'invalid_url' };
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { ok: false, error: 'invalid_url' };
      }
    } catch {
      return { ok: false, error: 'invalid_url' };
    }

    const existing = downloadsRegistry.get(id);
    if (existing) {
      if (existing.status === 'downloading' || existing.status === 'queued' || existing.status === 'completed') {
        return { ok: true };
      }
      if (existing.status === 'paused' || existing.status === 'error' || existing.status === 'cancelled') {
        existing.status = 'queued';
        existing.error = undefined;
        sendDownloadProgress(existing, true);
        processDownloadQueue();
        return { ok: true };
      }
    }

    const downloadDir = app.getPath('downloads');
    try {
      fs.mkdirSync(downloadDir, { recursive: true });
    } catch {}

    const rawFilename = (filename && typeof filename === 'string') ? filename : path.basename(new URL(url).pathname);
    const sanitizedName = sanitizeFilename(rawFilename);
    const partPath = path.join(downloadDir, `${sanitizedName}.${id}.part`);

    let initialReceived = 0;
    try {
      if (fs.existsSync(partPath)) {
        initialReceived = fs.statSync(partPath).size;
      }
    } catch {}

    const record = {
      id,
      url,
      filename: filename || sanitizedName,
      sanitizedName,
      partPath,
      status: 'queued',
      received: initialReceived,
      total: 0,
      speed: 0,
      error: undefined,
      savedName: undefined,
      finalPath: undefined,
      controller: null,
      lastProgressSend: 0,
      speedTracker: { lastTime: Date.now(), lastBytes: initialReceived }
    };

    downloadsRegistry.set(id, record);
    sendDownloadProgress(record, true);
    processDownloadQueue();

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.code || 'start_failed' };
  }
});

secureHandle('downloads:pause', async (_event, id) => {
  if (typeof id !== 'string' || !id) {
    return { ok: false, error: 'invalid_id' };
  }
  const record = downloadsRegistry.get(id);
  if (!record) {
    return { ok: false, error: 'not_found' };
  }
  if (record.status === 'completed') {
    return { ok: true };
  }
  record.status = 'paused';
  record.speed = 0;
  if (record.controller) {
    record.controller.abort();
    record.controller = null;
  }
  sendDownloadProgress(record, true);
  processDownloadQueue();
  return { ok: true };
});

secureHandle('downloads:cancel', async (_event, id) => {
  if (typeof id !== 'string' || !id) {
    return { ok: false, error: 'invalid_id' };
  }
  const record = downloadsRegistry.get(id);
  if (!record) {
    return { ok: false, error: 'not_found' };
  }
  record.status = 'cancelled';
  record.speed = 0;
  record.received = 0;
  if (record.controller) {
    record.controller.abort();
    record.controller = null;
  }
  try {
    if (fs.existsSync(record.partPath)) {
      fs.unlinkSync(record.partPath);
    }
  } catch (_e) {}
  sendDownloadProgress(record, true);
  processDownloadQueue();
  return { ok: true };
});

secureHandle('downloads:remove', async (_event, id) => {
  if (typeof id !== 'string' || !id) {
    return { ok: false, error: 'invalid_id' };
  }
  const record = downloadsRegistry.get(id);
  if (record) {
    if (record.controller) {
      record.controller.abort();
      record.controller = null;
    }
    if (record.status !== 'completed') {
      try {
        if (fs.existsSync(record.partPath)) {
          fs.unlinkSync(record.partPath);
        }
      } catch (_e) {}
    }
    downloadsRegistry.delete(id);
    processDownloadQueue();
  }
  return { ok: true };
});

secureHandle('downloads:list', async () => {
  const list = [];
  for (const record of downloadsRegistry.values()) {
    list.push({
      id: record.id,
      status: record.status,
      received: record.received,
      total: record.total,
      speed: record.speed,
      savedName: record.savedName,
      error: record.error
    });
  }
  return list;
});

secureHandle('downloads:show-in-folder', async (_event, id) => {
  if (typeof id !== 'string' || !id) {
    return { ok: false, error: 'invalid_id' };
  }
  const record = downloadsRegistry.get(id);
  if (!record || record.status !== 'completed' || !record.finalPath) {
    return { ok: false, error: 'not_found' };
  }
  try {
    if (fs.existsSync(record.finalPath)) {
      shell.showItemInFolder(record.finalPath);
      return { ok: true };
    } else {
      return { ok: false, error: 'file_not_found' };
    }
  } catch (_e) {
    return { ok: false, error: 'show_failed' };
  }
});

app.on('before-quit', () => {
  for (const record of downloadsRegistry.values()) {
    if (record.status === 'downloading' || record.status === 'queued') {
      if (record.controller) {
        record.controller.abort();
        record.controller = null;
      }
      record.status = 'paused';
      record.speed = 0;
    }
  }
});

app.whenReady().then(() => {
  loadLibraryRegistry();

  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let relativePath = decodeURIComponent(url.pathname);
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.slice(1);
      }
      if (!relativePath) {
        relativePath = 'index.html';
      }

      const distRoot = path.resolve(__dirname, '..', 'dist');
      let filePath = path.resolve(distRoot, relativePath);

      // Path traversal protection: ensure the resolved path stays within distRoot
      const relativeToDist = path.relative(distRoot, filePath);
      const isSafe = !relativeToDist.startsWith('..') && !path.isAbsolute(relativeToDist);
      if (!isSafe) {
        filePath = path.join(distRoot, 'index.html');
      }

      let targetFile = filePath;
      let exists = false;
      try {
        const stat = await fs.promises.stat(targetFile);
        if (stat.isFile()) {
          exists = true;
        }
      } catch {
        exists = false;
      }

      // Nonexistent files or paths without extension fallback to index.html (SPA)
      if (!exists || !path.extname(targetFile)) {
        targetFile = path.join(distRoot, 'index.html');
      }

      const ext = path.extname(targetFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const data = await fs.promises.readFile(targetFile);

      return new Response(data, {
        status: 200,
        headers: {
          'content-type': contentType,
          'Content-Security-Policy': CONTENT_SECURITY_POLICY
        }
      });
    } catch (error) {
      console.error('[Electron protocol app error]', error);
      return new Response('Not Found', { status: 404 });
    }
  });

  protocol.handle('corely-media', async (request) => {
    try {
      const url = new URL(request.url);
      let id = '';
      if (url.host === 'f') {
        id = url.pathname.replace(/^\/+/, '').split('/')[0];
      } else {
        const parts = url.pathname.replace(/^\/+/, '').split('/');
        if (parts[0] === 'f' && parts[1]) {
          id = parts[1];
        } else if (parts[0]) {
          id = parts[0];
        }
      }

      if (!isValidId(id) || !libraryRegistry.has(id)) {
        return new Response('Not Found', { status: 404 });
      }

      const entry = libraryRegistry.get(id);
      const filePath = entry.path;
      const ext = path.extname(filePath).toLowerCase().replace(/^\./, '');
      const kind = getMediaKind(ext);
      if (!kind) {
        return new Response('Not Found', { status: 404 });
      }

      let stat;
      try {
        stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) {
          return new Response('Not Found', { status: 404 });
        }
      } catch {
        return new Response('Not Found', { status: 404 });
      }

      const fileSize = stat.size;
      const mimeType = getMediaMimeType(ext);

      const commonHeaders = {
        'Content-Type': mimeType,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': 'app://corely',
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'bytes'
      };

      const rangeHeader = request.headers.get('range') || request.headers.get('Range');
      if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
        const rangeVal = rangeHeader.slice(6).trim();
        const parts = rangeVal.split('-');
        let start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start)) {
          start = fileSize - end;
          end = fileSize - 1;
        }
        if (isNaN(end) || end >= fileSize) {
          end = fileSize - 1;
        }

        if (isNaN(start) || start < 0 || start > end || start >= fileSize) {
          return new Response(null, {
            status: 416,
            headers: {
              ...commonHeaders,
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }

        const chunkSize = end - start + 1;
        const responseHeaders = {
          ...commonHeaders,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': String(chunkSize)
        };

        if (request.method === 'HEAD') {
          return new Response(null, {
            status: 206,
            headers: responseHeaders
          });
        }

        const stream = fs.createReadStream(filePath, { start, end });
        return new Response(Readable.toWeb(stream), {
          status: 206,
          headers: responseHeaders
        });
      }

      const responseHeaders = {
        ...commonHeaders,
        'Content-Length': String(fileSize)
      };

      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: responseHeaders
        });
      }

      const stream = fs.createReadStream(filePath);
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: responseHeaders
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  Menu.setApplicationMenu(null);
  createTray();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (librarySaveTimeout) {
    clearTimeout(librarySaveTimeout);
    librarySaveTimeout = null;
    saveLibraryRegistrySync();
  }
  if (dnsHelperState) {
    try {
      dnsHelperState.counter += 1;
      const reqPath = path.join(dnsHelperState.dir, `req-${dnsHelperState.counter}.json`);
      fs.writeFileSync(reqPath, JSON.stringify({ token: dnsHelperState.token, action: 'quit' }), 'utf8');
    } catch {}
  }
});
}

const { app } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let dir = null;
let parentPid = null;
let token = null;

for (const arg of process.argv) {
  if (arg.startsWith('--dir=')) {
    dir = arg.slice(6);
  } else if (arg.startsWith('--parent=')) {
    const p = parseInt(arg.slice(9), 10);
    if (Number.isInteger(p) && p > 0) {
      parentPid = p;
    }
  } else if (arg.startsWith('--token=')) {
    token = arg.slice(8);
  }
}

function isDirValid(targetDir) {
  if (!targetDir || typeof targetDir !== 'string') return false;
  if (!path.isAbsolute(targetDir)) return false;
  const folderName = path.basename(targetDir);
  if (!folderName.startsWith('corely-dns-')) return false;

  const resolvedDir = path.resolve(targetDir);
  const resolvedTmp = path.resolve(os.tmpdir());
  const relative = path.relative(resolvedTmp, resolvedDir);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return true;
}

if (!token || !/^[a-f0-9]{64}$/.test(token) || !parentPid || !isDirValid(dir)) {
  app.exit(1);
  return;
}

app.setPath('userData', path.join(os.tmpdir(), 'corely-dns-helper-data'));
app.disableHardwareAcceleration();

function isValidIPv4(value) {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isSafeAdapterName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 256 && !/["%^&|<>`\r\n]/.test(name);
}

function getSystemAdapters() {
  return new Promise((resolve) => {
    exec('netsh interface show interface', { encoding: 'utf8', windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const adapters = [];
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('---') || /admin\s*state/i.test(trimmed)) {
          continue;
        }
        const parts = trimmed.split(/\s{2,}/);
        const name = parts[parts.length - 1]?.trim();
        if (name && !/admin|state|interface/i.test(name)) {
          adapters.push(name);
        }
      }
      resolve(adapters);
    });
  });
}

function execCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

async function writeResponse(resPath, data) {
  const tmpPath = `${resPath}.tmp.${Date.now()}`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(data), 'utf8');
  await fs.promises.rename(tmpPath, resPath);
}

let isExiting = false;
function cleanupAndExit() {
  if (isExiting) return;
  isExiting = true;
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {}
      }
      try {
        fs.rmdirSync(dir);
      } catch {}
    }
  } catch {}
  app.exit(0);
}

// Check parent process every 3 seconds
setInterval(() => {
  try {
    process.kill(parentPid, 0);
  } catch {
    cleanupAndExit();
  }
}, 3000);

let lastActivityTime = Date.now();
let isProcessing = false;

async function processQueue() {
  if (isExiting || isProcessing) return;
  isProcessing = true;

  try {
    if (Date.now() - lastActivityTime > 10 * 60 * 1000) {
      cleanupAndExit();
      return;
    }

    if (!fs.existsSync(dir)) {
      cleanupAndExit();
      return;
    }

    const files = await fs.promises.readdir(dir);
    const reqFiles = files
      .filter(f => /^req-(\d+)\.json$/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(/^req-(\d+)\.json$/)[1], 10);
        const numB = parseInt(b.match(/^req-(\d+)\.json$/)[1], 10);
        return numA - numB;
      });

    for (const file of reqFiles) {
      lastActivityTime = Date.now();
      const match = file.match(/^req-(\d+)\.json$/);
      if (!match) continue;
      const reqNum = match[1];
      const reqPath = path.join(dir, file);
      const resPath = path.join(dir, `res-${reqNum}.json`);

      let content;
      try {
        content = await fs.promises.readFile(reqPath, 'utf8');
      } catch {
        continue;
      }

      let data;
      try {
        data = JSON.parse(content);
      } catch {
        await writeResponse(resPath, { ok: false, error: 'invalid_json' });
        try { await fs.promises.unlink(reqPath); } catch {}
        continue;
      }

      // Validate token
      if (!data || data.token !== token) {
        await writeResponse(resPath, { ok: false, error: 'permission_denied' });
        try { await fs.promises.unlink(reqPath); } catch {}
        continue;
      }

      // Validate action
      if (!['set', 'reset', 'ping', 'quit'].includes(data.action)) {
        await writeResponse(resPath, { ok: false, error: 'invalid_action' });
        try { await fs.promises.unlink(reqPath); } catch {}
        continue;
      }

      if (data.action === 'ping') {
        await writeResponse(resPath, { ok: true });
        try { await fs.promises.unlink(reqPath); } catch {}
        continue;
      }

      if (data.action === 'quit') {
        await writeResponse(resPath, { ok: true });
        try { await fs.promises.unlink(reqPath); } catch {}
        setTimeout(() => cleanupAndExit(), 100);
        return;
      }

      // Handle set or reset
      const adapter = data.adapter;
      if (!isSafeAdapterName(adapter)) {
        await writeResponse(resPath, { ok: false, error: 'invalid_adapter_name' });
        try { await fs.promises.unlink(reqPath); } catch {}
        continue;
      }

      const systemAdapters = await getSystemAdapters();
      const matched = systemAdapters.find(a => a.toLowerCase() === adapter.toLowerCase());
      if (!matched) {
        await writeResponse(resPath, { ok: false, error: 'adapter_not_found' });
        try { await fs.promises.unlink(reqPath); } catch {}
        continue;
      }

      const commands = [];
      if (data.action === 'reset') {
        commands.push(`netsh interface ip set dns name="${matched}" source=dhcp`);
      } else {
        const primary = typeof data.primary === 'string' ? data.primary.trim() : '';
        const secondary = typeof data.secondary === 'string' ? data.secondary.trim() : '';

        if (!primary || !isValidIPv4(primary)) {
          await writeResponse(resPath, { ok: false, error: 'invalid_primary_dns' });
          try { await fs.promises.unlink(reqPath); } catch {}
          continue;
        }

        if (secondary && !isValidIPv4(secondary)) {
          await writeResponse(resPath, { ok: false, error: 'invalid_secondary_dns' });
          try { await fs.promises.unlink(reqPath); } catch {}
          continue;
        }

        commands.push(`netsh interface ip set dns name="${matched}" source=static addr=${primary}`);
        if (secondary) {
          commands.push(`netsh interface ip add dns name="${matched}" addr=${secondary} index=2`);
        }
      }

      try {
        for (const cmd of commands) {
          await execCommand(cmd);
        }
        await writeResponse(resPath, { ok: true });
      } catch (err) {
        await writeResponse(resPath, { ok: false, error: err.message || 'netsh_failed' });
      } finally {
        try { await fs.promises.unlink(reqPath); } catch {}
      }
    }
  } catch {
    // ignore directory scan errors
  } finally {
    isProcessing = false;
  }
}

app.whenReady().then(() => {
  try {
    fs.writeFileSync(path.join(dir, 'ready'), 'ready', 'utf8');
  } catch {
    cleanupAndExit();
    return;
  }

  setInterval(processQueue, 300);
});

'use strict';

const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const config = require('./config.json');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// APK_PATH can point to a Railway Volume (e.g. /data/HydraTools.apk) if the file is too big for git.
const APK_PATH = process.env.APK_PATH || path.join(ROOT, 'apk', config.apkFile);

app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway sits behind a proxy
app.use(compression());

// ---- security headers -------------------------------------------------
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "font-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'"
    ].join('; ')
  });
  next();
});

// ---- APK info (size + SHA-256 are read from the real file) ------------
let hashCache = null; // { key, promise }

function fileInfo() {
  try {
    const st = fs.statSync(APK_PATH);
    if (!st.isFile()) return null;
    return { size: st.size, mtime: st.mtime };
  } catch (_) {
    return null;
  }
}

function sha256Of(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

function getHash(info) {
  const key = info.size + ':' + info.mtime.getTime();
  if (!hashCache || hashCache.key !== key) {
    hashCache = { key, promise: sha256Of(APK_PATH) };
  }
  return hashCache.promise;
}

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

app.get('/api/info', async (req, res) => {
  const info = fileInfo();
  const base = {
    name: config.name,
    version: config.version,
    file: config.apkFile,
    telegram: config.telegram,
    shizukuUrl: config.shizukuUrl,
    available: !!info
  };
  if (!info) return res.json(base);
  try {
    const sha256 = await getHash(info);
    res.json({
      ...base,
      size: info.size,
      sizeHuman: humanSize(info.size),
      sha256,
      updatedAt: info.mtime.toISOString()
    });
  } catch (err) {
    console.error('hash failed:', err);
    res.json({ ...base, size: info.size, sizeHuman: humanSize(info.size), updatedAt: info.mtime.toISOString() });
  }
});

// ---- download with a small per-IP limit so nobody drains bandwidth ----
const hits = new Map();
const LIMIT = Number(config.downloadsPerHourPerIp) || 20;
const WINDOW = 60 * 60 * 1000;

function limited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW });
    return false;
  }
  rec.count += 1;
  return rec.count > LIMIT;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) if (now > rec.reset) hits.delete(ip);
}, 10 * 60 * 1000).unref();

app.get('/download', (req, res) => {
  const info = fileInfo();
  if (!info) {
    return res
      .status(404)
      .type('text/plain')
      .send('The APK has not been uploaded yet. Please check back later or message @' + config.telegram + ' on Telegram.');
  }
  if (limited(req.ip)) {
    return res
      .status(429)
      .type('text/plain')
      .send('Too many downloads from this connection. Try again in a bit.');
  }
  console.log(new Date().toISOString(), 'download', config.apkFile);
  res.set('Cache-Control', 'no-store');
  res.download(APK_PATH, config.apkFile, {
    headers: { 'Content-Type': 'application/vnd.android.package-archive' }
  }, (err) => {
    if (err && !res.headersSent) res.status(500).type('text/plain').send('Download failed. Please try again.');
  });
});

app.get('/healthz', (req, res) => res.type('text/plain').send('ok'));

// ---- static site ------------------------------------------------------
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  setHeaders(res, file) {
    if (/\.(jpg|jpeg|png|svg|woff2?)$/i.test(file)) res.set('Cache-Control', 'public, max-age=604800');
    else if (/\.(css|js)$/i.test(file)) res.set('Cache-Control', 'public, max-age=3600');
    else res.set('Cache-Control', 'no-cache');
  }
}));

app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.listen(PORT, () => {
  console.log(`${config.name} site listening on :${PORT}`);
  const info = fileInfo();
  console.log(info ? `APK found at ${APK_PATH} (${humanSize(info.size)})` : `APK missing. Expected at ${APK_PATH}`);
});

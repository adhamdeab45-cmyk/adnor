'use strict';

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const path = require('path');

const PORT = process.env.PORT || 10000;
const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://adnor-vp-default-rtdb.firebaseio.com';
const TZ = process.env.DRAW_TIMEZONE || 'Europe/Istanbul';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adhamdeab45@gmail.com';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+905445034910';

let admin = null;
let db = null;
let adminReady = false;

function loadAdminSdk() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { ok: false, reason: 'FIREBASE_SERVICE_ACCOUNT_JSON not set' };
  try {
    const serviceAccount = JSON.parse(raw);
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: DB_URL });
    }
    db = admin.database();
    adminReady = true;
    return { ok: true };
  } catch (err) {
    adminReady = false;
    return { ok: false, reason: err.message };
  }
}

const adminState = loadAdminSdk();

const app = express();
app.set('trust proxy', 1);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '0', etag: false }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'ADNOR V9', firebaseAdmin: adminReady, firebaseAdminReason: adminReady ? 'ok' : adminState.reason, timezone: TZ });
});

app.get('/api/version', (req, res) => {
  res.json({ version: 'ADNOR_V9_GOOGLE_FIRST_REBUILD', firebaseProject: 'adnor-vp', adminEmail: ADMIN_EMAIL, adminPhone: ADMIN_PHONE });
});

async function publishScheduledDraws(source = 'cron') {
  if (!adminReady || !db) return { ok: false, reason: 'firebase-admin-not-configured' };
  const now = new Date();
  const currentHourTR = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now);
  if (source === 'cron' && currentHourTR !== '20') return { ok: true, skipped: true, reason: 'not-8pm-in-timezone' };
  const root = db.ref('/global_system/lottery');
  const snap = await root.once('value');
  const lottery = snap.val() || {};
  const updates = {};
  ['daily', 'weekly', 'monthly', 'yearly'].forEach(type => {
    const draw = lottery[type] || {};
    if (draw.scheduledWinnerNumber && draw.scheduleAt8 === true && !draw.publishedAt) {
      updates[`/${type}/winnerNumber`] = draw.scheduledWinnerNumber;
      updates[`/${type}/winnerName`] = draw.scheduledWinnerName || 'ADNOR Winner';
      updates[`/${type}/publishedAt`] = Date.now();
      updates[`/${type}/status`] = 'published';
      updates[`/${type}/scheduleAt8`] = false;
    }
  });
  if (Object.keys(updates).length) await root.update(updates);
  if (Object.keys(updates).length) await db.ref('/server_logs').push({ type: 'draw_publish', source, at: Date.now(), updates });
  return { ok: true, updates: Object.keys(updates).length };
}

app.post('/api/admin/publish-scheduled-draws', async (req, res) => {
  try {
    const result = await publishScheduledDraws('manual-api');
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

cron.schedule('* * * * *', async () => {
  try { await publishScheduledDraws('cron'); }
  catch (err) { console.error('[ADNOR CRON]', err.message); }
}, { timezone: TZ });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.listen(PORT, () => {
  console.log(`ADNOR V9 running on port ${PORT} timezone=${TZ} firebaseAdmin=${adminReady}`);
});

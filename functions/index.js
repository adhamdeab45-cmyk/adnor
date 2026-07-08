const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

admin.initializeApp();
const db = admin.database();
const VERSION = 'ADNOR_V201_ROOT_PUBLIC_DEPLOY';
const ADMIN_EMAILS = new Set(['adhamdeab2@gmail.com','adhamdeab45@gmail.com']);

function n(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}
function clean(v) { return String(v ?? '').trim(); }
function now() { return new Date().toISOString(); }
function loginToEmail(loginId) {
  const v = clean(loginId).toLowerCase();
  if (!v) return '';
  return v.includes('@') ? v : `${v}@agents.adnor.local`;
}
function publicId(uid) { return `ADN-${String(uid || '').slice(-5).toUpperCase()}`; }
function assertAuth(req) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً.');
  return req.auth.uid;
}
async function getProfile(uid) {
  const snap = await db.ref(`users/${uid}`).get();
  return snap.val() || null;
}
async function isAdminUid(uid, email) {
  if (email && ADMIN_EMAILS.has(String(email).toLowerCase())) return true;
  const u = await getProfile(uid);
  return !!(u && (u.isAdmin === true || u.role === 'admin'));
}
async function assertAdmin(req) {
  const uid = assertAuth(req);
  const email = req.auth.token.email || '';
  if (!(await isAdminUid(uid, email))) throw new HttpsError('permission-denied', 'هذه العملية للأدمن فقط.');
  return uid;
}
async function assertAgent(req) {
  const uid = assertAuth(req);
  const snap = await db.ref(`agents/${uid}`).get();
  const agent = snap.val();
  if (!agent) throw new HttpsError('permission-denied', 'هذا الحساب ليس وكيل شحن.');
  if (!agent.active) throw new HttpsError('permission-denied', 'حساب وكيل الشحن موقوف.');
  return { uid, agent };
}
function safePushKey(path) { return db.ref(path).push().key; }
async function getAdnPrice() {
  const snap = await db.ref('public/adn/price').get();
  const price = n(snap.val(), 0.01);
  return price > 0 ? price : 0.01;
}
async function findUserUid(target) {
  const t = clean(target);
  if (!t) throw new HttpsError('invalid-argument', 'اكتب ID المستخدم أو البريد أو كود الدعوة.');
  const direct = await db.ref(`users/${t}`).get();
  if (direct.exists()) return t;
  const fields = ['email','refCode','publicId'];
  for (const f of fields) {
    const q = await db.ref('users').orderByChild(f).equalTo(t).get();
    if (q.exists()) return Object.keys(q.val())[0];
  }
  throw new HttpsError('not-found', 'لم يتم العثور على المستخدم.');
}
async function addTransaction(uid, data) {
  const id = safePushKey(`transactions/${uid}`);
  await db.ref(`transactions/${uid}/${id}`).set({ id, uid, createdAt: now(), ...data });
  return id;
}
async function addAudit(data) {
  const id = safePushKey('finance_audit');
  await db.ref(`finance_audit/${id}`).set({ id, createdAt: now(), ...data });
  return id;
}

exports.health = onCall({ region: 'us-central1' }, async () => ({ ok: true, version: VERSION, at: now() }));

exports.syncProfile = onCall({ region: 'us-central1' }, async (req) => {
  const uid = assertAuth(req);
  const token = req.auth.token || {};
  const email = token.email || '';
  const name = token.name || email?.split('@')[0] || 'مستخدم ADNOR';
  const adminRole = await isAdminUid(uid, email);
  const userRef = db.ref(`users/${uid}`);
  const snap = await userRef.get();
  const base = snap.val() || {};
  const update = {
    uid,
    email,
    name: base.name || name,
    photoURL: token.picture || base.photoURL || '',
    publicId: base.publicId || publicId(uid),
    realBalance: n(base.realBalance),
    bonusBalance: n(base.bonusBalance),
    reservedWithdrawalBalance: n(base.reservedWithdrawalBalance),
    adnBalance: n(base.adnBalance),
    role: adminRole ? 'admin' : (base.role || 'user'),
    isAdmin: adminRole || base.isAdmin === true,
    isFrozen: base.isFrozen === true,
    updatedAt: admin.database.ServerValue.TIMESTAMP,
    createdAt: base.createdAt || admin.database.ServerValue.TIMESTAMP
  };
  await userRef.update(update);
  return { ok: true, isAdmin: !!update.isAdmin, profile: update };
});

exports.tradeAdn = onCall({ region: 'us-central1' }, async (req) => {
  const uid = assertAuth(req);
  const side = clean(req.data?.side).toLowerCase();
  const price = await getAdnPrice();
  let usd = n(req.data?.usd), adn = n(req.data?.adn);
  if (!['buy','sell'].includes(side)) throw new HttpsError('invalid-argument', 'نوع العملية غير صحيح.');
  if (side === 'buy') {
    if (usd <= 0) throw new HttpsError('invalid-argument', 'قيمة الشراء غير صحيحة.');
    adn = usd / price;
  } else {
    if (adn <= 0) throw new HttpsError('invalid-argument', 'كمية البيع غير صحيحة.');
    usd = adn * price;
  }
  let error = '';
  const result = await db.ref(`users/${uid}`).transaction((u) => {
    if (!u) { error = 'المستخدم غير موجود.'; return; }
    u.realBalance = n(u.realBalance);
    u.adnBalance = n(u.adnBalance);
    if (side === 'buy') {
      if (u.realBalance + 1e-9 < usd) { error = 'الرصيد الحقيقي لا يكفي للشراء.'; return; }
      u.realBalance = +(u.realBalance - usd).toFixed(6);
      u.adnBalance = +(u.adnBalance + adn).toFixed(6);
    } else {
      if (u.adnBalance + 1e-9 < adn) { error = 'رصيد ADN لا يكفي للبيع.'; return; }
      u.adnBalance = +(u.adnBalance - adn).toFixed(6);
      u.realBalance = +(u.realBalance + usd).toFixed(6);
    }
    u.updatedAt = admin.database.ServerValue.TIMESTAMP;
    return u;
  });
  if (!result.committed) throw new HttpsError('failed-precondition', error || 'تعذر تنفيذ عملية ADN.');
  const user = result.snapshot.val();
  const tradeId = safePushKey('adn_trades');
  const trade = { id: tradeId, uid, side, usd:+usd.toFixed(6), adn:+adn.toFixed(6), price, status:'completed', createdAt: now() };
  await Promise.all([
    db.ref(`adn_trades/${tradeId}`).set(trade),
    addTransaction(uid, { type:`adn_${side}`, amount: side === 'buy' ? -usd : usd, adn, price, status:'completed' }),
    addAudit({ action:`ADN_${side.toUpperCase()}`, uid, usd, adn, price })
  ]).catch(()=>null);
  return { ok:true, ...trade, realBalance:n(user.realBalance), adnBalance:n(user.adnBalance) };
});

exports.buyTicket = onCall({ region: 'us-central1' }, async (req) => {
  const uid = assertAuth(req);
  const ticketNumber = clean(req.data?.ticketNumber);
  if (!/^\d{6}$/.test(ticketNumber)) throw new HttpsError('invalid-argument', 'رقم التذكرة يجب أن يكون 6 أرقام.');
  const price = 1;
  let error = '';
  const tx = await db.ref(`users/${uid}`).transaction(u => {
    if (!u) { error='المستخدم غير موجود'; return; }
    u.realBalance = n(u.realBalance);
    if (u.realBalance < price) { error='الرصيد الحقيقي لا يكفي لشراء التذكرة.'; return; }
    u.realBalance = +(u.realBalance - price).toFixed(6);
    u.ticketsCount = n(u.ticketsCount) + 1;
    u.updatedAt = admin.database.ServerValue.TIMESTAMP;
    return u;
  });
  if (!tx.committed) throw new HttpsError('failed-precondition', error || 'تعذر شراء التذكرة.');
  const id = safePushKey('tickets');
  const ticket = { id, uid, ticketNumber, price, status:'active', createdAt: now() };
  await Promise.all([
    db.ref(`tickets/${id}`).set(ticket),
    db.ref(`user_tickets/${uid}/${id}`).set(ticket),
    addTransaction(uid, { type:'ticket_buy', amount:-price, status:'completed', ticketNumber })
  ]);
  return { ok:true, id, ticketNumber, realBalance:n(tx.snapshot.val().realBalance) };
});

exports.spinWheel = onCall({ region: 'us-central1' }, async (req) => {
  const uid = assertAuth(req);
  const bet = n(req.data?.bet);
  if (bet <= 0) throw new HttpsError('invalid-argument', 'قيمة الرهان غير صحيحة.');
  const outcomes = [0,0,0.5,1,1,2,2,5,10,100];
  const multiplier = outcomes[Math.floor(Math.random()*outcomes.length)];
  const win = +(bet * multiplier).toFixed(6);
  let error = '';
  const tx = await db.ref(`users/${uid}`).transaction(u => {
    if (!u) { error='المستخدم غير موجود'; return; }
    u.realBalance = n(u.realBalance);
    if (u.realBalance < bet) { error='الرصيد الحقيقي لا يكفي للرهان.'; return; }
    u.realBalance = +(u.realBalance - bet + win).toFixed(6);
    u.updatedAt = admin.database.ServerValue.TIMESTAMP;
    return u;
  });
  if (!tx.committed) throw new HttpsError('failed-precondition', error || 'تعذر تشغيل العجلة.');
  const id = safePushKey('wheel_logs');
  const log = { id, uid, bet, multiplier, win, status:'completed', createdAt: now() };
  await Promise.all([
    db.ref(`wheel_logs/${id}`).set(log),
    addTransaction(uid, { type:'wheel_spin', amount:+(-bet+win).toFixed(6), bet, win, multiplier, status:'completed' })
  ]);
  return { ok:true, ...log, realBalance:n(tx.snapshot.val().realBalance) };
});

exports.requestDeposit = onCall({ region: 'us-central1' }, async (req) => {
  const uid = assertAuth(req);
  const amount = n(req.data?.amount);
  if (amount <= 0) throw new HttpsError('invalid-argument', 'مبلغ الإيداع غير صحيح.');
  const id = safePushKey('finance_requests');
  const item = { id, uid, type:'deposit', amount, method:clean(req.data?.method), note:clean(req.data?.note), status:'pending', createdAt:now() };
  await db.ref(`finance_requests/${id}`).set(item);
  await db.ref(`user_finance/${uid}/${id}`).set(item);
  return { ok:true, id };
});

exports.requestWithdraw = onCall({ region: 'us-central1' }, async (req) => {
  const uid = assertAuth(req);
  const amount = n(req.data?.amount);
  if (amount <= 0) throw new HttpsError('invalid-argument', 'مبلغ السحب غير صحيح.');
  let error='';
  const tx = await db.ref(`users/${uid}`).transaction(u=>{
    if(!u){ error='المستخدم غير موجود'; return; }
    u.realBalance=n(u.realBalance); u.reservedWithdrawalBalance=n(u.reservedWithdrawalBalance);
    if(u.realBalance < amount){ error='الرصيد الحقيقي لا يكفي للسحب.'; return; }
    u.realBalance=+(u.realBalance-amount).toFixed(6);
    u.reservedWithdrawalBalance=+(u.reservedWithdrawalBalance+amount).toFixed(6);
    u.updatedAt=admin.database.ServerValue.TIMESTAMP;
    return u;
  });
  if(!tx.committed) throw new HttpsError('failed-precondition', error || 'تعذر إنشاء طلب السحب.');
  const id = safePushKey('finance_requests');
  const item = { id, uid, type:'withdraw', amount, method:clean(req.data?.method), note:clean(req.data?.note), status:'pending', createdAt:now() };
  await Promise.all([db.ref(`finance_requests/${id}`).set(item), db.ref(`user_finance/${uid}/${id}`).set(item), addTransaction(uid,{type:'withdraw_reserve',amount:-amount,status:'pending'})]);
  return { ok:true, id };
});

exports.adminFinanceDecision = onCall({ region: 'us-central1' }, async (req) => {
  const adminUid = await assertAdmin(req);
  const requestId = clean(req.data?.requestId);
  const decision = clean(req.data?.decision);
  if (!requestId || !['approved','rejected'].includes(decision)) throw new HttpsError('invalid-argument', 'قرار غير صحيح.');
  const ref = db.ref(`finance_requests/${requestId}`);
  const snap = await ref.get();
  const r = snap.val();
  if (!r) throw new HttpsError('not-found', 'الطلب غير موجود.');
  if (r.status !== 'pending') throw new HttpsError('failed-precondition', 'تمت معالجة الطلب سابقاً.');
  const amount = n(r.amount);
  if (r.type === 'deposit' && decision === 'approved') {
    await db.ref(`users/${r.uid}`).transaction(u => { if(!u) return u; u.realBalance=n(u.realBalance)+amount; u.updatedAt=admin.database.ServerValue.TIMESTAMP; return u; });
    await addTransaction(r.uid,{type:'deposit_approved',amount,status:'completed'});
  }
  if (r.type === 'withdraw') {
    await db.ref(`users/${r.uid}`).transaction(u => {
      if(!u) return u;
      u.realBalance=n(u.realBalance); u.reservedWithdrawalBalance=n(u.reservedWithdrawalBalance);
      if(decision === 'approved') u.reservedWithdrawalBalance = Math.max(0, +(u.reservedWithdrawalBalance-amount).toFixed(6));
      else { u.reservedWithdrawalBalance = Math.max(0, +(u.reservedWithdrawalBalance-amount).toFixed(6)); u.realBalance=+(u.realBalance+amount).toFixed(6); }
      u.updatedAt=admin.database.ServerValue.TIMESTAMP;
      return u;
    });
    await addTransaction(r.uid,{type:decision==='approved'?'withdraw_approved':'withdraw_rejected',amount:decision==='approved'?-amount:amount,status:decision});
  }
  const patch = { status: decision, decidedAt: now(), decidedBy: adminUid, reason: clean(req.data?.reason) };
  await Promise.all([ref.update(patch), db.ref(`user_finance/${r.uid}/${requestId}`).update(patch), addAudit({action:`FINANCE_${decision.toUpperCase()}`, requestId, adminUid})]);
  return { ok:true };
});

exports.adminCreateAgent = onCall({ region: 'us-central1' }, async (req) => {
  const adminUid = await assertAdmin(req);
  const name = clean(req.data?.name) || 'وكيل شحن';
  const loginId = clean(req.data?.loginId);
  const email = loginToEmail(loginId);
  const password = clean(req.data?.password);
  const balance = n(req.data?.balance);
  if (!email || !password || password.length < 6) throw new HttpsError('invalid-argument', 'اسم الدخول وكلمة السر مطلوبة، وكلمة السر 6 أحرف أو أكثر.');
  let userRecord;
  try { userRecord = await admin.auth().getUserByEmail(email); await admin.auth().updateUser(userRecord.uid, { password, displayName:name }); }
  catch (e) { userRecord = await admin.auth().createUser({ email, password, displayName:name, emailVerified:true }); }
  const uid = userRecord.uid;
  const agent = { uid, name, loginId, email, active:true, balance, totalCharged:0, createdAt:admin.database.ServerValue.TIMESTAMP, createdBy:adminUid, updatedAt:admin.database.ServerValue.TIMESTAMP };
  await Promise.all([
    db.ref(`agents/${uid}`).update(agent),
    db.ref(`users/${uid}`).update({ uid, name, email, role:'agent', isAgent:true, realBalance:0, bonusBalance:0, adnBalance:0, publicId:publicId(uid), updatedAt:admin.database.ServerValue.TIMESTAMP })
  ]);
  await addAudit({ action:'AGENT_CREATE', adminUid, agentUid:uid, balance });
  return { ok:true, uid, loginId, email, balance };
});

exports.adminAdjustAgentBalance = onCall({ region: 'us-central1' }, async (req) => {
  const adminUid = await assertAdmin(req);
  const agentUid = clean(req.data?.agentUid);
  const amount = n(req.data?.amount);
  if (!agentUid || amount === 0) throw new HttpsError('invalid-argument', 'حدد الوكيل والمبلغ.');
  const tx = await db.ref(`agents/${agentUid}`).transaction(a => { if(!a) return a; a.balance=+(n(a.balance)+amount).toFixed(6); a.updatedAt=admin.database.ServerValue.TIMESTAMP; return a; });
  if (!tx.committed) throw new HttpsError('not-found', 'الوكيل غير موجود.');
  await addAudit({ action:'AGENT_BALANCE_ADJUST', adminUid, agentUid, amount });
  return { ok:true, balance:n(tx.snapshot.val().balance) };
});

exports.adminSetAgentActive = onCall({ region: 'us-central1' }, async (req) => {
  const adminUid = await assertAdmin(req);
  const agentUid = clean(req.data?.agentUid);
  const active = req.data?.active === true;
  await db.ref(`agents/${agentUid}`).update({ active, updatedAt:admin.database.ServerValue.TIMESTAMP });
  await addAudit({ action:'AGENT_ACTIVE_SET', adminUid, agentUid, active });
  return { ok:true };
});

exports.agentRecharge = onCall({ region: 'us-central1' }, async (req) => {
  const { uid: agentUid } = await assertAgent(req);
  const targetUid = await findUserUid(req.data?.target);
  if (targetUid === agentUid) throw new HttpsError('failed-precondition', 'لا يمكن للوكيل شحن نفسه.');
  const amount = n(req.data?.amount);
  if (amount <= 0) throw new HttpsError('invalid-argument', 'مبلغ الشحن غير صحيح.');
  let error = '';
  const rootTx = await db.ref().transaction(root => {
    if (!root) { error='قاعدة البيانات غير جاهزة'; return; }
    root.agents = root.agents || {}; root.users = root.users || {};
    const a = root.agents[agentUid]; const u = root.users[targetUid];
    if (!a || !a.active) { error='الوكيل غير موجود أو موقوف.'; return; }
    if (!u) { error='المستخدم غير موجود.'; return; }
    a.balance = n(a.balance); a.totalCharged = n(a.totalCharged);
    if (a.balance < amount) { error='رصيد الوكيل لا يكفي.'; return; }
    a.balance = +(a.balance - amount).toFixed(6);
    a.totalCharged = +(a.totalCharged + amount).toFixed(6);
    a.updatedAt = admin.database.ServerValue.TIMESTAMP;
    u.realBalance = +(n(u.realBalance) + amount).toFixed(6);
    u.updatedAt = admin.database.ServerValue.TIMESTAMP;
    return root;
  });
  if (!rootTx.committed) throw new HttpsError('failed-precondition', error || 'تعذر تنفيذ شحن الوكيل.');
  const agent = (rootTx.snapshot.val().agents || {})[agentUid] || {};
  const target = (rootTx.snapshot.val().users || {})[targetUid] || {};
  const id = safePushKey('agent_recharges');
  const item = { id, agentUid, targetUid, targetName: target.name || target.email || targetUid, amount, note:clean(req.data?.note), status:'completed', createdAt:now() };
  await Promise.all([
    db.ref(`agent_recharges/${id}`).set(item),
    db.ref(`agent_recharges_by_agent/${agentUid}/${id}`).set(item),
    addTransaction(targetUid, { type:'agent_recharge', amount, agentUid, status:'completed' }),
    addAudit({ action:'AGENT_RECHARGE', agentUid, targetUid, amount })
  ]).catch(()=>null);
  return { ok:true, id, targetName:item.targetName, agentBalance:n(agent.balance), userBalance:n(target.realBalance) };
});

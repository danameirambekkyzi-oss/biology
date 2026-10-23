/*
 * Firebase арқылы жұмыс істейтін бұлттық режим (js/config.js → firebase толтырылғанда қосылады).
 *   - Firebase Authentication: email + құпия сөз (оқушы телефонмен де кіре алады)
 *   - Cloud Firestore: users/{uid} — профиль мен прогресс, phones/{нөмір} — нөмір → email,
 *                      leaderboard/{uid} — айлық рейтинг
 *   - «Бір аккаунт — бір құрылғы»: аккаунт алғаш кірген құрылғыға бекітіледі, оны тек мұғалім босатады.
 * Қауіпсіздік ережелері: firestore.rules
 */
const V = "10.12.2";
const base = `https://www.gstatic.com/firebasejs/${V}`;
const { initializeApp } = await import(`${base}/firebase-app.js`);
const A = await import(`${base}/firebase-auth.js`);
const F = await import(`${base}/firebase-firestore.js`);

const cfg = window.CONFIG.firebase;
const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId });
const auth = A.getAuth(app);
const fs = F.getFirestore(app);
if (cfg.emulator) {
  A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  F.connectFirestoreEmulator(fs, "127.0.0.1", 8080);
}

const DEVICE_KEY = "bioubt_device";
function deviceId() {
  let id = null;
  try { id = localStorage.getItem(DEVICE_KEY); } catch (e) { /* ignore */ }
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    try { localStorage.setItem(DEVICE_KEY, id); } catch (e) { /* ignore */ }
  }
  return id;
}
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Құрылғы";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Яндекс" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return (os + (br ? " · " + br : "")).trim();
}

const ERR = {
  "auth/invalid-credential": "Нөмір/email немесе құпия сөз қате.",
  "auth/wrong-password": "Құпия сөз қате.",
  "auth/user-not-found": "Мұндай аккаунт табылмады.",
  "auth/email-already-in-use": "Бұл email бұрын тіркелген.",
  "auth/invalid-email": "Email дұрыс емес.",
  "auth/weak-password": "Құпия сөз кемінде 6 таңба болуы керек.",
  "auth/too-many-requests": "Тым көп әрекет. Біраз уақыттан кейін қайталаңыз.",
  "auth/network-request-failed": "Интернет байланысын тексеріңіз.",
  "permission-denied": "Рұқсат жоқ."
};
const msg = e => ERR[e && e.code] || (e && e.userMessage) || "Қате шықты. Қайталап көріңіз.";
const fail = text => Object.assign(new Error(text), { userMessage: text });

const userRef = uid => F.doc(fs, "users", uid);
const strip = u => { const o = Object.assign({}, u); delete o.pass; return o; };
// Оқушы өзі өзгерте алмайтын өрістер (оларды тек мұғалім өзгертеді) — сақтағанда жіберілмейді
const progressOnly = u => {
  const o = strip(u); ["id", "role", "blocked", "deviceId", "device", "deviceAt", "premiumUntil", "premium"].forEach(k => delete o[k]);
  // Firestore бос кілтті қабылдамайды — сақтамас бұрын тазалау
  ["solved", "mistakes", "modulesTried", "activity"].forEach(k => { if (o[k]) { o[k] = Object.assign({}, o[k]); delete o[k][""]; } });
  return o;
};

// Кіргеннен кейін: бұғатталғанын және құрылғыны тексеру
async function openSession(fbUser) {
  const snap = await F.getDoc(userRef(fbUser.uid));
  if (!snap.exists()) { await A.signOut(auth); throw fail("Аккаунт деректері табылмады. Мұғаліммен байланысыңыз."); }
  const u = snap.data();
  if (u.blocked) { await A.signOut(auth); throw fail("Бұл аккаунт бұғатталған. Мұғаліммен байланысыңыз."); }
  if (u.role !== "teacher") {
    const mine = deviceId();
    if (!u.deviceId) {
      await F.updateDoc(userRef(fbUser.uid), { deviceId: mine, device: deviceLabel(), deviceAt: Date.now() });
      u.deviceId = mine; u.device = deviceLabel();
    } else if (u.deviceId !== mine) {
      await A.signOut(auth);
      throw fail("Бұл аккаунт басқа құрылғыда ашылған. Бір аккаунтқа тек бір құрылғыдан кіруге болады. Құрылғыны ауыстыру үшін мұғаліммен байланысыңыз.");
    }
  }
  F.updateDoc(userRef(fbUser.uid), { lastSeen: Date.now() }).catch(() => {});
  return Object.assign(u, { id: fbUser.uid });
}

let saveTimer = null, pending = null;
async function flush() {
  if (!pending) return;
  const u = pending; pending = null;
  await F.setDoc(userRef(u.id), progressOnly(u), { merge: true });
  const mk = monthKey();
  const pts = (u.history || []).filter(h => monthKey(h.date) === mk).reduce((a, h) => a + h.score, 0);
  const mocks = (u.history || []).filter(h => h.mode === "mock" && monthKey(h.date) === mk);
  await F.setDoc(F.doc(fs, "leaderboard", u.id), {
    name: u.name || "", month: mk, pts, best: mocks.length ? (b => `${b.score}/${b.max}`)(mocks.reduce((a, h) => h.score / (h.max || 1) > a.score / (a.max || 1) ? h : a)) : null, role: u.role || "student"
  });
}
function monthKey(t) { const d = t ? new Date(t) : new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
window.addEventListener("pagehide", () => { if (pending) flush(); });

window.Cloud = {
  deviceLabel,
  errorText: msg,

  // Қосымша жүктелгенде: бұрын кірген сессияны қалпына келтіру
  restore() {
    return new Promise(resolve => {
      const off = A.onAuthStateChanged(auth, async fbUser => {
        off();
        if (!fbUser) return resolve({ user: null });
        try { resolve({ user: await openSession(fbUser) }); } catch (e) { resolve({ user: null, error: msg(e) }); }
      });
    });
  },

  async login(identifier, password, remember, phoneDigits) {
    try {
      await A.setPersistence(auth, remember ? A.browserLocalPersistence : A.browserSessionPersistence);
      let email = identifier.trim();
      if (phoneDigits) {
        const p = await F.getDoc(F.doc(fs, "phones", phoneDigits));
        if (!p.exists()) throw fail("Бұл нөмір тіркелмеген. Алдымен тіркеліңіз.");
        email = p.data().email;
      }
      const cred = await A.signInWithEmailAndPassword(auth, email, password);
      return await openSession(cred.user);
    } catch (e) { throw fail(msg(e)); }
  },

  async register(data, password, phoneDigits) {
    try {
      const existing = await F.getDoc(F.doc(fs, "phones", phoneDigits));
      if (existing.exists()) throw fail("Бұл нөмір бұрын тіркелген. «Кіру» бөліміне өтіңіз.");
      await A.setPersistence(auth, A.browserLocalPersistence);
      const cred = await A.createUserWithEmailAndPassword(auth, data.email, password);
      const uid = cred.user.uid;
      const u = Object.assign({}, data, { id: uid, role: "student", blocked: false, deviceId: deviceId(), device: deviceLabel(), deviceAt: Date.now(), lastSeen: Date.now() });
      const first = strip(u); delete first.id;
      await F.setDoc(userRef(uid), first);
      await F.setDoc(F.doc(fs, "phones", phoneDigits), { email: data.email, uid });
      pending = u; await flush();
      return u;
    } catch (e) { throw fail(msg(e)); }
  },

  save(u) { pending = u; clearTimeout(saveTimer); saveTimer = setTimeout(() => flush().catch(e => console.warn("save", e)), 600); },

  async logout() { if (pending) await flush().catch(() => {}); await A.signOut(auth); },

  async resetPassword(identifier, phoneDigits) {
    try {
      let email = identifier.trim();
      if (phoneDigits) {
        const p = await F.getDoc(F.doc(fs, "phones", phoneDigits));
        if (!p.exists()) throw fail("Бұл нөмір тіркелмеген.");
        email = p.data().email;
      }
      await A.sendPasswordResetEmail(auth, email);
      return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
    } catch (e) { throw fail(msg(e)); }
  },

  async changePassword(oldPass, newPass) {
    try {
      const user = auth.currentUser;
      await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, oldPass));
      await A.updatePassword(user, newPass);
    } catch (e) { throw fail(msg(e)); }
  },

  async leaderboard() {
    const snap = await F.getDocs(F.query(F.collection(fs, "leaderboard"), F.where("month", "==", monthKey())));
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(r => r.role !== "teacher");
  },

  // Ашық сессияны тексеру: бұғатталса немесе құрылғы ауысса — шығарып жібереді
  async verify() {
    const fbUser = auth.currentUser;
    if (!fbUser) throw fail("Сессия аяқталды. Қайта кіріңіз.");
    const snap = await F.getDoc(userRef(fbUser.uid));
    const u = snap.exists() ? snap.data() : null;
    const bad = !u ? "Аккаунт табылмады." : u.blocked ? "Бұл аккаунт бұғатталған. Мұғаліммен байланысыңыз." :
      (u.role !== "teacher" && u.deviceId && u.deviceId !== deviceId()) ? "Бұл аккаунт басқа құрылғыда ашылды. Құрылғыны ауыстыру үшін мұғаліммен байланысыңыз." : "";
    if (bad) { pending = null; await A.signOut(auth); throw fail(bad); }
    return u;
  },

  // ---- Мұғалім ----
  async students() {
    const snap = await F.getDocs(F.collection(fs, "users"));
    return snap.docs.map(d => Object.assign({}, d.data(), { id: d.id })).filter(u => u.role !== "teacher");
  },
  // Мұғалім кабинетінен: оқушының email-іне құпия сөзді жаңарту сілтемесін жіберу
  async sendReset(email) { try { await A.sendPasswordResetEmail(auth, email); } catch (e) { throw fail(msg(e)); } },
  async resetDevice(uid) { await F.updateDoc(userRef(uid), { deviceId: "", device: "", deviceAt: null }); },
  async setBlocked(uid, blocked) { await F.updateDoc(userRef(uid), { blocked }); },
  async setPremium(uid, until) { await F.updateDoc(userRef(uid), { premiumUntil: until || 0, premiumSetAt: Date.now() }); }
};

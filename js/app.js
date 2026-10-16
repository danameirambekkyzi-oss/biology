/* BioҰБТ — бір беттік қосымша (SPA). Деректер браузердің localStorage-інде сақталады. */
(function () {
  "use strict";

  // Сұрақтар: жалпы қор + сынама папкаларындағы тесттер (js/tests/*.js)
  const FOLDERS = window.TEST_FOLDERS || [];
  const TESTS = [].concat(...FOLDERS.map(f => f.tests.map(t => Object.assign({ folder: f }, t))));
  const Q = window.QUESTIONS.concat(...TESTS.map(t => t.questions));
  const MODULES = window.MODULES;
  const QBY = Object.fromEntries(Q.map(q => [q.id, q]));
  const CFG = window.CONFIG, SITE = CFG.siteName, AUTHOR = CFG.author || {};
  const MOCK_SIZE = CFG.test.mockSize, MOCK_OPTS = CFG.test.mockMinuteOptions, EXPRESS_SIZE = CFG.test.expressSize;
  const PREMIUM = !!CFG.premium.enabled, PLANS = CFG.premium.plans || [];
  const UBT_END = new Date(CFG.premium.ubtEnd + "T23:59:59").getTime();
  const hasPremium = u => !PREMIUM || u.role === "teacher" || (u.premiumUntil || 0) > Date.now();
  const planUntil = (pl, from) => pl.untilUbt ? UBT_END : Math.max(from || 0, Date.now()) + pl.days * 864e5;
  const fmtPrice = n => n.toLocaleString("ru-RU").replace(/,/g, " ") + " ₸";
  const CLOUD = !!(CFG.firebase && CFG.firebase.apiKey && CFG.firebase.enabled !== false); // Firebase қосылған ба
  const GRADS = ["linear-gradient(135deg,#7C3AED,#EC4899)", "linear-gradient(135deg,#3B82F6,#22D3EE)", "linear-gradient(135deg,#EC4899,#F59E0B)", "linear-gradient(135deg,#10B981,#3B82F6)"];
  const DB_KEY = "bioubt_db_v1", SESSION_KEY = "bioubt_session", THEME_KEY = "bioubt_theme", DEMO_KEY = "bioubt_demo";
  const LETTERS = "ABCDEFGH";
  const DAYS = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сн"];
  const MONTH_NAMES = ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"];
  const fmtDate = t => { const d = new Date(t); return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear(); };
  const MONTHS = CFG.months;
  const CHEERS = ["Бүгін де бір қадам алға!", "50/50 — жақын арада!", "Әр қате — жаңа білім", "Сен міндетті түрде жетесің!", "Бүгінгі мақсат: 1 тест"];

  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  /* ================= Storage ================= */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  let db = store.get(DB_KEY, { users: {} });
  const saveDb = () => store.set(DB_KEY, db);

  function getSessionId() {
    try { return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY); } catch (e) { return memSession; }
  }
  let memSession = null;
  function setSession(id, remember) {
    memSession = id;
    try {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id);
    } catch (e) { /* ignore */ }
  }
  let cloudUser = null;
  function currentUser() {
    if (CLOUD) return cloudUser;
    const id = getSessionId() || memSession; return id && db.users[id] ? db.users[id] : null;
  }
  function saveUser(u) { if (CLOUD) return window.Cloud.save(u); db.users[u.id] = u; saveDb(); }
  function fillUser(u) { return Object.assign(newUser(u.id, {}), u); }

  function newUser(id, data) {
    return Object.assign({
      id, name: "", phone: "", email: "", pass: "", target: 45, city: "", school: "", month: MONTHS[2],
      xp: 0, premiumUntil: 0, mocks: 0, history: [], solved: {}, mistakes: {}, fixed: 0, activity: {},
      modulesTried: {}, badges: [], notifications: [], created: Date.now()
    }, data);
  }

  // Демо-хэш: нақты жобада құпия сөзді серверде bcrypt/argon2 арқылы сақтау керек.
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h.toString(36); }

  /* ================= Helpers ================= */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const fmtNum = n => n.toLocaleString("en-US");
  const firstName = u => esc((u.name || "Түлек").trim().split(/\s+/)[0]);
  const initials = name => (name || "Т").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const isMulti = q => q.type === "multi" || (q.type !== "match" && q.correct.length > 1);
  const hasAnswer = (q, a) => q.type === "match" ? (a || []).some(x => x != null && x >= 0) : (a || []).length > 0;
  const modTitle = id => (MODULES.find(m => m.id === id) || {}).title || id;

  /* ================= Icons (SVG) ================= */
  const ICONS = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.3 1.6 1.4 2.7 2.5 2.7z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    seed: '<path d="M7 20h10M12 20v-8"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-3 2.5-5 6-5 0 3-2.5 5-6 5z"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M2 2l20 20"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    camera: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    dna: '<path d="M4 2c0 6 16 6 16 12M20 2c0 6-16 6-16 12M4 22c0-3 4-5 8-6.5M20 22c0-3-4-5-8-6.5"/><path d="M7 5h10M7 11h10M8 19h8"/>'
  };
  function ic(name, size = 20) {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }
  const LOGO = `<img class="logo-mark" src="img/brand/icon-96.png" alt="" width="36" height="36">`;

  function toast(msg, cls = "") {
    const t = document.createElement("div");
    t.className = "toast " + cls; t.textContent = msg;
    toastRoot.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function openModal(html, onMount) {
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const bg = $(".modal-bg", modalRoot);
    const close = () => { modalRoot.innerHTML = ""; };
    bg.addEventListener("click", e => { if (e.target === bg || e.target.closest("[data-close]")) close(); });
    if (onMount) onMount($(".modal", modalRoot), close);
    return close;
  }
  function confirmModal(title, text, okText, onOk) {
    openModal(`<h3>${title}</h3><p class="muted">${text}</p>
      <div class="btn-row"><button class="btn btn-ghost" data-close>Бас тарту</button><button class="btn btn-primary" id="m-ok">${okText}</button></div>`,
      (m, close) => { $("#m-ok", m).onclick = () => { close(); onOk(); }; });
  }

  /* ---- Phone mask: +7 (7XX) XXX-XX-XX ---- */
  // Елдік код (+7 / 8) алынып тасталған 10 таңбалы жергілікті нөмір
  function localDigits(v) {
    const s = String(v).trim();
    let d = s.replace(/\D/g, "");
    if (s.startsWith("+")) d = d.slice(1);
    else if (d.length === 11 && (d[0] === "7" || d[0] === "8")) d = d.slice(1);
    else if (d[0] === "8") d = d.slice(1);
    return d.slice(0, 10);
  }
  function fmtLocal(d) {
    let out = "+7 (" + d.slice(0, 3);
    if (d.length >= 3) out += ") " + d.slice(3, 6);
    if (d.length >= 6) out += "-" + d.slice(6, 8);
    if (d.length >= 8) out += "-" + d.slice(8, 10);
    return out;
  }
  const formatPhone = v => fmtLocal(localDigits(v));
  const phoneDigits = v => "7" + localDigits(v);
  const validPhone = v => { const d = localDigits(v); return d.length === 10 && d[0] === "7"; };
  const looksLikeEmail = v => /[a-zA-Z@]/.test(v);
  function bindPhoneMask(input, allowEmail) {
    let prev = localDigits(input.value);
    input.addEventListener("input", e => {
      if (allowEmail && looksLikeEmail(input.value)) { prev = ""; return; }
      const del = e.inputType && e.inputType.startsWith("delete");
      let d = localDigits(input.value);
      // Бөлгіш таңба (жақша, сызықша) өшірілсе — соңғы цифрды өшіреміз
      if (del && d === prev) d = d.slice(0, -1);
      prev = d;
      const raw = input.value.trim();
      if (d) input.value = fmtLocal(d);
      else input.value = del || !raw ? "" : raw === "+" ? "+" : fmtLocal("");
    });
  }

  function passStrength(p) {
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-ZА-ЯӘҒҚҢӨҰҮҺІ]/.test(p) && /[a-zа-яәғқңөұүһі]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^\wа-яА-ЯәғқңөұүһіӘҒҚҢӨҰҮҺІ]/.test(p)) s++;
    if (!p) return { pct: 0, color: "transparent", label: "" };
    if (s <= 2) return { pct: 33, color: "var(--red)", label: "Әлсіз" };
    if (s <= 3) return { pct: 66, color: "var(--amber)", label: "Орташа" };
    return { pct: 100, color: "var(--green)", label: "Күшті" };
  }

  /* ================= Scoring ================= */
  /*
   * Балл жүйесі (бірнеше жауапты сұрақтар үшін бір ереже):
   *   Қате белгілеу жоқ:  барлық дұрыс жауап — 2 балл; біреуі жетіспесе — 1 балл; одан аз — 0.
   *   1 қате белгіленсе:  барлық дұрыс жауап немесе біреуі ғана жетіспесе — 1 балл; одан аз — 0.
   *   2 және одан көп қате — 0. 4 және одан көп нұсқа белгіленсе — қалай болса да 0.
   *   Мысалы, 3 дұрыс: 3 → 2; 2 → 1; 2+1 қате → 1; 1 → 0; 4 нұсқа (3+1 қате) → 0.
   *            2 дұрыс: 2 → 2; 1 → 1; 2+1 қате → 1; 1+1 қате → 1.
   *            1 дұрыс: 1 → 2; 1+1 қате → 1.
   *   Бір жауапты және контекстік сұрақ: дұрыс жауап — 1 балл, әйтпесе 0.
   *   Сәйкестендіру: әр дұрыс сәйкестік — 1 балл.
   */
  function scorePoints(q, sel) {
    if (q.type === "match") return q.items.reduce((a, it, k) => a + (sel[k] === it.answer ? 1 : 0), 0);
    const k = q.correct.length, c = sel.filter(i => q.correct.includes(i)).length, w = sel.length - c;
    if (!sel.length) return 0;
    if (q.type !== "multi" && k === 1) return c === 1 && w === 0 ? 1 : 0;
    if (sel.length > Math.min(k + 1, 3)) return 0; // 4 және одан көп нұсқа белгіленсе — бірден 0 (2 дұрыс: 3-тен, 1 дұрыс: 2-ден көп)
    const need = Math.max(k - 1, 1); // «бір жетіспейді» шегі
    if (w === 0) return c === k ? 2 : c >= need && k > 1 ? 1 : 0;
    if (w === 1) return c >= need ? 1 : 0;
    return 0;
  }
  const maxPoints = q => q.type === "match" ? q.items.length : (q.type === "multi" || q.correct.length > 1) ? 2 : 1;
  const ptsCls = (q, p) => p === maxPoints(q) ? 2 : p > 0 ? 1 : 0; // 2 — толық, 1 — жартылай, 0 — қате

  function grade(test) {
    const per = test.questions.map((q, i) => scorePoints(q, test.answers[i] || []));
    const score = per.reduce((a, b) => a + b, 0), max = test.questions.reduce((a, q) => a + maxPoints(q), 0);
    return {
      per, score, max,
      full: per.filter((p, i) => p === maxPoints(test.questions[i])).length,
      part: per.filter((p, i) => p > 0 && p < maxPoints(test.questions[i])).length,
      zero: per.filter(p => p === 0).length,
      pct: max ? Math.round(score / max * 100) : 0,
      scaled: max ? Math.round(score / max * 50) : 0
    };
  }

  /* ================= Stats ================= */
  function streak(u) {
    let n = 0; const d = new Date();
    if (!u.activity[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (u.activity[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const progressPct = u => Q.length ? Math.round(Object.keys(u.solved).filter(id => QBY[id]).length / Q.length * 100) : 0;
  function avgScore(u) {
    const h = u.history.slice(-10);
    return h.length ? Math.round(h.reduce((a, r) => a + r.scaled, 0) / h.length) : 0;
  }
  function moduleProgress(u, id) {
    const qs = Q.filter(q => q.module === id);
    return { total: qs.length, solved: qs.filter(q => u.solved[q.id]).length, mistakes: qs.filter(q => u.mistakes[q.id]).length };
  }
  const thisMonth = h => { const d = new Date(h.date), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); };
  const monthPoints = u => u.history.filter(thisMonth).reduce((a, h) => a + h.score, 0);
  function bestMock(u) { // айдағы ең жақсы сынама — тесттің өз балымен («38/45»)
    const m = u.history.filter(h => h.mode === "mock" && thisMonth(h) && h.max);
    if (!m.length) return null;
    const b = m.reduce((a, h) => h.score / h.max > a.score / a.max ? h : a); return `${b.score}/${b.max}`;
  }
  const fmtBest = b => b == null ? null : typeof b === "number" ? `${b}/50` : b; // ескі жазбалар сан түрінде (50-ге келтірілген)
  function leaderboard(u) {
    // Тек нақты тіркелген қолданушылар (осы құрылғыда)
    const rows = CLOUD
      ? ((state.lb && state.lb.rows) || []).filter(r => r.id !== u.id).map(r => ({ name: shortName(r.name), pts: r.pts || 0, best: r.best, me: false }))
          .concat(u.role === "teacher" ? [] : [{ name: shortName(u.name), pts: monthPoints(u), best: bestMock(u), me: true }])
      : Object.values(db.users).map(x => ({ name: shortName(x.name), pts: monthPoints(x), best: bestMock(x), me: x.id === u.id }));
    rows.sort((a, b) => b.pts - a.pts || (a.me ? 1 : -1));
    rows.forEach((r, i) => r.rank = i + 1);
    return rows;
  }
  function shortName(n) { const w = (n || "Түлек").trim().split(/\s+/); return w[0] + (w[1] ? " " + w[1][0] + "." : ""); }
  const myRank = u => { const r = leaderboard(u).find(x => x.me); return r ? r.rank : "—"; };
  const mistakesCount = u => Object.keys(u.mistakes).length;

  function notify(u, icon, text) {
    u.notifications.unshift({ icon, text, time: Date.now(), read: false });
    u.notifications = u.notifications.slice(0, 30);
  }

  function checkBadges(u, res, test) {
    const earned = [];
    const give = id => { if (!u.badges.includes(id)) { u.badges.push(id); earned.push(id); } };
    if (u.history.length >= 1) give("first");
    if (streak(u) >= 3) give("streak3");
    if (streak(u) >= 7) give("streak7");
    if (res && res.score === res.max && res.max > 0) give("perfect");
    if (test && test.mode === "mock") give("mock");
    if (u.xp >= 500) give("pts500");
    if (u.fixed >= 5) give("fixer");
    if (MODULES.every(m => u.modulesTried[m.id])) give("explorer");
    earned.forEach(id => {
      const b = window.BADGES.find(x => x.id === id);
      notify(u, "star", `Жаңа жетістік белгісі: «${b.title}»!`);
      setTimeout(() => toast(`Жаңа белгі: ${b.title}`, "xp"), 600);
    });
  }

  function applyResult(u, test, res) {
    const rankBefore = myRank(u);
    const xp = res.score; // жинаған балл
    u.xp += xp;
    const today = dayKey();
    u.activity[today] = (u.activity[today] || 0) + 1;
    test.questions.forEach((q, i) => {
      if (q.module) u.modulesTried[q.module] = true;
      if (res.per[i] === maxPoints(q)) {
        u.solved[q.id] = true;
        if (u.mistakes[q.id]) { delete u.mistakes[q.id]; u.fixed++; }
      } else {
        u.mistakes[q.id] = true;
      }
    });
    if (test.mode === "mock") u.mocks++;
    const wrong = test.questions.filter((q, i) => res.per[i] < maxPoints(q)).map(q => q.id);
    u.history.push({ date: Date.now(), mode: test.mode, testId: test.testId || null, title: test.title, score: res.score, max: res.max, scaled: res.scaled, pct: res.pct, wrong });
    u.history = u.history.slice(-200);
    checkBadges(u, res, test);
    const rankAfter = myRank(u);
    if (typeof rankAfter === "number" && rankAfter < rankBefore) notify(u, "trophy", `Сіздің рейтингіңіз көтерілді! Енді ${rankAfter}-орындасыз.`);
    saveUser(u);
    return xp;
  }

  /* ================= Router ================= */
  let state = { mockMin: CFG.test.mockMinutesDefault, test: null, result: null, timer: null, notifOpen: false, reg: null, authTab: "login" };

  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  window.addEventListener("hashchange", render);

  function render() {
    const path = (location.hash || "#/").slice(1) || "/";
    const parts = path.split("/").filter(Boolean);
    const u = currentUser();
    modalRoot.innerHTML = "";
    state.notifOpen = false;
    if (parts[0] !== "test") stopTimer();
    window.scrollTo(0, 0);

    if (!parts.length) return renderLanding(u);
    switch (parts[0]) {
      case "login": state.authTab = "login"; return u ? go("#/app") : renderAuth();
      case "register": state.authTab = "register"; return u ? go("#/app") : renderAuth();
      case "test": return state.test ? renderTest() : go(u ? "#/app" : "#/");
      case "result": return state.result ? renderResult() : go(u ? "#/app" : "#/");
      case "app": return u ? renderApp(u, parts[1] || "dashboard", parts[2]) : go("#/login");
      default: return go("#/");
    }
  }

  /* ================= Landing ================= */
  function renderLanding(u) {
    const feats = [
      { ico: "target", cls: "f1", t: "ҰБТ жаңа форматына 100% сәйкес", d: "Контекстік сұрақтар, бір және бірнеше дұрыс жауабы бар тапсырмалар — нақты ҰБТ сияқты, сол балл жүйесімен." },
      { ico: "bulb", cls: "f2", t: "Әр сұрақтың дұрыс жауабы", d: "Тест соңында әр сұрақтың дұрыс жауабын көресің. Нағыз ҰБТ-да келген сұрақтарды жаттап отырасың." },
      { ico: "chart", cls: "f3", t: "Статистика мен қатемен жұмыс", d: "Әлсіз тарауларыңды көрсетеміз, қате жауаптарыңнан жеке тест құрып, қайта тапсыруға мүмкіндік береміз." }
    ];
    const results = CFG.results || [];
    app.innerHTML = `
      <header class="topbar"><div class="container">
        <a class="logo" href="#/">${LOGO}${esc(SITE)}</a>
        <div class="topbar-actions">
          ${u ? `<a class="btn btn-primary" href="#/app">Кабинетке өту</a>` :
            `<a class="btn btn-outline" href="#/login">Кіру</a><a class="btn btn-primary" href="#/register">Тіркелу</a>`}
        </div>
      </div></header>

      <section class="hero"><div class="container hero-grid">
        <div>
          ${CFG.hero.pill ? `<span class="pill">${esc(CFG.hero.pill)}</span>` : ""}
          <h1>${CFG.hero.title}</h1>
          <p class="lead">${esc(CFG.hero.lead)}</p>
          <div class="hero-cta">
            <a class="btn btn-cta btn-lg" href="${u ? "#/app" : "#/register"}">${u ? "Кабинетке өту" : "Тіркеліп, дайындықты бастау"} ${ic("arrow", 18)}</a>
            <button class="btn btn-ghost btn-lg" data-act="scroll-to" data-id="calc">Балл калькуляторы</button>
          </div>
          <div class="hero-stats">
            ${(CFG.hero.stats || []).map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-card">
            <div class="q-meta"><span class="tag t-single">Бір дұрыс жауап</span><span class="tag">Ботаника</span></div>
            <div class="q-mini">Саңырауқұлақтың қоректік қор заты:</div>
            <div class="opt-mini ok"><span class="om-letter">A</span>Гликоген<span class="om-check">${ic("check", 16)}</span></div>
            <div class="opt-mini"><span class="om-letter">B</span>Хитин</div>
            <div class="opt-mini"><span class="om-letter">C</span>Муреин</div>
            <div class="opt-mini"><span class="om-letter">D</span>Целлюлоза</div>
          </div>
          <div class="float-badge fb2"><span class="fb-dot"></span>1 балл</div>
        </div>
      </div></section>

      <section class="section"><div class="container">
        <div class="section-head"><h2>Неге дәл <span class="grad-text">${esc(SITE)}</span>?</h2><p class="muted">Тек жаттау емес — түсініп, нәтижеге жету.</p></div>
        <div class="features">${feats.map(f => `
          <div class="feature"><div class="ico ${f.cls}">${ic(f.ico, 24)}</div><h3>${f.t}</h3><p>${f.d}</p></div>`).join("")}
        </div>
      </div></section>

      ${calcHtml()}

      ${results.length ? `
      <section class="section" id="results" style="padding-top:0"><div class="container">
        <div class="section-head"><h2>Оқушыларымның ҰБТ нәтижелері</h2><p class="muted">Нақты ҰБТ сертификаттарындағы баллдар</p></div>
        <div class="certs">${results.map(r => certHtml(r)).join("")}</div>
      </div></section>` : ""}

      <section class="section" style="padding-top:0">
        <div class="cta-band container">
          <h2>Келесі 50/50 — сенікі болсын!</h2>
          <p style="opacity:.9;margin:0 0 20px">Тіркел, тараулық тесттер мен толық ҰБТ сынамасын тапсыр, қатемен жұмыс жаса.</p>
          <a class="btn btn-cta btn-lg" href="${u ? "#/app" : "#/register"}">${u ? "Кабинетке өту" : "Тегін тіркелу"}</a>
        </div>
      </section>
      ${contactsHtml() ? `<section class="section" style="padding-top:0"><div class="container"><div class="card" style="text-align:center">
        <h3>${AUTHOR.name ? esc(AUTHOR.name) : "Байланыс"}</h3><p class="muted">Сұрағың бар ма? Жаз!</p>${contactsHtml()}</div></div></section>` : ""}
      <footer class="footer">© ${new Date().getFullYear()} ${esc(SITE)} · Биологиядан ҰБТ-ға дайындық${AUTHOR.name ? " · " + esc(AUTHOR.name) : ""}</footer>`;
    $$(".calc input").forEach(i => i.addEventListener("input", updateCalc));
    updateCalc();
  }

  /* ---- ҰБТ балл калькуляторы ---- */
  const CALC = CFG.calculator;
  const CALC_MAX = CALC.single.count * CALC.single.points + CALC.context.count * CALC.context.points + CALC.match.count * CALC.match.points + CALC.multi.count * CALC.multi.points;
  function calcRow(id, label, hint, max) {
    return `<div class="calc-row"><div><b>${label}</b><small class="muted">${hint}</small></div>
      <div class="stepper"><button type="button" data-act="calc-step" data-for="${id}" data-d="-1" aria-label="Азайту">−</button>
        <input id="${id}" type="number" inputmode="numeric" min="0" max="${max}" value="0" aria-label="${esc(label)}">
        <button type="button" data-act="calc-step" data-for="${id}" data-d="1" aria-label="Көбейту">+</button></div></div>`;
  }
  function calcHtml() {
    return `<section class="section" id="calc" style="padding-top:0"><div class="container">
      <div class="section-head"><h2>ҰБТ балл калькуляторы</h2><p class="muted">Неше сұраққа дұрыс жауап берсең, қанша балл аласың? Есептеп көр.</p></div>
      <div class="card calc">
        <div class="calc-inputs">
          ${calcRow("c-single", CALC.single.label, `${CALC.single.count} тапсырма · әрқайсысы ${CALC.single.points} балл`, CALC.single.count)}
          ${calcRow("c-context", CALC.context.label, `${CALC.context.count} тапсырма · әрқайсысы ${CALC.context.points} балл`, CALC.context.count)}
          ${calcRow("c-match", CALC.match.label, `${CALC.match.count} тапсырма · әр дұрыс сәйкестік — 1 балл (барлығы ${CALC.match.count * CALC.match.points} сәйкестік)`, CALC.match.count * CALC.match.points)}
          ${calcRow("c-full", CALC.multi.label + " — толық дұрыс", `${CALC.multi.count} тапсырма · толық дұрыс — 2 балл`, CALC.multi.count)}
          ${calcRow("c-part", CALC.multi.label + " — жартылай дұрыс", "Бір қатесі бар (бір дұрыс жауап белгіленбеген) — 1 балл", CALC.multi.count)}
        </div>
        <div class="calc-out">
          <div class="calc-score"><b id="c-total">0</b><span>/ ${CALC_MAX}</span></div>
          <div class="bar"><i id="c-bar" style="width:0%"></i></div>
          <p id="c-msg" class="calc-msg">Сандарды енгіз</p>
          <a class="btn btn-cta btn-block" href="#/register">Нәтижеңді арттыр — тіркел</a>
        </div>
      </div></div></section>`;
  }
  function updateCalc() {
    const get = (id, max) => { const el = document.getElementById(id); if (!el) return 0; let v = Math.max(0, Math.min(max, Math.floor(+el.value || 0))); el.value = v; return v; };
    const single = get("c-single", CALC.single.count), context = get("c-context", CALC.context.count), match = get("c-match", CALC.match.count * CALC.match.points);
    const full = get("c-full", CALC.multi.count), part = get("c-part", CALC.multi.count - full);
    const total = single * CALC.single.points + context * CALC.context.points + match + full * CALC.multi.points + part;
    const out = document.getElementById("c-total"); if (!out) return;
    out.textContent = total;
    document.getElementById("c-bar").style.width = (total / CALC_MAX * 100) + "%";
    document.getElementById("c-msg").textContent = !total ? "Сандарды енгіз" : total >= 45 ? "Керемет нәтиже! Грантқа жақынсың." :
      total >= 35 ? "Жақсы! Тағы аздап жұмыс — және жоғары балл сенікі." : total >= 20 ? "Орташа деңгей. Әлсіз тарауларыңмен жұмыс жаса." : "Бастама жасалды. Тараулық тесттерден баста.";
  }

  // ҰБТ сертификаты түріндегі нәтиже карточкасы
  function certHtml(r, compact) {
    const hl = (r.subjects || []).find(x => x[0] === r.highlight);
    return `<div class="cert ${compact ? "cert-compact" : ""}">
      ${hl ? `<div class="cert-badge"><b>${esc(hl[1])}</b><span>${esc(hl[0])}</span></div>` : ""}
      <div class="cert-name">${esc(r.name)}</div>
      <div class="cert-meta"><span>ҰБТ тапсырған мерзімі: <b>${esc(r.date)}</b></span><span>Тапсыру тілі: <b>${esc(r.lang || "қазақша")}</b></span></div>
      <table class="cert-table"><thead><tr><th>№</th><th>Пән атауы</th><th>Балл</th></tr></thead><tbody>
        ${(r.subjects || []).map((x, i) => `<tr class="${x[0] === r.highlight ? "hl" : ""}"><td>${i + 1}</td><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}
      </tbody><tfoot><tr><td></td><td>Барлығы</td><td>${esc(r.total)}</td></tr></tfoot></table>
      <div class="cert-foot">мүмкін болған 140 балдан</div>
    </div>`;
  }

  function contactsHtml() {
    const links = [];
    if (AUTHOR.whatsapp) links.push(`<a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/${esc(AUTHOR.whatsapp.replace(/\D/g, ""))}">${ic("chat", 18)} WhatsApp</a>`);
    if (AUTHOR.telegram) links.push(`<a class="btn btn-tg" style="width:auto" target="_blank" rel="noopener" href="https://t.me/${esc(AUTHOR.telegram.replace(/^@/, ""))}">${ic("send", 18)} Telegram</a>`);
    if (AUTHOR.instagram) links.push(`<a class="btn btn-cta" target="_blank" rel="noopener" href="https://instagram.com/${esc(AUTHOR.instagram.replace(/^@/, ""))}">${ic("camera", 18)} Instagram</a>`);
    return links.length ? `<div class="hero-cta" style="justify-content:center">${links.join("")}</div>` : "";
  }

  /* ================= Auth ================= */
  function renderAuth() {
    const isLogin = state.authTab === "login";
    app.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <a class="auth-logo" href="#/"><img src="img/brand/logo.png" alt="${esc(SITE)}"></a>
        <div class="tabs" role="tablist">
          <button class="tab ${isLogin ? "active" : ""}" data-act="tab-login">Кіру</button>
          <button class="tab ${!isLogin ? "active" : ""}" data-act="tab-register">Тіркелу</button>
        </div>

        <div id="auth-body"></div>
      </div></div>`;
    if (isLogin) renderLoginForm(); else renderRegister();
  }

  function renderLoginForm() {
    const body = $("#auth-body");
    body.innerHTML = `
      <form id="login-form" novalidate>
        <div class="field"><label for="l-id">Телефон нөмірі немесе Email</label>
          <input class="input" id="l-id" inputmode="tel" autocomplete="username" placeholder="+7 (7XX) XXX-XX-XX"></div>
        <div class="field"><label for="l-pass">Құпия сөз</label>
          <div class="input-wrap"><input class="input" id="l-pass" type="password" autocomplete="current-password" placeholder="••••••••">
          <button type="button" class="eye" data-act="eye" aria-label="Құпия сөзді көрсету">${ic("eye", 20)}</button></div></div>
        <div class="row-between">
          <label class="check"><input type="checkbox" id="l-rem" checked> Мені есте сақта</label>
          <button type="button" class="link-btn" data-act="forgot">Құпия сөзді ұмыттыңыз ба?</button>
        </div>
        <div class="err hidden" id="l-err"></div>
        <button class="btn btn-green btn-lg btn-block" type="submit">Жүйеге кіру</button>
        <p class="hint" style="text-align:center">Аккаунтың жоқ па? <button type="button" class="link-btn" data-act="tab-register">Тіркел</button></p>
      </form>`;
    const id = $("#l-id");
    bindPhoneMask(id, true);
    id.addEventListener("input", () => { id.inputMode = looksLikeEmail(id.value) ? "email" : "tel"; });
    $("#login-form").addEventListener("submit", e => {
      e.preventDefault();
      const v = id.value.trim(), p = $("#l-pass").value, err = $("#l-err");
      if (CLOUD) {
        if (!looksLikeEmail(v) && !validPhone(v)) { showErr(err, "Телефон нөмірін +7 (7XX) XXX-XX-XX форматында немесе email енгізіңіз."); return; }
        const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Тексерілуде…";
        window.Cloud.login(v, p, $("#l-rem").checked, looksLikeEmail(v) ? null : phoneDigits(v))
          .then(u => { cloudUser = fillUser(u); toast(`Қош келдің, ${(u.name || "").split(" ")[0]}!`); afterLogin(cloudUser); })
          .catch(ex => { showErr(err, ex.message); btn.disabled = false; btn.textContent = "Жүйеге кіру"; });
        return;
      }
      let user = null;
      if (looksLikeEmail(v)) user = Object.values(db.users).find(x => x.email && x.email.toLowerCase() === v.toLowerCase());
      else if (validPhone(v)) user = db.users[phoneDigits(v)];
      else { showErr(err, "Телефон нөмірін +7 (7XX) XXX-XX-XX форматында енгізіңіз."); id.classList.add("invalid"); return; }
      if (!user) { showErr(err, "Мұндай аккаунт табылмады. Алдымен тіркеліңіз."); return; }
            if (user.pass !== hash(p)) { showErr(err, "Құпия сөз қате."); $("#l-pass").classList.add("invalid"); return; }
      setSession(user.id, $("#l-rem").checked);
      toast(`Қош келдің, ${user.name.split(" ")[0]}!`);
      afterLogin(user);
    });
  }
  function showErr(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }

  function afterLogin(user) {
    const demo = (() => { try { return JSON.parse(sessionStorage.getItem(DEMO_KEY)); } catch (e) { return null; } })();
    if (demo && demo.length) {
      try { sessionStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ }
      const test = { mode: "demo", title: "Демо-тест", questions: demo.map(d => QBY[d.id]).filter(Boolean), answers: demo.map(d => d.sel) };
      if (test.questions.length) {
        const xp = applyResult(user, test, grade(test));
        notify(user, "check", `Демо-тест нәтижесі сақталды: +${xp} балл`);
        saveUser(user);
      }
    }
    go("#/app");
  }

  // Аккаунт осы құрылғыда сақталғандықтан, құпия сөзді нөмір мен аты-жөні арқылы осында жаңартуға болады
  function forgotModal() {
    if (CLOUD) return openModal(`<h3>Құпия сөзді қалпына келтіру</h3>
      <p class="muted">Тіркелген телефон нөміріңді немесе email-іңді енгіз — email-ге құпия сөзді жаңарту сілтемесі жіберіледі.</p>
      <div class="field"><input class="input" id="f-id" inputmode="tel" placeholder="+7 (7XX) XXX-XX-XX немесе email"></div>
      <div class="err hidden" id="f-err"></div>
      ${AUTHOR.whatsapp ? `<p class="hint">Қиындық болса: <a target="_blank" rel="noopener" href="https://wa.me/${esc(AUTHOR.whatsapp.replace(/\D/g, ""))}">мұғалімге WhatsApp арқылы жаз</a></p>` : ""}
      <div class="btn-row"><button class="btn btn-ghost" data-close>Жабу</button><button class="btn btn-primary" id="f-send">Жіберу</button></div>`,
      (m, close) => {
        const inp = $("#f-id", m); bindPhoneMask(inp, true);
        $("#f-send", m).onclick = () => {
          const v = inp.value.trim(), err = $("#f-err", m);
          if (!looksLikeEmail(v) && !validPhone(v)) return showErr(err, "Нөмірді немесе email-ді дұрыс енгіз.");
          window.Cloud.resetPassword(v, looksLikeEmail(v) ? null : phoneDigits(v))
            .then(masked => { close(); toast(`Сілтеме жіберілді: ${masked}`); })
            .catch(ex => showErr(err, ex.message));
        };
      });
    openModal(`<h3>Құпия сөзді қалпына келтіру</h3>
      <p class="muted">Тіркелген нөміріңді және аты-жөніңді (тіркелгендегідей) енгіз.</p>
      <div class="field"><input class="input" id="f-phone" inputmode="tel" placeholder="+7 (7XX) XXX-XX-XX"></div>
      <div class="field"><input class="input" id="f-name" placeholder="Аты-жөні"></div>
      <div class="field"><input class="input" id="f-new" type="password" placeholder="Жаңа құпия сөз (кемінде 6 таңба)"></div>
      <div class="err hidden" id="f-err"></div>
      ${AUTHOR.whatsapp ? `<p class="hint">Қиындық болса: <a target="_blank" rel="noopener" href="https://wa.me/${esc(AUTHOR.whatsapp.replace(/\D/g, ""))}">мұғалімге WhatsApp арқылы жаз</a></p>` : ""}
      <div class="btn-row"><button class="btn btn-ghost" data-close>Жабу</button><button class="btn btn-primary" id="f-send">Сақтау</button></div>`,
      (m, close) => {
        bindPhoneMask($("#f-phone", m));
        $("#f-send", m).onclick = () => {
          const ph = $("#f-phone", m).value, err = $("#f-err", m);
          const norm = v => v.trim().toLowerCase().replace(/\s+/g, " ");
          const u = validPhone(ph) && db.users[phoneDigits(ph)];
          if (!u) return showErr(err, "Бұл нөмір осы құрылғыда тіркелмеген.");
          if (norm(u.name) !== norm($("#f-name", m).value)) return showErr(err, "Аты-жөні сәйкес келмейді.");
          if ($("#f-new", m).value.length < 6) return showErr(err, "Құпия сөз кемінде 6 таңба болуы керек.");
          u.pass = hash($("#f-new", m).value); saveUser(u);
          close(); toast("Құпия сөз жаңартылды. Енді кіре аласың!");
        };
      });
  }

  /* ---- Registration (3 steps) ---- */
  function renderRegister() {
    if (!state.reg) state.reg = { step: 1, name: "", phone: "", pass: "", target: 45, city: "", school: "", month: MONTHS[2], agree: false };
    const r = state.reg, body = $("#auth-body");
    const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= r.step ? "on" : ""}"></i>`).join("")}</div>`;

    if (r.step === 1) {
      body.innerHTML = steps + `
        <div class="step-title">1-қадам: Негізгі мәліметтер</div>
        <div class="field"><label for="r-name">Аты-жөні</label><input class="input" id="r-name" autocomplete="name" placeholder="Мысалы: Аружан Нұрланова" value="${esc(r.name)}"></div>
        <div class="field"><label for="r-phone">Телефон нөмірі</label>
          <input class="input" id="r-phone" inputmode="tel" autocomplete="tel" placeholder="+7 (7XX) XXX-XX-XX" value="${esc(r.phone)}">
          <div class="hint">Нөмір кіру үшін логин ретінде қолданылады</div>
        </div>
        ${CLOUD ? `<div class="field"><label for="r-email">Email</label>
          <input class="input" id="r-email" type="email" inputmode="email" autocomplete="email" placeholder="example@gmail.com" value="${esc(r.email || "")}">
          <div class="hint">Құпия сөзді ұмытсаң, қалпына келтіру сілтемесі осы email-ге келеді</div></div>` : ""}
        <div class="field"><label for="r-pass">Құпия сөз құрастыру</label>
          <div class="input-wrap"><input class="input" id="r-pass" type="password" autocomplete="new-password" placeholder="Кемінде 6 таңба" value="${esc(r.pass)}">
          <button type="button" class="eye" data-act="eye" aria-label="Құпия сөзді көрсету">${ic("eye", 20)}</button></div>
          <div class="strength"><i id="r-str"></i></div><div class="hint" id="r-str-l">Әріп, сан және белгі қоссаң — құпия сөз күшті болады</div>
        </div>
        <div class="err hidden" id="r-err"></div>
        <button class="btn btn-primary btn-lg btn-block" id="r-next">Әрі қарай →</button>`;
      const ph = $("#r-phone");
      bindPhoneMask(ph);
      ph.addEventListener("input", () => r.phone = ph.value);
      $("#r-name").addEventListener("input", e => r.name = e.target.value);
      if (CLOUD) $("#r-email").addEventListener("input", e => r.email = e.target.value.trim());
      const pass = $("#r-pass");
      const upd = () => { r.pass = pass.value; const s = passStrength(pass.value); $("#r-str").style.width = s.pct + "%"; $("#r-str").style.background = s.color; if (s.label) $("#r-str-l").textContent = "Сенімділігі: " + s.label; };
      pass.addEventListener("input", upd); upd();
      $("#r-next").onclick = () => {
        const err = $("#r-err");
        if (r.name.trim().length < 2) return showErr(err, "Аты-жөніңді енгіз.");
        if (!validPhone(r.phone)) return showErr(err, "Телефон нөмірін толық енгіз.");
        if (CLOUD && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || "")) return showErr(err, "Email-ді дұрыс енгіз.");
        if (!CLOUD && db.users[phoneDigits(r.phone)]) return showErr(err, "Бұл нөмір бұрын тіркелген. «Кіру» бөліміне өт.");
        if (r.pass.length < 6) return showErr(err, "Құпия сөз кемінде 6 таңба болуы керек.");
        r.step = 2; renderRegister();
      };
    }

    if (r.step === 2) {
      body.innerHTML = steps + `
        <div class="step-title">2-қадам: Профиліңді баптайық</div>
        <div class="field"><label for="r-target">Нысаналы балл (биология)</label>
          <div class="range-val"><span class="grad-text" id="r-tv">${r.target}</span><span class="muted" style="font-size:20px">/50</span></div>
          <input type="range" id="r-target" min="10" max="50" step="1" value="${r.target}">
        </div>
        <div class="field"><label for="r-city">Қала</label><input class="input" id="r-city" list="cities" placeholder="Тізімнен таңда немесе жаз" value="${esc(r.city)}">
          <datalist id="cities">${CFG.cities.map(c => `<option value="${c}">`).join("")}</datalist></div>
        <div class="field"><label for="r-school">Мектеп</label><input class="input" id="r-school" placeholder="Мысалы: №25 мектеп-гимназия" value="${esc(r.school)}"></div>
        <div class="field"><label>ҰБТ тапсыратын айың</label>
          <div class="chips">${MONTHS.map(m => `<button type="button" class="chip ${m === r.month ? "active" : ""}" data-month="${m}">${m}</button>`).join("")}</div></div>
        <div class="btn-row"><button class="btn btn-ghost" id="r-back">← Артқа</button><button class="btn btn-primary" id="r-next">Әрі қарай →</button></div>`;
      $("#r-target").addEventListener("input", e => { r.target = +e.target.value; $("#r-tv").textContent = r.target; });
      $("#r-city").addEventListener("input", e => r.city = e.target.value);
      $("#r-school").addEventListener("input", e => r.school = e.target.value);
      $$("[data-month]").forEach(b => b.onclick = () => { r.month = b.dataset.month; $$("[data-month]").forEach(x => x.classList.toggle("active", x === b)); });
      $("#r-back").onclick = () => { r.step = 1; renderRegister(); };
      $("#r-next").onclick = () => { r.step = 3; renderRegister(); };
    }

    if (r.step === 3) {
      body.innerHTML = steps + `
        <div class="step-title">3-қадам: Соңғы қадам</div>
        <div class="card" style="background:var(--surface-2);border:0;margin-bottom:16px">
          <b>${esc(r.name)}</b><br><span class="muted">${esc(r.phone)}</span><br>
          <span class="muted">Мақсат: <b>${r.target}/50</b> · ${esc(r.city || "Қала көрсетілмеген")} · ${esc(r.month)}</span>
        </div>
        <label class="check" style="margin-bottom:16px"><input type="checkbox" id="r-agree" ${r.agree ? "checked" : ""}>
          <span><button type="button" class="link-btn" data-act="terms">Қолданушы келісімімен</button> келісемін</span></label>
        <div class="err hidden" id="r-err"></div>
        <div class="btn-row"><button class="btn btn-ghost" id="r-back">← Артқа</button><button class="btn btn-green" id="r-done">Тіркелуді аяқтау</button></div>`;
      $("#r-agree").onchange = e => r.agree = e.target.checked;
      $("#r-back").onclick = () => { r.step = 2; renderRegister(); };
      $("#r-done").onclick = () => {
        if (!r.agree) return showErr($("#r-err"), "Жалғастыру үшін қолданушы келісімімен келісу қажет.");
        if (CLOUD) {
          const btn = $("#r-done"); btn.disabled = true; btn.textContent = "Тіркелуде…";
          const data = newUser("", { name: r.name.trim(), phone: formatPhone(r.phone), email: r.email, target: r.target, city: r.city.trim(), school: r.school.trim(), month: r.month });
          notify(data, "star", `${SITE}-ға қош келдің! Алғашқы тестіңді тапсырып, балл жина.`);
          window.Cloud.register(data, r.pass, phoneDigits(r.phone))
            .then(u => { cloudUser = fillUser(u); state.reg = null; toast("Тіркелу сәтті аяқталды!", "xp"); afterLogin(cloudUser); })
            .catch(ex => { showErr($("#r-err"), ex.message); btn.disabled = false; btn.textContent = "Тіркелуді аяқтау"; });
          return;
        }
        const id = phoneDigits(r.phone);
        const user = newUser(id, { name: r.name.trim(), phone: formatPhone(r.phone), pass: hash(r.pass), target: r.target, city: r.city.trim(), school: r.school.trim(), month: r.month });
        notify(user, "star", `${SITE}-ға қош келдің! Алғашқы тестіңді тапсырып, балл жина.`);
        saveUser(user);
        setSession(id, true);
        state.reg = null;
        toast("Тіркелу сәтті аяқталды!", "xp");
        afterLogin(user);
      };
    }
  }

  /* ================= App shell ================= */
  const NAV = [
    { id: "dashboard",   ico: "home",      t: "Басты бет" },
    { id: "chapters",    ico: "layers",    t: "Тараулық тест" },
    { id: "mock",        ico: "clipboard", t: "ҰБТ сынамасы және Нағыз ҰБТ базасы" },
    { id: "mistakes",    ico: "refresh",   t: "Қатемен жұмыс" },
    { id: "real",        ico: "book",      t: "ҰБТ-да жиі кездесетін сұрақтар тізімі" },
    { id: "plants",      ico: "seed",      t: "Ботаникадағы өсімдіктер тізімі" },
    { id: "leaderboard", ico: "trophy",    t: "Рейтинг" },
    { id: "settings",    ico: "settings",  t: "Баптаулар / Профиль" }
  ];

  function shell(u, active, inner) {
    const unread = u.notifications.filter(n => !n.read).length;
    const mc = mistakesCount(u);
    const cheer = CHEERS[new Date().getDate() % CHEERS.length];
    const isActive = id => active === id || (active === "chapter" && id === "chapters");
    return `
      <div class="shell">
        <aside class="sidebar" id="sidebar">
          <a class="logo" href="#/">${LOGO}${esc(SITE)}</a>
          ${(CLOUD && u.role === "teacher" ? [{ id: "teacher", ico: "chart", t: "Мұғалім кабинеті" }] : []).concat(NAV).map(n => `<a class="nav-item ${isActive(n.id) ? "active" : ""}" href="#/app/${n.id}">
            <span class="ni">${ic(n.ico)}</span>${n.t}${n.id === "mistakes" && mc ? `<span class="count">${mc}</span>` : ""}${(n.id === "plants" || n.id === "real") && !hasPremium(u) ? `<span class="ni-lock">${ic("lock", 14)}</span>` : ""}</a>`).join("")}
          ${hasPremium(u) ? "" : `<div class="sidebar-promo"><b>Премиум</b>Барлық толық ҰБТ сынамалары ашылады. ${fmtPrice(PLANS[0] ? PLANS[0].price : 0)}-дан бастап.<br>
            <button class="btn btn-cta btn-block" style="margin-top:10px;padding:10px" data-act="upgrade">Премиум алу</button></div>`}
        </aside>
        <div class="backdrop" id="backdrop" data-act="close-menu"></div>
        <div class="main-col">
          <header class="header">
            <button class="burger" data-act="menu" aria-label="Мәзір">${ic("menu")}</button>
            <div class="greet">
              <div class="avatar">${esc(initials(u.name))}</div>
              <div style="min-width:0"><h3>Сәлем, ${firstName(u)}!</h3><small>${cheer}</small></div>
            </div>
            <div class="header-right">
              <span class="stat-pill" title="Күн қатарынан дайындық">${ic("flame", 18)} ${streak(u)}<span class="lbl">&nbsp;күн</span></span>
              <span class="stat-pill pts-pill" title="Барлық жинаған балл">${ic("star", 18)} ${fmtNum(u.xp)}<span class="lbl">&nbsp;балл</span></span>
              ${!PREMIUM || u.role === "teacher" ? "" : hasPremium(u) ? `<span class="tariff pro">Премиум · ${fmtDate(u.premiumUntil)} дейін</span>` :
                `<span class="tariff free">Тегін режим</span><button class="btn btn-cta btn-upgrade" data-act="upgrade">${ic("star", 16)}<span class="up-txt">&nbsp;Премиум алу</span></button>`}
              <button class="bell" data-act="bell" aria-label="Хабарламалар">${ic("bell")}${unread ? `<span class="dot"></span>` : ""}</button>
            </div>
            <div id="notif-pop" class="notif-pop hidden"></div>
          </header>
          <main class="content">${inner}</main>
        </div>
      </div>`;
  }

  function verifySession() {
    if (Date.now() - (state.verifiedAt || 0) < 60000) return;
    state.verifiedAt = Date.now();
    window.Cloud.verify().then(d => {
      if (d && cloudUser && (d.premiumUntil || 0) !== (cloudUser.premiumUntil || 0)) {
        const was = hasPremium(cloudUser); cloudUser.premiumUntil = d.premiumUntil || 0;
        if (!was && hasPremium(cloudUser)) toast("Премиум ашылды! Барлық тесттер қолжетімді.", "xp");
        if (!location.hash.startsWith("#/test")) render();
      }
    }).catch(e => { cloudUser = null; state.lb = null; stopTimer(); state.test = null; toast(e.message); go("#/login"); });
  }
  setInterval(() => { if (CLOUD && cloudUser) { state.verifiedAt = 0; verifySession(); } }, 60000);

  function renderApp(u, page, arg) {
    const pages = { dashboard: pageDashboard, chapters: pageChapters, chapter: pageChapter, mock: pageMock, mistakes: pageMistakes, real: pageReal, plants: pagePlants, leaderboard: pageLeaderboard, settings: pageSettings };
    if (CLOUD && u.role === "teacher") pages.teacher = pageTeacher;
    const fn = pages[page] || (CLOUD && u.role === "teacher" ? pageTeacher : pageDashboard);
    app.innerHTML = shell(u, page, fn(u, arg));
    if (page === "teacher" || (!pages[page] && u.role === "teacher")) bindTeacher();
    if (page === "plants") bindPlants();
    if (page === "real") bindReal();
    if (CLOUD) verifySession();
    if (CLOUD && (page === "dashboard" || page === "leaderboard") && (!state.lb || Date.now() - state.lb.at > 60000) && !state.lbLoading) {
      state.lbLoading = true;
      window.Cloud.leaderboard().then(rows => { state.lb = { rows, at: Date.now() }; })
        .catch(e => { console.warn(e); state.lb = { rows: [], at: Date.now() }; })
        .finally(() => { state.lbLoading = false; if (location.hash.startsWith("#/app") && /dashboard|leaderboard|^#\/app$/.test(location.hash)) render(); });
    }
    if (page === "settings") bindSettings(u);
  }

  /* ---- Dashboard ---- */
  function ringSvg(pct, size = 140, stroke = 14) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C3AED"/><stop offset="1" stop-color="#EC4899"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .8s"/></svg>`;
  }

  function weekChart(u) {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: dayKey(d), l: DAYS[d.getDay()], today: i === 0 }); }
    const max = Math.max(3, ...days.map(d => u.activity[d.k] || 0));
    const total = days.reduce((a, d) => a + (u.activity[d.k] || 0), 0);
    return `<div class="card"><h3>Апталық белсенділік</h3><p class="muted" style="margin:0;font-size:14px">Осы аптада: <b>${total}</b> тест</p>
      <div class="chart">${days.map(d => { const v = u.activity[d.k] || 0; return `
        <div class="col ${d.today ? "today" : ""}"><em>${v || ""}</em><i style="height:${Math.max(4, v / max * 100)}%"></i><span>${d.l}</span></div>`; }).join("")}
      </div></div>`;
  }

  function lbWidget(u, full) {
    const rows = leaderboard(u), me = rows.find(r => r.me) || { rank: 0 };
    if (!rows.length) return `<p class="muted">Әзірге рейтингте ешкім жоқ.</p>`;
    const row = r => `<div class="lb-row ${r.me ? "me" : ""}"><span class="lb-rank ${r.rank <= 3 ? "top" + r.rank : ""}">${r.rank}</span>
      <span class="lb-name">${esc(r.me ? `Сен (${(u.name || "Түлек").split(" ")[0]})` : r.name)}</span>
      <span class="lb-xp">${fmtNum(r.pts)} балл</span><span class="lb-score">${r.best != null ? `ҰБТ: ${fmtBest(r.best)}` : ""}</span></div>`;
    if (full) return rows.map(row).join("");
    return rows.slice(0, 5).map(row).join("") + (me.rank > 5 ? `<div class="lb-gap">⋯</div>${row(me)}` : "");
  }

  function prizeHtml() {
    return CFG.leaderboard && CFG.leaderboard.prize ? `<div class="prize">${ic("gift", 22)}<span>${esc(CFG.leaderboard.prize)}</span></div>` : "";
  }

  function badgesHtml(u) {
    return `<div class="badges">${window.BADGES.map(b => `
      <div class="badge ${u.badges.includes(b.id) ? "" : "locked"}" title="${esc(b.desc)}"><span class="b-ico">${ic(b.icon, 22)}</span><b>${b.title}</b><small>${b.desc}</small></div>`).join("")}</div>`;
  }

  function weakestModule(u) {
    let best = null;
    MODULES.forEach(m => { const p = moduleProgress(u, m.id); if (p.mistakes && (!best || p.mistakes > best.n)) best = { m, n: p.mistakes }; });
    return best;
  }

  function pageDashboard(u) {
    const pct = progressPct(u), avg = avgScore(u), weak = weakestModule(u);
    return `
      <div class="grid dash-top">
        <div class="card ring-card">
          <div class="ring">${ringSvg(pct)}<div class="ring-txt"><div><b>${pct}%</b><span>дайындық</span></div></div></div>
          <div style="flex:1;min-width:0;width:100%">
            <h3>Биология курсы ${pct}% аяқталды</h3>
            <p class="muted" style="margin:0 0 6px;font-size:14px">${Object.keys(u.solved).length} / ${Q.length} сұраққа толық дұрыс жауап бердің</p>
            <div class="target-bar">
              <div class="row-between" style="margin:0 0 6px"><span>Мақсат: <b>${u.target} балл</b></span><span>Қазіргі орташа: <b>${avg} балл</b></span></div>
              <div class="bar"><i style="width:${avg / 50 * 100}%"></i><span class="mark" style="left:calc(${u.target / 50 * 100}% - 1px)"></span></div>
              <p class="hint">${avg >= u.target && u.history.length ? "Мақсатқа жеттің! Енді нәтижені тұрақтандыр." : `Мақсатқа дейін: <b>${Math.max(0, u.target - avg)}</b> балл`}</p>
            </div>
          </div>
        </div>
        ${weekChart(u)}
      </div>

      <h2 class="sec-title">Жылдам бастау</h2>
      <div class="grid g-3">
        <button class="qa-card qa-1" data-act="goto-mock"><span class="qa-ico">${ic("target", 26)}</span><h3>ҰБТ сынамасын бастау</h3>
          <p>${MOCK_SIZE} сұрақ · уақытты өзің таңда: ${MOCK_OPTS.join(" / ")} минут</p><span class="go">Бастау ${ic("arrow", 18)}</span></button>
        <button class="qa-card qa-2" data-act="start-mistakes"><span class="qa-ico">${ic("refresh", 26)}</span><h3>Қатемен жұмыс</h3>
          <p>Қате жауап берген сұрақтарыңнан тест</p>
          ${weak ? `<span class="warn">Сізде ${weak.m.abl} ${weak.n} қате бар, қайталау керек!</span>` : `<span class="warn">Әзірге қате жоқ</span>`}
          <span class="go">Қайталау ${ic("arrow", 18)}</span></button>
        <button class="qa-card qa-3" data-act="start-express"><span class="qa-ico">${ic("bolt", 26)}</span><h3>Күнделікті ${EXPRESS_SIZE} сұрақтық экспресс-тест</h3>
          <p>Барлық тараулардан жылдам жаттығу</p><span class="go">Бастау ${ic("arrow", 18)}</span></button>
      </div>

      <h2 class="sec-title">Тараулық тест</h2>
      <div class="grid g-3">${MODULES.map((m, i) => chapterCard(u, m, i)).join("")}</div>

      <div class="grid g-2" style="margin-top:26px">
        <div class="card"><h3>Айдың үздік 5 оқушысы</h3>${prizeHtml()}${lbWidget(u)}
          <a class="btn btn-ghost btn-block" style="margin-top:12px" href="#/app/leaderboard">Толық рейтингті көру</a></div>
        <div class="card"><h3>Жетістік белгілері <span class="muted" style="font-weight:600">${u.badges.filter(b => window.BADGES.some(x => x.id === b)).length}/${window.BADGES.length}</span></h3>${badgesHtml(u)}</div>
      </div>`;
  }

  const chNum = i => String(i + 1).padStart(2, "0");
  function chapterCard(u, m, i) {
    const p = moduleProgress(u, m.id), pct = p.total ? Math.round(p.solved / p.total * 100) : 0;
    return `<a class="card module-card" href="#/app/chapter/${m.id}" style="color:inherit">
      <div class="m-head"><span class="m-num">${chNum(i)}</span><div><h4>${m.title}</h4><small>${m.desc}</small></div></div>
      ${p.total ? `<div class="bar"><i style="width:${pct}%"></i></div>
      <div class="m-foot"><span>${pct}% · ${p.solved}/${p.total} сұрақ</span><span>${p.mistakes ? `<span class="err-txt">${p.mistakes} қате</span>` : ""}</span></div>` :
      `<div class="m-foot"><span>Сұрақтар жақында қосылады</span></div>`}</a>`;
  }

  /* ---- Chapters ---- */
  function pageChapters(u) {
    return `<h1 class="page-title">Тараулық тест</h1><p class="page-sub">Тарауды таңда — сол тарау бойынша тест тапсыр.</p>
      <div class="grid g-3">${MODULES.map((m, i) => chapterCard(u, m, i)).join("")}</div>`;
  }

  function pageChapter(u, id) {
    const i = MODULES.findIndex(x => x.id === id);
    if (i < 0) return pageChapters(u);
    const m = MODULES[i], p = moduleProgress(u, id), pct = p.total ? Math.round(p.solved / p.total * 100) : 0;
    return `<a href="#/app/chapters" class="back-link">← Барлық тараулар</a>
      <div class="card chapter-head">
        <span class="m-num m-num-lg">${chNum(i)}</span>
        <div style="flex:1;min-width:200px"><h1 class="page-title">${m.title}</h1><p class="muted" style="margin:0 0 10px">${m.desc}</p>
          ${p.total ? `<div class="bar"><i style="width:${pct}%"></i></div><small class="muted">${pct}% аяқталды · ${p.total} сұрақ · ${p.mistakes} қате</small>` :
            `<small class="muted">Бұл тарауға сұрақтар жақында қосылады.</small>`}</div>
        ${p.total ? `<div class="chapter-actions">
          <button class="btn btn-cta btn-lg" data-act="start-topic" data-id="${m.id}">Тестті бастау</button>
          ${p.mistakes ? `<button class="btn btn-ghost btn-lg" data-act="start-mistakes" data-id="${m.id}">Қатемен жұмыс</button>` : ""}
        </div>` : ""}
      </div>
      <div class="card">${rulesHtml()}</div>`;
  }

  /* ---- Mock ---- */
  function rulesHtml() {
    return `<div class="rules"><h3>Балл жүйесі</h3><p class="muted" style="margin:0">Ресми ҰБТ жүйесі: бір дұрыс жауапты және контекстік сұрақ — 1 балл, бірнеше дұрыс жауапты — 2 балл. Бір қате нұсқа белгіленсе — 1 балл төмендейді, екі және одан көп қате немесе 4 және одан көп нұсқа белгіленсе — 0 балл.</p>
      <table><thead><tr><th>Дұрыс жауап саны</th><th>Толық балл</th><th>1 балл</th><th>0 балл</th></tr></thead><tbody>
      <tr><td>3 дұрыс жауап</td><td>3-еуі де дұрыс — 2 балл</td><td>2 дұрыс; 2 дұрыс + 1 қате</td><td>1 дұрыс; 4 және одан көп нұсқа белгіленсе</td></tr>
      <tr><td>2 дұрыс жауап</td><td>2-еуі де дұрыс — 2 балл</td><td>1 дұрыс; 2 дұрыс + 1 қате; 1 дұрыс + 1 қате</td><td>2 және одан көп қате; 4 және одан көп нұсқа</td></tr>
      <tr><td>Көп жауапты, 1 дұрыс жауап</td><td>Тек дұрыс жауап — 2 балл</td><td>Дұрыс + 1 қате</td><td>2 және одан көп қате</td></tr>
      <tr><td>Бір жауапты сұрақ</td><td>Дұрыс жауап — 1 балл</td><td>—</td><td>Қате жауап</td></tr>
      <tr><td>Сәйкестендіру</td><td>2 сәйкестік те дұрыс — 2 балл</td><td>1 сәйкестік дұрыс</td><td>Екеуі де қате</td></tr></tbody></table></div>`;
  }

  function pageMock(u, folderId) {
    const folder = FOLDERS.find(f => f.id === folderId);
    const passed = id => u.history.some(h => h.testId === id);
    const done = f => f.tests.filter(t => passed(t.id)).length;
    const teacher = u.role === "teacher";
    const isOpen = (f, k) => teacher || k === 0 || passed(f.tests[k - 1].id);
    const mocks = u.history.filter(h => h.mode === "mock").slice(-10).reverse();
    const best = id => { const h = u.history.filter(x => x.testId === id); if (!h.length) return null; const b = h.reduce((a, x) => (x.score || 0) > (a.score || 0) ? x : a); return `${b.score}/${b.max}`; }; // тесттің өз балы
    return `<h1 class="page-title">ҰБТ сынамасы және Нағыз ҰБТ базасы</h1><p class="page-sub">Нақты ҰБТ форматындағы нұсқалар мен нағыз ҰБТ сұрақтары. Уақытты таңдап, тестті баста.</p>
      <div class="card" style="margin-bottom:16px"><div class="row-between" style="margin:0">
        <b>Уақыт:</b><div class="chips">${MOCK_OPTS.map(m => `<button class="chip ${state.mockMin === m ? "active" : ""}" data-act="mock-min" data-m="${m}">${m} минут</button>`).join("")}</div></div></div>
      ${folder ? `<a href="#/app/mock" class="back-link">← Барлық папкалар</a>
        <div class="folder">
          <div class="folder-head">${ic("layers", 22)}<h2>${esc(folder.title)}</h2>${folder.tests.length ? `<span class="muted">${done(folder)}/${folder.tests.length} тапсырылды</span>` : ""}</div>
          ${folder.desc ? `<div class="folder-desc">${ic("book", 20)}<span>${esc(folder.desc)}</span></div>` : ""}
          ${!folder.tests.length ? "" : teacher ? `<p class="hint" style="margin-top:-6px">Мұғалім аккаунты: барлық тесттер ашық.</p>` : `<p class="hint" style="margin-top:-6px">Тесттер ретімен ашылады: алдыңғы тестті тапсырсаң, келесісі ашылады.</p>`}
          ${folder.tests.length ? "" : `<div class="card empty"><p>Бұл папкаға тесттер жақында қосылады.</p></div>`}
          <div class="grid g-3">${folder.tests.map((t, k) => { const b = best(t.id), paid = k > 0 && !hasPremium(u), open = !paid && isOpen(folder, k); return `
            <div class="card test-card ${open ? "" : "locked"} ${paid ? "paid" : ""}">
              <div class="tc-top"><b>${esc(t.title)}</b>${k === 0 && PREMIUM ? `<span class="tag t-single">Тегін</span>` : b != null ? `<span class="tag t-single">Ең жақсы: ${b}</span>` : paid ? `<span class="tag t-multi">${ic("star", 14)} Премиум</span>` : open ? "" : `<span class="tag">${ic("lock", 14)} Құлыптаулы</span>`}</div>
              ${t.sub ? `<small class="tc-sub">${esc(t.sub)}</small>` : ""}
              <small class="muted">${t.questions.length} тапсырма · ${state.mockMin} минут${k === 0 && b != null ? ` · ең жақсы: ${b}` : ""}</small>
              ${paid ? `<button class="btn btn-primary btn-block" data-act="upgrade">${ic("lock", 16)} Премиум алу</button>` :
                open ? `<button class="btn btn-cta btn-block" data-act="start-test" data-id="${t.id}">${b != null ? "Қайта тапсыру" : "Бастау"}</button>` :
                `<button class="btn btn-ghost btn-block" disabled>${esc(folder.tests[k - 1].title)} тапсырылғаннан кейін ашылады</button>`}
            </div>`; }).join("")}</div>
        </div>` : FOLDERS.length ? `<div class="grid g-3">${FOLDERS.map(f => `
          <a class="card folder-card" href="#/app/mock/${f.id}">
            <span class="fc-ico">${ic("layers", 26)}</span>
            <div><h3 style="margin:0 0 4px">${esc(f.title)}</h3><small class="muted">${f.tests.length ? `${f.tests.length} тест · ${done(f)} тапсырылды` : "Жақында қосылады"}</small></div>
            <div class="bar" style="width:100%"><i style="width:${f.tests.length ? done(f) / f.tests.length * 100 : 0}%"></i></div>
          </a>`).join("")}</div>` : `<div class="card empty"><p>Сынама тесттері жақында қосылады.</p></div>`}
      <div class="grid g-2" style="margin-top:16px">
        <div class="card"><h3>Соңғы сынамалар</h3>
          ${mocks.length ? mocks.map(h => {
            const wrong = (h.wrong || []).filter(id => QBY[id]);
            return `<div class="lb-row hist-row"><span class="lb-name hist-date">${fmtDate(h.date)}</span><span class="muted hist-title">${esc(h.title || "")}</span>
              <span class="lb-xp">${h.score}/${h.max}</span>
              ${wrong.length ? `<button class="btn btn-ghost btn-sm" data-act="start-hist" data-d="${h.date}">Қатемен жұмыс (${wrong.length})</button>` : `<span class="tag">Қате жоқ</span>`}</div>`; }).join("") :
            `<p class="muted">Әзірге сынама тапсырылмаған. Алғашқысын баста!</p>`}
        </div>
        <div class="card">${rulesHtml()}</div>
      </div>`;
  }

  /* ---- Mistakes ---- */
  function pageMistakes(u) {
    const ids = Object.keys(u.mistakes).filter(id => QBY[id]);
    if (!ids.length) return `<h1 class="page-title">Қатемен жұмыс</h1>
      <div class="card empty"><div class="e-ico">${ic("check", 40)}</div><h3>Қате сұрақтар жоқ</h3><p>Тест тапсыр — қате жауап берген сұрақтарыңнан осында тест құрылады.</p>
      <button class="btn btn-primary" data-act="start-express">Экспресс-тест тапсыру</button></div>`;
    const byMod = MODULES.map(m => ({ m, list: ids.filter(id => QBY[id].module === m.id) })).filter(x => x.list.length);
    return `<h1 class="page-title">Қатемен жұмыс</h1><p class="page-sub">Осы уақытқа дейін тапсырған тесттеріңде қате жауап берген <b>${ids.length}</b> сұрақтан тест құрылады. Дұрыс жауап берсең, сұрақ тізімнен шығады. Түзетілгені: <b>${u.fixed}</b></p>
      <button class="btn btn-cta btn-lg" data-act="start-mistakes" style="margin-bottom:16px">Тестті бастау · ${ids.length} сұрақ</button>
      <div class="grid g-2">${byMod.map(x => `
        <div class="card"><div class="row-between" style="margin:0 0 10px"><h3 style="margin:0">${x.m.title} <span class="muted">· ${x.list.length}</span></h3>
          <button class="btn btn-ghost btn-sm" data-act="start-mistakes" data-id="${x.m.id}">Тест</button></div>
          ${x.list.map(id => `<p class="mistake-q">${QBY[id].q}</p>`).join("")}</div>`).join("")}
      </div>`;
  }

  /* ---- ҰБТ-да жиі кездесетін сұрақтар: күніне 20 сұрақ + жазбаша тест ---- */
  const RQ = window.REAL_UBT || [];
  const RQ_PER = 20, RQ_QUIZ = 7, RQ_DAYS = Math.ceil(RQ.length / RQ_PER);
  const rqDay = d => RQ.slice((d - 1) * RQ_PER, d * RQ_PER).map((x, j) => Object.assign({ n: (d - 1) * RQ_PER + j + 1 }, x));
  function rqOpenDays(u) {
    if (u.role === "teacher") return RQ_DAYS;
    if (!u.realStart) { u.realStart = dayKey(); saveUser(u); }
    const passed = Math.round((new Date(dayKey() + "T00:00") - new Date(u.realStart + "T00:00")) / 864e5);
    return Math.max(1, Math.min(RQ_DAYS, passed + 1));
  }
  // Жауапты салыстыру: регистр, қазақ әріптері (ә→а, қ→к …), сызықша, бос орын, бір әріп қатесі есепке алынбайды
  const RQ_FOLD = { "ә": "а", "ғ": "г", "қ": "к", "ң": "н", "ө": "о", "ұ": "у", "ү": "у", "һ": "х", "і": "и", "ы": "и", "й": "и", "ё": "е", "ъ": "", "ь": "",
    a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", k: "к", m: "м", h: "н", t: "т", b: "в", y: "у" };
  const rqNorm = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, m => /[,.]/.test(m) ? "." : " ")
    .replace(/(\d)\.(?=\d)/g, "$1,").replace(/\./g, " ").replace(/./g, ch => RQ_FOLD[ch] ?? ch).replace(/\s+/g, " ").trim();
  function rqDist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let p = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }
  function rqMatch(x, ans) {
    const v = rqNorm(ans); if (!v) return false;
    return x.k.some(k => { const w = rqNorm(k); if (v === w || v.replace(/ /g, "") === w.replace(/ /g, "")) return true;
      if (/^[a-zа-я]{3,5}$/i.test(k) && k === k.toUpperCase()) return [...v].sort().join("") === [...w].sort().join("");
      return !/\d/.test(w) && w.length >= 5 && rqDist(v, w) <= (w.length >= 10 ? 2 : 1); });
  }
  const RQ_NUM = ["", "бір", "екі", "үш", "төрт"];
  function rqHint(x) {
    const k = x.k[0];
    if (/\d/.test(k)) return /\p{L}/u.test(k) ? "Жауабын санмен, өлшем бірлігімен жаз" : "Жауабын санмен жаз";
    if (k.length <= 5 && k === k.toUpperCase()) return "Жауабы әріптерден тұрады";
    const n = k.trim().split(/\s+/).length;
    return `Жауабы ${RQ_NUM[n] || n} сөзден тұрады`;
  }
  function rqStart(day, only) {
    const pool = only || shuffle(rqDay(day).filter(x => x.k)).slice(0, RQ_QUIZ);
    state.rq = { day, qs: pool, i: 0, ans: [], ok: [], checked: false, fix: !!only };
  }
  const rqAnswerHtml = a => esc(a).replace(/\n/g, "<br>");

  function pageReal(u, arg) {
    const title = `<h1 class="page-title">ҰБТ-да жиі кездесетін сұрақтар тізімі</h1>`;
    if (!RQ.length) return title + `<div class="card empty"><div class="e-ico">${ic("book", 40)}</div><h3>Сұрақтар жақында қосылады</h3><p>Бұл бөлімде нақты ҰБТ-да келген сұрақтар мен олардың жауаптары болады.</p></div>`;
    if (!hasPremium(u)) return title + `<div class="card rq-banner">${ic("flame", 26)}<div><b>Әр күн сайын саған жаттауға арналған ${RQ_PER} сұрақ ашылады.</b>
      <span>Жаттап, қатемен жұмыс жасау маңызды.</span></div></div>
      <div class="card pl-locked"><div class="pl-lock-ico">${ic("lock", 30)}</div>
        <h2>Бұл бөлім — премиум</h2>
        <p class="muted">ҰБТ-да жиі кездесетін ${RQ.length} сұрақ-жауап, күн сайын ашылатын ${RQ_PER} сұрақ және «Жаттап аяқтадым» жазбаша тесті премиум оқушыларға ашық.</p>
        <div class="grid g-2 pl-blur" aria-hidden="true">${RQ.slice(0, 2).map(x => `<div class="card qa-item"><p class="qa-q">${esc(x.q)}</p><div class="qa-a"><b>Жауабы:</b> ${rqAnswerHtml(x.a)}</div></div>`).join("")}</div>
        <button class="btn btn-cta btn-lg" data-act="upgrade">${ic("star", 18)} Премиум алу</button></div>`;
    const open = rqOpenDays(u), done = u.realDone || {};
    let day = +arg || 0;
    if (!day || day > RQ_DAYS) { day = 1; for (let d = 1; d <= open; d++) { day = d; if (!done["d" + d]) break; } }
    const banner = `<div class="card rq-banner">${ic("flame", 26)}<div><b>Әр күн сайын саған жаттауға арналған ${RQ_PER} сұрақ ашылады.</b>
      <span>Жаттап, қатемен жұмыс жасау маңызды.</span></div></div>`;
    const chips = `<div class="chips rq-days">${Array.from({ length: RQ_DAYS }, (_, j) => j + 1).map(d => {
      const r = done["d" + d], lock = d > open;
      return lock ? `<span class="chip rq-lock" title="${d - open} күннен кейін ашылады">${ic("lock", 14)} ${d}-күн</span>`
        : `<a class="chip ${d === day ? "active" : ""}" href="#/app/real/${d}">${r ? ic("check", 14) + " " : ""}${d}-күн${r ? ` · ${r.s}/${r.n}` : ""}</a>`; }).join("")}</div>`;
    const head = title + `<p class="page-sub">Барлығы ${RQ.length} сұрақ · ${RQ_DAYS} күн · ашылғаны: ${open}-күнге дейін</p>` + banner + chips;
    if (day > open) return head + `<div class="card empty"><div class="e-ico">${ic("lock", 40)}</div><h3>${day}-күн әлі ашылмаған</h3><p>Бұл сұрақтар ${day - open} күннен кейін ашылады. Әзірге ашылған күндерді жатта.</p></div>`;

    const R = state.rq && state.rq.day === day ? state.rq : null;
    if (R) return head + rqQuizHtml(u, R);
    const list = rqDay(day), r = done["d" + day];
    return head + `<div class="row-between rq-top"><h2 style="margin:0">${day}-күн · ${list.length} сұрақ</h2>${r ? `<span class="tag">Соңғы нәтиже: ${r.s}/${r.n}</span>` : ""}</div>
      <div class="grid g-2">${list.map(x => `
        <div class="card qa-item"><div class="q-meta"><span class="tag">${x.n}</span></div>
          <p class="qa-q">${esc(x.q)}</p><div class="qa-a"><b>Жауабы:</b> ${rqAnswerHtml(x.a)}</div>
          ${(x.img || []).map(s => `<img class="rq-img" src="${s}" alt="" loading="lazy">`).join("")}</div>`).join("")}
      </div>
      <div class="card rq-finish"><div><h3 style="margin:0 0 4px">Жаттап болдың ба?</h3><p class="muted" style="margin:0">Батырманы бас — осы күннің сұрақтарынан ${Math.min(RQ_QUIZ, list.filter(x => x.k).length)} сұрақ беріледі. Жауабын өзің жазасың.</p></div>
        <button class="btn btn-cta btn-lg" data-act="rq-start" data-d="${day}">${ic("check", 18)} Жаттап аяқтадым</button></div>`;
  }

  function rqQuizHtml(u, R) {
    const total = R.qs.length;
    if (R.i >= total) {
      const s = R.ok.filter(Boolean).length, wrong = R.qs.filter((_, j) => !R.ok[j]);
      return `<div class="card rq-result"><div class="e-ico">${ic(s === total ? "trophy" : "target", 40)}</div>
        <h2>${R.fix ? "Қатемен жұмыс" : R.day + "-күн тесті"}: ${s}/${total}</h2>
        <p class="muted">${s === total ? "Керемет! Барлығы дұрыс." : "Қате жауаптарыңды қайта жаттап, қатемен жұмыс жаса."}</p>
        ${wrong.length ? `<div class="rq-wrong">${wrong.map(x => `<div class="qa-item rq-w"><p class="qa-q">${esc(x.kq || x.q)}</p>
          <p class="rq-your">Сенің жауабың: <s>${esc(R.ans[R.qs.indexOf(x)] || "—")}</s></p><div class="qa-a"><b>Дұрыс жауабы:</b> ${esc(x.k[0])}</div></div>`).join("")}</div>` : ""}
        <div class="rq-btns">${wrong.length ? `<button class="btn btn-cta" data-act="rq-fix">Қатемен жұмыс (${wrong.length})</button>` : ""}
          <button class="btn btn-primary" data-act="rq-start" data-d="${R.day}">Қайта тапсыру</button>
          <button class="btn btn-ghost" data-act="rq-back">Сұрақтарға оралу</button></div></div>`;
    }
    const x = R.qs[R.i], ok = R.ok[R.i];
    return `<div class="card rq-quiz">
      <div class="row-between"><span class="tag">Сұрақ ${R.i + 1} / ${total}</span><span class="muted">Дұрыс: ${R.ok.filter(Boolean).length}</span></div>
      <div class="pl-prog-bar rq-bar"><i style="width:${R.i / total * 100}%"></i></div>
      <p class="rq-q">${esc(x.kq || x.q)}</p>
      <p class="rq-hint">${ic("bulb", 15)} ${rqHint(x)}</p>
      <input id="rq-inp" class="input rq-inp ${R.checked ? (ok ? "ok" : "bad") : ""}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Жауабын жаз…" value="${esc(R.ans[R.i] || "")}" ${R.checked ? "disabled" : ""}>
      ${R.checked ? `<div class="rq-fb ${ok ? "ok" : "bad"}">${ok ? ic("check", 18) + " Дұрыс!" : ic("refresh", 18) + " Қате."} Жауабы: <b>${esc(x.k[0])}</b></div>
        <button class="btn btn-cta" data-act="rq-next">${R.i + 1 < total ? "Келесі сұрақ" : "Нәтижені көру"} ${ic("arrow", 18)}</button>`
        : `<button class="btn btn-primary" data-act="rq-check">Тексеру</button>`}
      <button class="btn btn-ghost btn-sm rq-cancel" data-act="rq-back">Тестті тоқтату</button></div>`;
  }
  function bindReal() {
    const inp = $("#rq-inp"); if (!inp || inp.disabled) return;
    inp.focus();
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); actions["rq-check"](); } });
  }

  /* ---- Ботаникадағы өсімдіктер тізімі ---- */
  const PLANT_GROUPS = window.PLANTS || [];
  const PLANT_ROWS = [].concat(...PLANT_GROUPS.map(g => g.rows.map(([f, p], i) => ({ id: g.id + "-" + i, g, f, p }))));
  // Тегтер: «;» болса — бөліктерге (әр бөлік бір тег), әйтпесе үтір бойынша
  const plantTags = p => {
    if (p.includes(";")) return p.split(/\s*;\s*/).filter(Boolean);
    if (/[()—]/.test(p)) return null;
    const parts = p.split(/\s*,\s*/).filter(Boolean); return parts.every(x => x.length <= 42) ? parts : null;
  };
  const plantsHtml = p => { const t = plantTags(p); return t ? t.map(x => `<span class="pl-tag">${esc(x)}</span>`).join("") : `<span class="pl-text">${esc(p)}</span>`; };
  // «Өзіңді тексер» үшін жеке өсімдік атаулары (жақшасы, ұзын түсіндірмесі жоқ жолдардан)
  const plantNames = r => {
    if (r.g.id === "origin") return null;
    if (/[()—]|\d/.test(r.p)) return null;
    const names = [].concat(...r.p.split(/\s*[;,]\s*/).map(x => x.replace(/^[^:]+:\s*/, "").split(/\s+(?:және|мен|немесе)\s+/))).map(x => x.trim()).filter(Boolean);
    return names.length && names.every(x => x.length <= 28 && !/\s.*\s.*\s/.test(x)) ? names : null;
  };
  const PQ_SIZE = { single: 14, multi: 10, match: 6 };
  const PQ_STOP = new Set(["өсімдіктер", "өсімдік", "тұқымдастар", "тұқымдас", "дақылдары", "дақылдар", "дақылдардың", "көптеген", "жеміс", "көкөніс", "және", "немесе", "кейбір", "сатыдағы", "ағаштар", "ағаштары", "түрлері", "жапырақтары", "жапырағы"]);
  const pqWords = r => new Set(r.p.toLowerCase().replace(/[^a-zа-яәғқңөұүһіё\s-]/gi, " ").split(/\s+/).filter(w => w.length >= 4 && !PQ_STOP.has(w)).map(w => w.slice(0, 6)));
  const pqClash = (a, b) => { const A = pqWords(a); for (const w of pqWords(b)) if (A.has(w)) return true; return a.p === b.p; };
  function buildPlantQuiz() {
    const rows = shuffle(PLANT_ROWS), used = new Set(), qs = [];
    const short = r => r.p.length <= 75 && r.f.length <= 140;
    const take = r => { used.add(r.id); return r; };
    // көп жауапты: кемінде 3 өсімдігі бар жол → 3 дұрыс + 3 басқа жолдардан
    for (const r of rows) {
      if (qs.filter(q => q.type === "multi").length >= PQ_SIZE.multi) break;
      const names = plantNames(r); if (!names || names.length < 3 || used.has(r.id)) continue;
      const correct = shuffle(names).slice(0, 3);
      const pool = shuffle([].concat(...PLANT_ROWS.filter(x => x.g === r.g && x !== r).map(x => plantNames(x) || [])).concat(...shuffle(PLANT_ROWS).slice(0, 30).map(x => plantNames(x) || [])))
        .filter((x, k, a) => a.indexOf(x) === k && !r.p.toLowerCase().includes(x.toLowerCase().slice(0, 5)) && !names.includes(x));
      if (pool.length < 3) continue;
      const opts = shuffle(correct.concat(pool.slice(0, 3)));
      qs.push({ type: "multi", row: take(r), q: r.f, options: opts, correct: correct.map(c => opts.indexOf(c)) });
    }
    // сәйкестендіру: бір тақырыптағы екі жол
    for (const g of shuffle(PLANT_GROUPS)) {
      if (qs.filter(q => q.type === "match").length >= PQ_SIZE.match) break;
      const cand = shuffle(PLANT_ROWS.filter(x => x.g === g && !used.has(x.id) && short(x) && x.f.length <= 90));
      if (cand.length < 4) continue;
      const pick = [];
      for (const x of cand) { if (pick.length < 4 && pick.every(y => !pqClash(x, y))) pick.push(x); }
      if (pick.length < 4) continue;
      const [a, b] = pick; const opts = shuffle(pick);
      take(a); take(b);
      qs.push({ type: "match", row: { g }, q: "Белгілерді өсімдіктермен сәйкестендіріңіз", options: opts.map(o => o.p), items: [a, b].map(x => ({ text: x.f, answer: opts.indexOf(x) })), correct: [opts.indexOf(a), opts.indexOf(b)] });
    }
    // бір жауапты: белгі → 4 нұсқа (мүмкіндігінше сол тақырыптан)
    for (const r of rows) {
      if (qs.filter(q => q.type === "single").length >= PQ_SIZE.single) break;
      if (used.has(r.id) || !short(r)) continue;
      const dis = shuffle(PLANT_ROWS.filter(x => x !== r && short(x) && !pqClash(x, r))).sort((x, y) => (y.g === r.g) - (x.g === r.g)).slice(0, 3);
      if (dis.length < 3 || dis.some((x, k) => dis.slice(k + 1).some(y => pqClash(x, y)))) continue;
      const opts = shuffle([r].concat(dis));
      qs.push({ type: "single", row: take(r), q: r.f, options: opts.map(o => o.p), correct: [opts.indexOf(r)] });
    }
    const order = { single: 0, match: 1, multi: 2 };
    state.pq = { qs: qs.sort((a, b) => order[a.type] - order[b.type]), i: 0, sel: [], checked: false, pts: 0, ok: 0 };
  }
  function pagePlants(u, arg) {
    const mode = arg === "learn" || arg === "quiz" ? arg : "table";
    const grp = mode === "table" && PLANT_GROUPS.find(g => g.id === arg);
    const head = `<div class="pl-hero"><div class="pl-hero-ico">${ic("seed", 34)}</div>
        <div><h1>Ботаникадағы өсімдіктер тізімі</h1><p>2027 жылға жаңартылған кесте · ${PLANT_GROUPS.length} тақырып · ${PLANT_ROWS.length} белгі. ҰБТ-да өсімдіктердің мысалдары жиі сұралады — осы тізімді жаттап ал!</p></div></div>
      <div class="pl-modes">
        <a class="pl-mode ${mode === "table" ? "active" : ""}" href="#/app/plants">${ic("book", 18)} Кесте</a>
        <a class="pl-mode ${mode === "learn" ? "active" : ""}" href="#/app/plants/learn">${ic("eye", 18)} Жаттау</a>
        <a class="pl-mode ${mode === "quiz" ? "active" : ""}" href="#/app/plants/quiz">${ic("target", 18)} Өзіңді тексер</a>
      </div>`;
    if (!hasPremium(u)) {
      const sample = PLANT_ROWS.slice(0, 4);
      return head.replace(/<div class="pl-modes">[\s\S]*$/, "") + `<div class="card pl-locked">
          <div class="pl-lock-ico">${ic("lock", 30)}</div>
          <h2>Бұл бөлім — премиум</h2>
          <p class="muted">Ботаникадағы барлық өсімдіктер тізімі (${PLANT_ROWS.length} белгі), жаттау режимі және «Өзіңді тексер» ойыны премиум оқушыларға ашық.</p>
          <div class="pl-list pl-blur" aria-hidden="true">${sample.map(r => `<div class="pl-row"><div class="pl-f">${esc(r.f)}</div><div class="pl-p">${plantsHtml(r.p)}</div></div>`).join("")}</div>
          <button class="btn btn-cta btn-lg" data-act="upgrade">${ic("star", 18)} Премиум алу</button>
        </div>`;
    }
    if (mode === "quiz") {
      if (!state.pq || !state.pq.qs) buildPlantQuiz();
      const P = state.pq, total = P.qs.length, max = P.qs.reduce((a, q) => a + maxPoints(q), 0);
      if (P.i >= total) return head + `<div class="card pl-quiz pl-done"><div class="pl-lock-ico">${ic("trophy", 30)}</div>
          <h2>Тест аяқталды!</h2><p class="pl-score">${P.pts} / ${max} балл</p><p class="muted">${total} сұрақтың ${P.ok}-не толық дұрыс жауап бердің.</p>
          <button class="btn btn-cta btn-lg" data-act="pq-restart">${ic("refresh", 18)} Жаңа сұрақтармен қайта бастау</button></div>`;
      const q = P.qs[P.i], done = P.checked, sel = P.sel;
      const typeTag = { single: "Бір дұрыс жауап", multi: "Бірнеше дұрыс жауап", match: "Сәйкестендіру" }[q.type];
      const pts = done ? scorePoints(q, sel) : null;
      let body;
      if (q.type === "match") {
        body = `<div class="pl-opts">${q.options.map((o, i) => `<div class="pl-opt static"><b>${LETTERS[i]}.</b> ${esc(o)}</div>`).join("")}</div>
          <div class="pl-match">${q.items.map((it, k) => `<div class="pl-mi"><div class="pl-mi-t"><b>${k + 1}.</b> ${esc(it.text)}</div><div class="pl-mi-b">${q.options.map((o, i) => {
            const c = done ? (i === it.answer ? "ok" : sel[k] === i ? "bad" : "") : sel[k] === i ? "on" : "";
            return `<button class="pl-ml ${c}" data-act="pq-match" data-k="${k}" data-i="${i}" ${done ? "disabled" : ""}>${LETTERS[i]}</button>`; }).join("")}</div></div>`).join("")}</div>`;
      } else {
        body = `<div class="pl-opts">${q.options.map((o, i) => {
          const ok = q.correct.includes(i), on = sel.includes(i);
          const c = done ? (ok && on ? "ok" : on ? "bad" : ok ? "miss" : "") : on ? "on" : "";
          return `<button class="pl-opt ${c}" data-act="pq-pick" data-i="${i}" ${done ? "disabled" : ""}><b>${LETTERS[i]}.</b> ${esc(o)}</button>`; }).join("")}</div>`;
      }
      const canCheck = q.type === "match" ? sel.filter(x => x != null).length === q.items.length : sel.length > 0;
      return head + `<div class="card pl-quiz">
          <div class="pl-prog"><div class="pl-prog-bar"><i style="width:${P.i / total * 100}%"></i></div><b>Сұрақ ${P.i + 1} / ${total}</b><span class="muted">Балл: ${P.pts}</span></div>
          <div class="row-between" style="margin:10px 0 0"><span class="tag t-${q.type === "multi" ? "multi" : q.type === "match" ? "context" : "single"}">${typeTag}</span><span class="tag">${esc((q.row && q.row.g.title) || "")}</span></div>
          <p class="pl-q">${esc(q.q)}</p>${q.type === "multi" ? `<p class="hint" style="margin-top:-8px">Дұрыс жауаптың бәрін белгіле (3 жауап)</p>` : ""}
          ${body}
          <div class="pl-next">${done ? `<b>${pts === maxPoints(q) ? "Дұрыс! 🎉" : pts > 0 ? `Жартылай дұрыс: ${pts} балл` : "Қате. Дұрыс жауабы жасыл түспен белгіленді."}</b>
            <button class="btn btn-cta" data-act="pq-next">${P.i + 1 < total ? "Келесі сұрақ" : "Нәтижені көру"} ${ic("arrow", 18)}</button>`
            : `<span class="muted">${q.type === "single" ? "Бір нұсқаны таңда" : q.type === "match" ? "Әр белгіге бір әріп таңда" : "Нұсқаларды белгілеп, «Тексеру» бас"}</span>
            <button class="btn btn-primary" data-act="pq-check" ${canCheck ? "" : "disabled"}>Тексеру</button>`}</div>
        </div>`;
    }
    const groups = grp ? [grp] : PLANT_GROUPS;
    return head + `<div class="pl-tools">
        <div class="pl-search">${ic("search", 18)}<input id="pl-search" type="search" placeholder="Өсімдікті немесе белгіні іздеу… (мысалы: қызғалдақ)" autocomplete="off"></div>
        ${mode === "learn" ? `<button class="btn btn-ghost btn-sm" data-act="pl-reveal">${ic("eye", 16)} Барлығын ашу</button>` : ""}
      </div>
      ${mode === "table" ? "" : `<p class="hint" style="margin-top:0">Жаттау режимі: өсімдіктер жасырылған. Белгіні оқып, жауабын есіңе түсір, сосын карточканы басып тексер.</p>`}
      <p class="muted pl-empty" hidden>Ештеңе табылмады.</p>
      ${groups.map(g => `<section class="pl-group" data-g="${g.id}">
        <h2 class="pl-gh">${ic(g.icon, 20)}${esc(g.title)}<span class="muted">${g.rows.length}</span></h2>
        <div class="pl-list">${g.rows.map(([f, p, loc]) => `<div class="pl-row ${mode === "learn" ? "hide" : ""}" data-s="${esc((f + " " + p + " " + (loc || "")).toLowerCase())}" ${mode === "learn" ? `data-act="pl-flip"` : ""}>
          <div class="pl-f">${esc(f)}</div>${loc ? `<div class="pl-loc">${ic("compass", 14)} ${esc(loc)}</div>` : ""}<div class="pl-p">${plantsHtml(p)}</div>${mode === "learn" ? `<div class="pl-cover">${ic("eye", 16)} Жауабын көру</div>` : ""}</div>`).join("")}</div>
      </section>`).join("")}`;
  }
  function bindPlants() {
    const inp = $("#pl-search"); if (!inp) return;
    inp.addEventListener("input", () => {
      const v = inp.value.trim().toLowerCase(); let any = false;
      document.querySelectorAll(".pl-group").forEach(sec => {
        let n = 0; sec.querySelectorAll(".pl-row").forEach(r => { const hit = !v || r.dataset.s.includes(v); r.hidden = !hit; if (hit) n++; });
        sec.hidden = !n; if (n) any = true;
      });
      const e = document.querySelector(".pl-empty"); if (e) e.hidden = any;
    });
  }

  /* ---- Leaderboard ---- */
  function pageLeaderboard(u) {
    const month = MONTH_NAMES[new Date().getMonth()];
    return `<h1 class="page-title">Рейтинг</h1><p class="page-sub">${esc(month)} айы · оқушылар осы айда тесттерден жинаған балл бойынша орналасады. Сенің орның: <b>${myRank(u)}</b></p>
      ${prizeHtml()}
      <div class="card">${lbWidget(u, true)}</div>
      <p class="hint">Әр тестте алған баллың (әр сұраққа 0, 1 немесе 2 балл) айлық есепке қосылады. «ҰБТ» — осы айдағы толық сынамадағы ең жоғары нәтиже.</p>`;
  }

  /* ---- Мұғалім кабинеті ---- */
  function pageTeacher(u) {
    const list = state.students;
    if (!list) return `<h1 class="page-title">Мұғалім кабинеті</h1><div class="card empty"><p>Оқушылар тізімі жүктелуде…</p></div>`;
    const q = (state.tq || "").toLowerCase();
    const weekAgo = Date.now() - 7 * 864e5;
    const rows = list.map(x => Object.assign(x, { _m: monthPoints(fillUser(x)), _best: bestMock(fillUser(x)) }))
      .filter(x => !q || [x.name, x.phone, x.email, x.city, x.school].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b._m - a._m);
    const active = list.filter(x => (x.lastSeen || 0) > weekAgo).length;
    const leader = rows.find(x => x._m > 0);
    return `<h1 class="page-title">Мұғалім кабинеті</h1><p class="page-sub">Барлық оқушылар, олардың баллдары мен құрылғылары.</p>
      <div class="grid g-3" style="margin-bottom:16px">
        <div class="card stat-card"><span class="muted">Барлық оқушы</span><b>${list.length}</b></div>
        <div class="card stat-card"><span class="muted">Соңғы 7 күнде белсенді</span><b>${active}</b></div>
        <div class="card stat-card"><span class="muted">Айдың көшбасшысы</span><b>${leader ? esc(leader.name) : "—"}</b>${leader ? `<small class="muted">${leader._m} балл</small>` : ""}</div>
      </div>
      <div class="card">
        <div class="row-between" style="margin:0 0 12px"><input class="input" id="t-search" placeholder="Аты, нөмірі, мектебі бойынша іздеу" value="${esc(state.tq || "")}" style="max-width:360px">
          <button class="btn btn-ghost btn-sm" data-act="t-reload">${ic("refresh", 16)} Жаңарту</button></div>
        <div class="t-table-wrap"><table class="t-table"><thead><tr>
          <th>#</th><th>Оқушы</th><th>Байланыс</th><th>Осы ай</th><th>ҰБТ (ай)</th><th>Тест</th><th>Соңғы кіру</th><th>Премиум</th><th>Құрылғы</th><th></th></tr></thead><tbody>
          ${rows.map((x, i) => `<tr class="${x.blocked ? "blocked" : ""}">
            <td>${i + 1}</td>
            <td><b>${esc(x.name)}</b><br><small class="muted">${esc([x.city, x.school].filter(Boolean).join(" · ") || "—")}</small></td>
            <td>${esc(x.phone || "")}<br><small class="muted">${esc(x.email || "")}</small></td>
            <td><b>${x._m}</b> балл</td>
            <td>${x._best != null ? fmtBest(x._best) : "—"}</td>
            <td>${(x.history || []).length}</td>
            <td>${x.lastSeen ? fmtDate(x.lastSeen) : "—"}</td>
            <td>${(x.premiumUntil || 0) > Date.now() ? `<span class="tag t-single">${fmtDate(x.premiumUntil)} дейін</span>` : `<span class="muted">Жоқ</span>`}
              <div class="t-prem">${PLANS.map(p => `<button class="btn btn-ghost btn-sm" data-act="t-premium" data-id="${x.id}" data-plan="${p.id}">+ ${esc(p.title)}</button>`).join("")}
              ${(x.premiumUntil || 0) > Date.now() ? `<button class="btn btn-outline btn-sm" data-act="t-premium" data-id="${x.id}" data-plan="off">Өшіру</button>` : ""}</div></td>
            <td>${x.deviceId ? `${esc(x.device || "Бекітілген")}<br><small class="muted">${x.deviceAt ? fmtDate(x.deviceAt) : ""}</small>` : `<span class="muted">Бос</span>`}</td>
            <td class="t-actions">
              ${x.deviceId ? `<button class="btn btn-ghost btn-sm" data-act="t-device" data-id="${x.id}">Құрылғыны босату</button>` : ""}
              <button class="btn btn-sm ${x.blocked ? "btn-green" : "btn-outline"}" data-act="t-block" data-id="${x.id}" data-b="${x.blocked ? 0 : 1}">${x.blocked ? "Ашу" : "Бұғаттау"}</button>
            </td></tr>`).join("") || `<tr><td colspan="10" class="muted" style="text-align:center;padding:20px">Оқушы табылмады</td></tr>`}
        </tbody></table></div>
      </div>
      <p class="hint">«Құрылғыны босату» — оқушы жаңа телефоннан кіре алады (кірген сәтте жаңа құрылғы бекітіледі). «Бұғаттау» — оқушы сайтқа кіре алмайды. «+ 1 ай» — премиумды 30 күнге ұзартады, «+ ҰБТ-ға дейін» — ${fmtDate(UBT_END)} дейін ашады.</p>`;
  }
  function loadStudents() {
    return window.Cloud.students().then(l => { state.students = l; }).catch(e => { toast(window.Cloud.errorText(e)); state.students = []; });
  }
  function bindTeacher() {
    if (!state.students && !state.stLoading) { state.stLoading = true; loadStudents().finally(() => { state.stLoading = false; render(); }); }
    const inp = $("#t-search");
    if (inp) inp.addEventListener("input", () => { state.tq = inp.value; const pos = inp.selectionStart; render(); const n = $("#t-search"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
  }

  /* ---- Settings ---- */
  function pageSettings(u) {
    const theme = store.get(THEME_KEY, "auto");
    return `<h1 class="page-title">Баптаулар / Профиль</h1><p class="page-sub">Деректеріңді өзгерт, құпия сөзді ауыстыр.</p>
      <div class="grid g-2">
        <form class="card" id="profile-form">
          <h3>Профиль</h3>
          <div class="field"><label>Аты-жөні</label><input class="input" name="name" value="${esc(u.name)}"></div>
          <div class="field"><label>Телефон</label><input class="input" value="${esc(u.phone || u.email || "—")}" disabled></div>
          <div class="field"><label>Нысаналы балл: <b id="s-tv">${u.target}</b>/50</label><input type="range" name="target" min="10" max="50" value="${u.target}"></div>
          <div class="field"><label>Қала</label><input class="input" name="city" list="cities2" value="${esc(u.city)}"><datalist id="cities2">${CFG.cities.map(c => `<option value="${c}">`).join("")}</datalist></div>
          <div class="field"><label>Мектеп</label><input class="input" name="school" value="${esc(u.school)}"></div>
          <div class="field"><label>ҰБТ айы</label><select class="input" name="month">${MONTHS.map(m => `<option ${m === u.month ? "selected" : ""}>${m}</option>`).join("")}</select></div>
          <button class="btn btn-primary btn-block">Сақтау</button>
        </form>
        <div class="grid" style="align-content:start">
          <form class="card" id="pass-form">
            <h3>Құпия сөзді ауыстыру</h3>
            ${u.pass || CLOUD ? `<div class="field"><input class="input" type="password" name="old" placeholder="Қазіргі құпия сөз" autocomplete="current-password"></div>` : ""}
            <div class="field"><input class="input" type="password" name="new" placeholder="Жаңа құпия сөз" autocomplete="new-password"></div>
            <button class="btn btn-ghost btn-block">Жаңарту</button>
          </form>
          <div class="card"><h3>Тақырып</h3><div class="chips">
            ${[["auto", "Авто"], ["light", "Жарық"], ["dark", "Қараңғы"]].map(([v, l]) => `<button class="chip ${theme === v ? "active" : ""}" data-act="theme" data-v="${v}">${l}</button>`).join("")}</div></div>
          <div class="card"><h3>Жетістіктерім</h3>${badgesHtml(u)}</div>
          <div class="card"><div class="btn-row" style="margin:0">
            <button class="btn btn-outline" data-act="reset">Прогресті тазалау</button>
            <button class="btn btn-outline" style="color:var(--red)" data-act="logout">${ic("logout", 18)} Шығу</button></div></div>
        </div>
      </div>`;
  }

  function bindSettings(u) {
    const pf = $("#profile-form");
    pf.elements.target.addEventListener("input", e => $("#s-tv").textContent = e.target.value);
    pf.addEventListener("submit", e => {
      e.preventDefault();
      const f = pf.elements, name = f.name.value.trim();
      if (name.length < 2) return toast("Аты-жөніңді енгіз");
      Object.assign(u, { name, target: +f.target.value, city: f.city.value.trim(), school: f.school.value.trim(), month: f.month.value });
      saveUser(u); toast("Профиль сақталды"); render();
    });
    const ps = $("#pass-form");
    ps.addEventListener("submit", e => {
      e.preventDefault();
      const f = ps.elements;
      if (CLOUD) {
        if (f.new.value.length < 6) return toast("Жаңа құпия сөз кемінде 6 таңба");
        return window.Cloud.changePassword(f.old.value, f.new.value).then(() => { ps.reset(); toast("Құпия сөз жаңартылды"); }).catch(ex => toast(ex.message));
      }
      if (u.pass && hash(f.old.value) !== u.pass) return toast("Қазіргі құпия сөз қате");
      if (f.new.value.length < 6) return toast("Жаңа құпия сөз кемінде 6 таңба");
      u.pass = hash(f.new.value); saveUser(u); ps.reset(); toast("Құпия сөз жаңартылды");
    });
  }

  function applyTheme() {
    const t = store.get(THEME_KEY, "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  /* ================= Tests ================= */
  function pick(list, n) { return shuffle(list).slice(0, Math.min(n, list.length)); }

  function buildMock(u) {
    // ҰБТ құрылымына жақын: алдымен бір жауаптылар, содан кейін контекстік, соңында бірнеше жауаптылар
    // Ресми құрылым: 25 бір жауапты + 5 контекстік + 10 бірнеше жауапты (жетпесе — басқа сұрақтармен толтырылады)
    const by = t => shuffle(Q.filter(q => (isMulti(q) ? "multi" : q.type === "context" ? "context" : "single") === t));
    const parts = { single: by("single"), context: by("context"), multi: by("multi") };
    let qs = [].concat(parts.single.splice(0, CALC.single.count), parts.context.splice(0, CALC.context.count), parts.multi.splice(0, CALC.multi.count));
    qs = qs.concat(shuffle([].concat(parts.single, parts.context, parts.multi)).slice(0, Math.max(0, MOCK_SIZE - qs.length))).slice(0, MOCK_SIZE);
    const order = { single: 0, context: 1, multi: 2 };
    qs.sort((a, b) => order[a.type] - order[b.type]);
    return { mode: "mock", title: "ҰБТ сынамасы", questions: qs, timeLimit: state.mockMin * 60, instant: false };
  }

  function startTest(t) {
    if (!t.questions.length) return toast("Сұрақтар жақында қосылады");
    t.answers = t.questions.map(() => []);
    t.checked = t.questions.map(() => false);
    t.cur = 0; t.startedAt = Date.now();
    state.test = t; state.result = null;
    go("#/test");
  }

  function startMode(mode, id) {
    const u = currentUser();
    if (!u) return go("#/login");
    if (mode === "test") {
      const t = TESTS.find(x => x.id === id); if (!t) return;
      const k = t.folder.tests.findIndex(x => x.id === id);
      if (k > 0 && u.role !== "teacher" && !u.history.some(h => h.testId === t.folder.tests[k - 1].id)) return toast(`Алдымен ${t.folder.tests[k - 1].title} тапсыр`);
      if (k > 0 && !hasPremium(u)) return upgradeModal(`${t.folder.title} · ${t.title} — премиум тест. Әр папкадағы Тест-1 тегін.`);
      return startTest({ mode: "mock", testId: t.id, title: `${t.folder.title} · ${t.title}`, questions: t.questions, timeLimit: state.mockMin * 60, instant: false });
    }
    if (mode === "mock") {
      if (!hasPremium(u)) return upgradeModal();
      return startTest(buildMock(u));
    }
    if (mode === "express") return startTest({ mode: "express", title: `Экспресс-тест (${EXPRESS_SIZE} сұрақ)`, questions: pick(Q, EXPRESS_SIZE), instant: true });
    if (mode === "hist") {
      const h = u.history.find(x => String(x.date) === String(id));
      const list = h ? (h.wrong || []).map(k => QBY[k]).filter(Boolean) : [];
      if (!list.length) return toast("Бұл сынамада қате жоқ");
      return startTest({ mode: "mistakes", title: "Сынама қателерімен жұмыс", questions: shuffle(list), instant: true });
    }
    if (mode === "topic") {
      const m = MODULES.find(x => x.id === id);
      const qs = shuffle(Q.filter(q => q.module === id));
      if (!qs.length) return toast("Бұл тарауға сұрақтар жақында қосылады");
      return startTest({ mode: "topic", title: `Тараулық тест: ${m.title}`, questions: qs, instant: false, module: id });
    }
    if (mode === "mistakes") {
      const list = Object.keys(u.mistakes).map(k => QBY[k]).filter(q => q && (!id || q.module === id));
      if (!list.length) { toast("Қате сұрақтар жоқ — керемет!"); return go("#/app/mistakes"); }
      return startTest({ mode: "mistakes", title: "Қатемен жұмыс", questions: shuffle(list), instant: true });
    }
  }

  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
  function timeLeft(t) { return t.timeLimit ? Math.max(0, t.timeLimit - Math.floor((Date.now() - t.startedAt) / 1000)) : null; }
  const fmtTime = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

  const imgsHtml = list => (list || []).map(src => `<img class="q-img" src="${esc(src)}" alt="Сурет" loading="lazy">`).join("");
  function contextHtml(q) {
    if (!q.context && !q.contextImg) return "";
    return `<details class="context-box" ${q._ctxOpen === false ? "" : "open"}><summary>${q.contextTitle ? q.contextTitle : "Контекст"}</summary>
      <div class="ctx-body">${q.context || ""}${imgsHtml(q.contextImg)}</div></details>`;
  }
  // Сәйкестендіру: нұсқалар тізімі + әр элементке әріп таңдау
  function matchHtml(q, sel, checked, interactive) {
    sel = sel || [];
    return `<div class="match-opts">${q.options.map((o, i) => `<div class="mo"><span class="letter">${LETTERS[i]}</span><span>${o}</span></div>`).join("")}</div>
      <div class="match-items">${q.items.map((it, k) => {
        const chosen = sel[k];
        return `<div class="mi ${checked ? (chosen === it.answer ? "ok" : "bad") : ""}"><div class="mi-text"><b>${k + 1}.</b> ${it.text}</div>
          <div class="mi-letters">${q.options.map((o, i) => {
            const cls = checked ? (i === it.answer ? "ok" : i === chosen ? "bad" : "") : (i === chosen ? "sel" : "");
            return interactive ? `<button class="ml ${cls}" data-act="pick-match" data-k="${k}" data-i="${i}" ${checked ? "disabled" : ""}>${LETTERS[i]}</button>` : `<span class="ml ${cls}">${LETTERS[i]}</span>`;
          }).join("")}</div></div>`; }).join("")}</div>`;
  }
  const correctText = q => q.type === "match" ? q.items.map((it, k) => `${k + 1}–${LETTERS[it.answer]}`).join(", ") : q.correct.map(i => LETTERS[i]).join(", ");

  function renderTest() {
    const t = state.test, q = t.questions[t.cur], sel = t.answers[t.cur], multi = isMulti(q), checked = t.checked[t.cur];
    const answered = t.answers.filter((a, i) => hasAnswer(t.questions[i], a)).length;
    const typeTag = q.type === "match" ? `<span class="tag t-context">Сәйкестендіру</span>` : q.type === "context" ? `<span class="tag t-context">Контекстік тапсырма</span>` :
      multi ? `<span class="tag t-multi">Бір немесе бірнеше дұрыс жауап</span>` : `<span class="tag t-single">Бір дұрыс жауап</span>`;
    const optClass = i => {
      if (!checked) return sel.includes(i) ? "sel" : "";
      const ok = q.correct.includes(i), s = sel.includes(i);
      return ok && s ? "ok" : s ? "bad" : ok ? "miss" : "";
    };
    const pts = checked ? scorePoints(q, sel) : null;
    const isLast = t.cur === t.questions.length - 1;
    const tl = timeLeft(t);
    const u = currentUser();

    const inner = `<div class="test-wrap">
      <div class="test-top">
        <h2>${esc(t.title)}</h2>
        ${tl != null ? `<span class="timer ${tl < 300 ? "low" : ""}" id="timer">⏱ ${fmtTime(tl)}</span>` : ""}
        <button class="btn btn-outline" style="padding:8px 14px" data-act="finish">Аяқтау</button>
      </div>
      <div class="progress-line"><i style="width:${(t.instant ? t.checked.filter(Boolean).length : answered) / t.questions.length * 100}%"></i></div>
      <div class="q-card">
        <div class="q-meta"><span class="tag">${t.cur + 1} / ${t.questions.length}</span>${typeTag}${q.module ? `<span class="tag">${modTitle(q.module)}</span>` : ""}
          ${checked ? `<span class="pts p${ptsCls(q, pts)}">${pts} балл</span>` : ""}</div>
        ${contextHtml(q)}
        <div class="q-text">${q.q}</div>
        ${imgsHtml(q.img)}
        ${q.type === "match" ? matchHtml(q, sel, checked, true) : `<div class="opts">${q.options.map((o, i) => `
          <button class="opt ${multi ? "multi" : "single"} ${optClass(i)}" data-act="pick" data-i="${i}" ${checked ? "disabled" : ""} aria-pressed="${sel.includes(i)}">
            <span class="letter">${LETTERS[i]}</span><span>${o}</span></button>`).join("")}
        </div>`}
        ${checked ? `<div class="explain">${q.explain ? `<b>Түсініктеме:</b> ${q.explain}<br>` : ""}<small class="muted">Дұрыс жауап: ${correctText(q)}</small></div>` : ""}
        <div class="q-nav">
          <button class="btn btn-ghost" data-act="prev" ${t.cur === 0 ? "disabled" : ""}>← Алдыңғы</button>
          ${t.instant && !checked ? `<button class="btn btn-primary" data-act="check" ${hasAnswer(q, sel) ? "" : "disabled"}>Тексеру</button>` :
            isLast ? `<button class="btn btn-cta" data-act="finish">Тестті аяқтау</button>` : `<button class="btn btn-primary" data-act="next">Келесі →</button>`}
        </div>
      </div>
      <div class="q-grid">${t.questions.map((qq, i) => {
        let c = hasAnswer(qq, t.answers[i]) ? "done" : "";
        if (t.checked[i]) { const p = scorePoints(qq, t.answers[i]); c = ["r-bad", "r-part", "r-ok"][ptsCls(qq, p)]; }
        return `<button class="${c} ${i === t.cur ? "cur" : ""}" data-act="goto" data-i="${i}">${i + 1}</button>`; }).join("")}
      </div>
    </div>`;

    if (u && t.mode !== "demo") app.innerHTML = shell(u, "test", inner);
    else app.innerHTML = `<header class="topbar"><div class="container"><a class="logo" href="#/">${LOGO}${esc(SITE)}</a>
      <a class="btn btn-ghost" href="#/register">Тіркелу</a></div></header><div class="content" style="margin:0 auto">${inner}</div>`;

    stopTimer();
    if (t.timeLimit) state.timer = setInterval(() => {
      const left = timeLeft(t), el = $("#timer");
      if (el) { el.textContent = "⏱ " + fmtTime(left); el.classList.toggle("low", left < 300); }
      if (left <= 0) { stopTimer(); toast("Уақыт бітті! Тест аяқталды."); finishTest(); }
    }, 1000);
  }

  function finishTest() {
    const t = state.test; if (!t) return;
    stopTimer();
    t.checked = t.questions.map(() => true);
    const res = grade(t);
    const u = currentUser();
    let xp = 0;
    if (u && t.mode !== "demo") xp = applyResult(u, t, res);
    else if (t.mode === "demo") {
      try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(t.questions.map((q, i) => ({ id: q.id, sel: t.answers[i] })))); } catch (e) { /* ignore */ }
      if (u) { xp = applyResult(u, t, res); try { sessionStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ } }
    }
    state.result = { test: t, res, xp };
    state.test = null;
    if (xp) setTimeout(() => toast(`+${xp} балл`, "xp"), 300);
    go("#/result");
  }

  function renderResult() {
    const { test: t, res, xp } = state.result, u = currentUser();
    const msg = res.pct >= 90 ? "Керемет! Сен 50/50-ге дайынсың!" : res.pct >= 70 ? "Жақсы нәтиже! Аз ғана қалды" : res.pct >= 40 ? "Жаман емес! Қателерді талдап, қайталайық" : "Бастама жасалды! Түсініктемелерді оқып шық";
    const inner = `<div class="test-wrap">
      <div class="result-hero">
        <div style="font-size:15px;opacity:.9">${esc(t.title)}</div>
        <div class="big">${res.score}<span style="font-size:24px;opacity:.8">/${res.max}</span></div>
        <p>${res.score} / ${res.max} балл · ${res.pct}%</p>
        <p style="font-weight:700">${msg}</p>
      </div>
      <div class="result-stats">
        <div class="card"><b style="color:var(--green)">${res.full}</b><span>толық дұрыс</span></div>
        <div class="card"><b style="color:var(--amber)">${res.part}</b><span>жартылай дұрыс</span></div>
        <div class="card"><b style="color:var(--red)">${res.zero}</b><span>қате (0 балл)</span></div>
        <div class="card"><b>${t.timeLimit ? fmtTime(Math.min(t.timeLimit, Math.floor((Date.now() - t.startedAt) / 1000))) : t.questions.length}</b><span>${t.timeLimit ? "жұмсалған уақыт" : "сұрақ"}</span></div>
      </div>
      ${!u ? `<div class="card" style="text-align:center;margin-bottom:18px;border:2px solid var(--pink)">
        <h3>Нәтижеңді сақтап, рейтингке қатыс!</h3><p class="muted">Тіркелсең, қате сұрақтарың «Қатемен жұмыс» бөліміне түседі және жеке статистикаң жүргізіледі.</p>
        <a class="btn btn-cta btn-lg" href="#/register">Тіркелу — 30 секунд</a></div>` : `
        <div class="btn-row" style="margin-bottom:18px"><a class="btn btn-primary" href="#/app">Басты бетке</a>
          ${res.zero + res.part ? `<button class="btn btn-cta" data-act="start-hist" data-d="${(currentUser().history.slice(-1)[0] || {}).date}">Қатемен жұмыс</button>` : ""}</div>`}
      <h2 style="font-size:20px">Толық талдау</h2>
      ${t.questions.map((q, i) => {
        const sel = t.answers[i], p = res.per[i];
        const cls = j => { const ok = q.correct.includes(j), s = sel.includes(j); return ok && s ? "ok" : s ? "bad" : ok ? "miss" : ""; };
        return `<div class="q-card review-item">
          <div class="q-meta"><span class="tag">${i + 1}</span>${q.module ? `<span class="tag">${modTitle(q.module)}</span>` : ""}<span class="pts p${ptsCls(q, p)}">${p} балл</span>${hasAnswer(q, sel) ? "" : `<span class="tag">Жауап берілмеген</span>`}</div>
          ${q.context && (i === 0 || t.questions[i - 1].context !== q.context) ? contextHtml(Object.assign({}, q, { _ctxOpen: false })) : ""}
          <div class="q-text">${q.q}</div>
          ${imgsHtml(q.img)}
          ${q.type === "match" ? matchHtml(q, sel, true, false) : `<div class="opts">${q.options.map((o, j) => `<div class="opt ${isMulti(q) ? "multi" : "single"} ${cls(j)}"><span class="letter">${LETTERS[j]}</span><span>${o}</span></div>`).join("")}</div>`}
          ${q.explain ? `<div class="explain"><b>Түсініктеме:</b> ${q.explain}</div>` : ""}</div>`; }).join("")}
      <div class="card" style="margin-top:8px">${rulesHtml()}</div>
    </div>`;
    if (u) app.innerHTML = shell(u, "result", inner);
    else app.innerHTML = `<header class="topbar"><div class="container"><a class="logo" href="#/">${LOGO}${esc(SITE)}</a>
      <a class="btn btn-primary" href="#/register">Тіркелу</a></div></header><div class="content" style="margin:0 auto">${inner}</div>`;
  }

  /* ================= Modals ================= */
  function upgradeModal(reason) {
    const u = currentUser(), P = CFG.premium;
    let sel = (PLANS.find(p => p.best) || PLANS[0] || {}).id;
    const draw = m => {
      const pl = PLANS.find(p => p.id === sel);
      const msg = `Сәлеметсіз бе! Мен ${SITE} сайтында «${pl.title}» премиум тарифін (${fmtPrice(pl.price)}) Kaspi арқылы төледім. Чекті жіберемін.\nАты-жөнім: ${u ? u.name : ""}\nТелефон: ${u ? (u.phone || "") : ""}`;
      m.innerHTML = `<h3>Премиум рұқсат</h3>
        ${reason ? `<p class="muted" style="margin-top:0">${esc(reason)}</p>` : ""}
        <ul class="pm-list"><li>Барлық папкадағы толық ҰБТ сынамалары</li><li>Әр сынаманың дұрыс жауаптары және қатемен жұмыс</li><li>Ботаникадағы өсімдіктер тізімі: жаттау және өзіңді тексер</li><li>Тест-1 әр папкада тегін қалады</li></ul>
        <div class="plans">${PLANS.map(p => `<button class="plan ${p.id === sel ? "active" : ""}" data-plan="${p.id}">
          ${p.best ? `<span class="plan-best">Тиімді</span>` : ""}<b>${esc(p.title)}</b><span class="plan-price">${fmtPrice(p.price)}</span>
          <small class="muted">${p.untilUbt ? `${fmtDate(UBT_END)} дейін` : `${p.days} күн`}</small></button>`).join("")}</div>
        <div class="pay-steps">
          <div class="pay-step"><span>1</span><div>Kaspi арқылы <b>${fmtPrice(pl.price)}</b> аударыңыз:<br>
            <span class="kaspi-num">${esc(P.kaspiPhone.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5"))}</span>
            <button class="btn btn-ghost btn-sm" data-copy="${esc(P.kaspiPhone)}">Көшіру</button><br><small class="muted">Алушы: ${esc(P.kaspiName)}</small></div></div>
          <div class="pay-step"><span>2</span><div>Төлем чегін WhatsApp-қа жіберіңіз.</div></div>
          <div class="pay-step"><span>3</span><div>Мұғалім тексерген соң премиум сіздің аккаунтыңызда ашылады (әдетте бірнеше сағат ішінде).</div></div>
        </div>
        <a class="btn btn-green btn-block" target="_blank" rel="noopener" href="https://wa.me/${esc(P.whatsapp)}?text=${encodeURIComponent(msg)}">${ic("chat", 18)} Чекті WhatsApp-қа жіберу</a>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Жабу</button>`;
      $$("[data-plan]", m).forEach(b => b.onclick = () => { sel = b.dataset.plan; draw(m); });
      $$("[data-copy]", m).forEach(b => b.onclick = () => {
        const done = () => toast("Нөмір көшірілді");
        if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, () => toast(b.dataset.copy)); else toast(b.dataset.copy);
      });
    };
    openModal("", m => draw(m));
  }

  function toggleNotifs() {
    const u = currentUser(), pop = $("#notif-pop"); if (!u || !pop) return;
    state.notifOpen = !state.notifOpen;
    if (!state.notifOpen) return pop.classList.add("hidden");
    pop.innerHTML = u.notifications.length ? u.notifications.slice(0, 8).map(n => `
      <div class="notif"><span class="n-ico">${ICONS[n.icon] ? ic(n.icon, 18) : ic("bell", 18)}</span><div>${esc(n.text)}<time>${new Date(n.time).toLocaleString("kk-KZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div></div>`).join("") :
      `<div class="notif muted">Хабарлама жоқ</div>`;
    pop.classList.remove("hidden");
    u.notifications.forEach(n => n.read = true); saveUser(u);
    const dot = $(".bell .dot"); if (dot) dot.remove();
  }

  /* ================= Events ================= */
  const actions = {
    "tab-login": () => go("#/login"),
    "tab-register": () => go("#/register"),
    forgot: forgotModal,
    terms: () => openModal(`<h3>Қолданушы келісімі</h3><p class="muted">${esc(CFG.terms)}</p><button class="btn btn-primary btn-block" data-close>Түсінікті</button>`),
    eye: el => { const inp = el.parentElement.querySelector("input"); inp.type = inp.type === "password" ? "text" : "password"; el.innerHTML = ic(inp.type === "password" ? "eye" : "eyeoff", 20); },
    menu: () => { $("#sidebar").classList.add("open"); $("#backdrop").classList.add("show"); },
    "close-menu": () => { $("#sidebar").classList.remove("open"); $("#backdrop").classList.remove("show"); },
    bell: toggleNotifs,
    upgrade: () => upgradeModal(),
    print: () => window.print(),
    theme: el => { store.set(THEME_KEY, el.dataset.v); applyTheme(); render(); },
    logout: () => confirmModal("Шығу", "Аккаунттан шыққыңыз келе ме?", "Шығу", () => {
      if (CLOUD) return window.Cloud.logout().finally(() => { cloudUser = null; state.lb = null; go("#/"); });
      store.del(SESSION_KEY); memSession = null; go("#/");
    }),
    reset: () => confirmModal("Прогресті тазалау", "Балл, статистика, қате сұрақтар тізімі және жетістіктер өшіріледі. Жалғастырасыз ба?", "Тазалау", () => {
      const u = currentUser();
      Object.assign(u, { xp: 0, mocks: 0, history: [], solved: {}, mistakes: {}, fixed: 0, activity: {}, modulesTried: {}, badges: [] });
      saveUser(u); toast("Прогресс тазаланды"); render();
    }),
    "t-reload": () => { state.students = null; render(); },
    "t-premium": el => {
      const x = (state.students || []).find(s => s.id === el.dataset.id); if (!x) return;
      const pl = PLANS.find(p => p.id === el.dataset.plan);
      const until = pl ? planUntil(pl, x.premiumUntil) : 0;
      const text = pl ? `${esc(x.name)} үшін премиум ${fmtDate(until)} дейін ашылады (${esc(pl.title)}, ${fmtPrice(pl.price)}). Төлемді тексердіңіз бе?` : `${esc(x.name)} премиумы өшіріледі.`;
      confirmModal(pl ? "Премиум қосу" : "Премиумды өшіру", text, pl ? "Қосу" : "Өшіру", () =>
        window.Cloud.setPremium(x.id, until).then(() => { toast(pl ? "Премиум қосылды" : "Премиум өшірілді"); state.students = null; render(); }).catch(e => toast(window.Cloud.errorText(e))));
    },
    "t-device": el => confirmModal("Құрылғыны босату", "Оқушы келесі жолы кірген құрылғыға аккаунт қайта бекітіледі. Жалғастырасыз ба?", "Босату", () =>
      window.Cloud.resetDevice(el.dataset.id).then(() => { toast("Құрылғы босатылды"); state.students = null; render(); }).catch(e => toast(window.Cloud.errorText(e)))),
    "t-block": el => {
      const b = el.dataset.b === "1";
      const run = () => window.Cloud.setBlocked(el.dataset.id, b).then(() => { toast(b ? "Оқушы бұғатталды" : "Бұғат алынды"); state.students = null; render(); }).catch(e => toast(window.Cloud.errorText(e)));
      b ? confirmModal("Бұғаттау", "Оқушы сайтқа кіре алмайды. Жалғастырасыз ба?", "Бұғаттау", run) : run();
    },
    "start-mock": () => go("#/app/mock"),
    "start-test": el => startMode("test", el.dataset.id),
    "goto-mock": () => go("#/app/mock"),
    "mock-min": el => { state.mockMin = +el.dataset.m; render(); },
    "pl-flip": el => el.classList.toggle("hide"),
    "pl-reveal": () => document.querySelectorAll(".pl-row.hide").forEach(r => r.classList.remove("hide")),
    "pq-pick": el => { const P = state.pq; if (!P || P.checked) return; const q = P.qs[P.i], i = +el.dataset.i;
      if (q.type === "single") P.sel = [i]; else P.sel = P.sel.includes(i) ? P.sel.filter(x => x !== i) : P.sel.concat(i); render(); },
    "pq-match": el => { const P = state.pq; if (!P || P.checked) return; P.sel[+el.dataset.k] = +el.dataset.i; render(); },
    "pq-check": () => { const P = state.pq; if (!P || P.checked) return; const q = P.qs[P.i], pts = scorePoints(q, P.sel); P.pts += pts; if (pts === maxPoints(q)) P.ok++; P.checked = true; render(); },
    "pq-next": () => { const P = state.pq; if (!P) return; P.i++; P.sel = []; P.checked = false; render(); window.scrollTo(0, 0); },
    "pq-restart": () => { buildPlantQuiz(); render(); },
    "rq-start": el => { rqStart(+el.dataset.d); go("#/app/real/" + el.dataset.d); window.scrollTo(0, 0); },
    "rq-fix": () => { const R = state.rq; if (!R) return; rqStart(R.day, R.qs.filter((_, j) => !R.ok[j])); render(); window.scrollTo(0, 0); },
    "rq-back": () => { state.rq = null; render(); window.scrollTo(0, 0); },
    "rq-check": () => { const R = state.rq, inp = $("#rq-inp"); if (!R || R.checked || !inp) return;
      const v = inp.value.trim(); if (!v) { toast("Жауабын жаз"); inp.focus(); return; }
      R.ans[R.i] = v; R.ok[R.i] = rqMatch(R.qs[R.i], v); R.checked = true; render(); },
    "rq-next": () => { const R = state.rq; if (!R) return; R.i++; R.checked = false;
      if (R.i >= R.qs.length && !R.fix) { const u = currentUser(); u.realDone = Object.assign({}, u.realDone, { ["d" + R.day]: { s: R.ok.filter(Boolean).length, n: R.qs.length, at: Date.now() } }); saveUser(u); }
      render(); window.scrollTo(0, 0); },
    "scroll-to": el => { const t = document.getElementById(el.dataset.id); if (t) t.scrollIntoView({ behavior: "smooth" }); },
    "calc-step": el => { const inp = document.getElementById(el.dataset.for); inp.value = +inp.value + +el.dataset.d; updateCalc(); },
    "start-express": () => startMode("express"),
    "start-topic": el => startMode("topic", el.dataset.id),
    "start-mistakes": el => startMode("mistakes", el.dataset.id),
    "start-hist": el => startMode("hist", el.dataset.d),
    pick: el => {
      const t = state.test, q = t.questions[t.cur], i = +el.dataset.i;
      if (t.checked[t.cur]) return;
      let sel = t.answers[t.cur];
      if (isMulti(q)) sel = sel.includes(i) ? sel.filter(x => x !== i) : sel.concat(i).sort();
      else sel = sel[0] === i ? [] : [i];
      t.answers[t.cur] = sel;
      renderTestKeepScroll();
    },
    "pick-match": el => {
      const t = state.test, q = t.questions[t.cur], k = +el.dataset.k, i = +el.dataset.i;
      if (t.checked[t.cur]) return;
      const sel = (t.answers[t.cur] || []).slice(); while (sel.length < q.items.length) sel.push(null);
      sel[k] = sel[k] === i ? null : i;
      t.answers[t.cur] = sel;
      renderTestKeepScroll();
    },
    check: () => {
      const t = state.test; t.checked[t.cur] = true;
      const p = scorePoints(t.questions[t.cur], t.answers[t.cur]);
      toast(ptsCls(t.questions[t.cur], p) === 2 ? `Дұрыс! +${p} балл` : p ? `Жартылай дұрыс: ${p} балл` : "Қате жауап");
      renderTestKeepScroll();
    },
    next: () => { const t = state.test; if (t.cur < t.questions.length - 1) { t.cur++; renderTest(); window.scrollTo(0, 0); } },
    prev: () => { const t = state.test; if (t.cur > 0) { t.cur--; renderTest(); window.scrollTo(0, 0); } },
    goto: el => { state.test.cur = +el.dataset.i; renderTest(); window.scrollTo(0, 0); },
    finish: () => {
      const t = state.test; if (!t) return;
      const left = t.instant ? t.checked.filter(c => !c).length : t.answers.filter((a, i) => !hasAnswer(t.questions[i], a)).length;
      if (left) confirmModal("Тестті аяқтау", `${left} сұрақ${t.instant ? " тексерілмеген" : "қа жауап берілмеген"}. Аяқтасаң, олар 0 балл болып есептеледі.`, "Аяқтау", finishTest);
      else finishTest();
    }
  };
  function renderTestKeepScroll() { const y = window.scrollY; renderTest(); window.scrollTo(0, y); }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (el && actions[el.dataset.act]) { e.preventDefault(); actions[el.dataset.act](el); return; }
    if (state.notifOpen && !e.target.closest("#notif-pop")) toggleNotifs();
    if (e.target.closest(".sidebar .nav-item")) actions["close-menu"]();
  });

  document.addEventListener("keydown", e => {
    if (!state.test || location.hash !== "#/test" || /input|textarea/i.test(e.target.tagName) || modalRoot.innerHTML) return;
    const t = state.test, q = t.questions[t.cur];
    const idx = "abcdefgh".indexOf(e.key.toLowerCase());
    const n = "123456".indexOf(e.key);
    const i = idx >= 0 ? idx : n;
    if (q.type === "match") { if (e.key === "ArrowRight") actions.next(); else if (e.key === "ArrowLeft") actions.prev(); return; }
    if (i >= 0 && i < q.options.length) actions.pick({ dataset: { i } });
    else if (e.key === "ArrowRight") actions.next();
    else if (e.key === "ArrowLeft") actions.prev();
    else if (e.key === "Enter" && t.instant && !t.checked[t.cur] && hasAnswer(q, t.answers[t.cur])) actions.check();
  });

  // Бір күн ішінде бірінші кіргенде — streak хабарламасы
  function dailyGreeting() {
    const u = currentUser(); if (!u) return;
    const k = "bioubt_greet_" + u.id + "_" + dayKey();
    if (store.get(k, false)) return;
    store.set(k, true);
    const s = streak(u);
    if (s >= 2) { notify(u, "flame", `${s} күн қатарынан! Тізбекті үзбе — бүгін де бір тест тапсыр.`); saveUser(u); }
  }

  applyTheme();
  if (!CLOUD) { dailyGreeting(); render(); }
  else {
    app.innerHTML = `<div class="boot"><img class="logo-mark" src="img/brand/icon-96.png" alt=""><p>Жүктелуде…</p></div>`;
    import("./cloud.js?v=202610160148")
      .then(() => window.Cloud.restore())
      .then(({ user, error }) => {
        cloudUser = user ? fillUser(user) : null;
        if (error) toast(error);
        dailyGreeting(); render();
      })
      .catch(e => { console.error(e); app.innerHTML = `<div class="boot"><p>Серверге қосылу мүмкін болмады. Интернетті тексеріп, бетті жаңартыңыз.</p></div>`; });
  }
})();

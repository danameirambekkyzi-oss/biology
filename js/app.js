/* BioҰБТ — бір беттік қосымша (SPA). Деректер браузердің localStorage-інде сақталады. */
(function () {
  "use strict";

  const Q = window.QUESTIONS;
  const MODULES = window.MODULES;
  const QBY = Object.fromEntries(Q.map(q => [q.id, q]));
  const MOCK_SIZE = 45, MOCK_MIN = 50, EXPRESS_SIZE = 10, DEMO_SIZE = 10, FREE_MOCKS = 2;
  const DB_KEY = "bioubt_db_v1", SESSION_KEY = "bioubt_session", THEME_KEY = "bioubt_theme", DEMO_KEY = "bioubt_demo";
  const LETTERS = "ABCDEFGH";
  const DAYS = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сн"];
  const MONTHS = ["Қаңтар", "Наурыз", "Мамыр–Маусым", "Тамыз"];
  const CHEERS = ["Бүгін де бір қадам алға! 🚀", "50/50 — жақын арада! 💪", "Әр қате — жаңа білім 🌱", "Сен міндетті түрде жетесің! ✨", "Бүгінгі мақсат: 1 тест 🎯"];

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
  function currentUser() { const id = getSessionId() || memSession; return id && db.users[id] ? db.users[id] : null; }
  function saveUser(u) { db.users[u.id] = u; saveDb(); }

  function newUser(id, data) {
    return Object.assign({
      id, name: "", phone: "", email: "", pass: "", target: 45, city: "", school: "", month: MONTHS[2],
      xp: 0, premium: false, mocks: 0, history: [], solved: {}, mistakes: {}, fixed: 0, activity: {},
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
  const isMulti = q => q.type === "multi" || q.correct.length > 1;
  const modTitle = id => (MODULES.find(m => m.id === id) || {}).title || id;

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
   * Балл жүйесі (әр сұраққа ең көбі 2 балл):
   *   3 дұрыс жауабы бар сұрақ: 3-еуі де дұрыс белгіленсе — 2 балл, тек 2 дұрыс белгіленсе — 1 балл, 1, 4, 5 белгіленсе — 0.
   *   2 дұрыс жауабы бар сұрақ: 2-еуі де дұрыс белгіленсе — 2 балл, тек 1 дұрыс белгіленсе — 1 балл, 3, 4, 5 белгіленсе — 0.
   *   1 дұрыс жауабы бар сұрақ: дұрыс жауап белгіленсе — 2 балл, 2, 3, 4, 5 белгіленсе — 0.
   *   Белгіленгендердің ішінде бір қате нұсқа болса — 0 балл.
   */
  function scorePoints(q, sel) {
    const k = q.correct.length, s = sel.length;
    if (!s) return 0;
    if (sel.some(i => !q.correct.includes(i))) return 0;
    if (s === k) return 2;
    if (k >= 2 && s === k - 1) return 1;
    return 0;
  }

  function grade(test) {
    const per = test.questions.map((q, i) => scorePoints(q, test.answers[i] || []));
    const score = per.reduce((a, b) => a + b, 0), max = test.questions.length * 2;
    return {
      per, score, max,
      full: per.filter(p => p === 2).length,
      part: per.filter(p => p === 1).length,
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
  const progressPct = u => Math.round(Object.keys(u.solved).length / Q.length * 100);
  function avgScore(u) {
    const h = u.history.slice(-10);
    return h.length ? Math.round(h.reduce((a, r) => a + r.scaled, 0) / h.length) : 0;
  }
  function moduleProgress(u, id) {
    const qs = Q.filter(q => q.module === id);
    return { total: qs.length, solved: qs.filter(q => u.solved[q.id]).length, mistakes: qs.filter(q => u.mistakes[q.id]).length };
  }
  function leaderboard(u) {
    const rows = window.PEERS.map(p => Object.assign({}, p));
    rows.push({ name: u.name || "Сен", xp: u.xp, score: avgScore(u), me: true });
    rows.sort((a, b) => b.xp - a.xp || (a.me ? 1 : -1));
    rows.forEach((r, i) => r.rank = i + 1);
    return rows;
  }
  const myRank = u => leaderboard(u).find(r => r.me).rank;
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
    if (u.xp >= 1000) give("xp1000");
    if (u.fixed >= 5) give("fixer");
    if (MODULES.every(m => u.modulesTried[m.id])) give("explorer");
    earned.forEach(id => {
      const b = window.BADGES.find(x => x.id === id);
      notify(u, b.icon, `Жаңа жетістік белгісі: «${b.title}»!`);
      setTimeout(() => toast(`${b.icon} Жаңа белгі: ${b.title}`, "xp"), 600);
    });
  }

  function applyResult(u, test, res) {
    const rankBefore = myRank(u);
    const xp = res.full * 10 + res.part * 4 + (test.mode === "mock" ? 50 : 0) + (res.score === res.max ? 20 : 0);
    u.xp += xp;
    const today = dayKey();
    u.activity[today] = (u.activity[today] || 0) + 1;
    test.questions.forEach((q, i) => {
      u.modulesTried[q.module] = true;
      if (res.per[i] === 2) {
        u.solved[q.id] = true;
        if (u.mistakes[q.id]) { delete u.mistakes[q.id]; u.fixed++; }
      } else {
        u.mistakes[q.id] = true;
      }
    });
    if (test.mode === "mock") u.mocks++;
    u.history.push({ date: Date.now(), mode: test.mode, title: test.title, score: res.score, max: res.max, scaled: res.scaled, pct: res.pct });
    u.history = u.history.slice(-200);
    checkBadges(u, res, test);
    const rankAfter = myRank(u);
    if (rankAfter < rankBefore) notify(u, "📈", `Сіздің рейтингіңіз көтерілді! Енді ${rankAfter}-орындасыз.`);
    saveUser(u);
    return xp;
  }

  /* ================= Router ================= */
  let state = { test: null, result: null, timer: null, notifOpen: false, reg: null, authTab: "login" };

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
      case "demo": return startTest(buildDemo());
      case "test": return state.test ? renderTest() : go(u ? "#/app" : "#/");
      case "result": return state.result ? renderResult() : go(u ? "#/app" : "#/");
      case "app": return u ? renderApp(u, parts[1] || "dashboard", parts[2]) : go("#/login");
      default: return go("#/");
    }
  }

  /* ================= Landing ================= */
  function renderLanding(u) {
    const feats = [
      { ico: "🎯", bg: "var(--purple-50)", t: "ҰБТ жаңа форматына 100% сәйкес", d: "Контекстік сұрақтар, бір және бірнеше дұрыс жауабы бар тапсырмалар — нақты ҰБТ сияқты, сол балл жүйесімен." },
      { ico: "💡", bg: "color-mix(in srgb, var(--blue) 14%, transparent)", t: "Әр сұраққа толық талдау", d: "Қате жібердің бе? Неліктен дұрыс емес екенін және дұрыс жауаптың логикасын бірден түсіндіреміз." },
      { ico: "📊", bg: "color-mix(in srgb, var(--pink) 14%, transparent)", t: "Статистика мен қателермен жұмыс", d: "Әлсіз тарауларыңды көрсетеміз, қателеріңді жеке банкке жинап, қайта тапсыруға мүмкіндік береміз." }
    ];
    app.innerHTML = `
      <header class="topbar"><div class="container">
        <a class="logo" href="#/"><span class="logo-mark">🧬</span>BioҰБТ</a>
        <div class="topbar-actions">
          ${u ? `<a class="btn btn-primary" href="#/app">Кабинетке өту</a>` :
            `<a class="btn btn-outline" href="#/login">Кіру</a><a class="btn btn-primary" href="#/register">Тіркелу</a>`}
        </div>
      </div></header>

      <section class="hero"><div class="container hero-grid">
        <div>
          <span class="pill">🔥 2027 ҰБТ форматы бойынша жаңартылды</span>
          <h1>Биологиядан ҰБТ-да <span class="grad-text">50/50</span> жинағың келе ме?</h1>
          <p class="lead">Тақырыптық және ҰБТ форматындағы 1000+ өзекті сұрақтар жинағы. Қатеңді бірге талдаймыз!</p>
          <div class="hero-cta">
            <a class="btn btn-cta btn-lg" href="#/demo">Тегін Демо-тестті бастау →</a>
            <a class="btn btn-ghost btn-lg" href="#/register">Тіркелу — 30 секунд</a>
          </div>
          <div class="hero-stats">
            <div><b>1000+</b><span>сұрақ</span></div>
            <div><b>12 400</b><span>түлек дайындалуда</span></div>
            <div><b>+11</b><span>балл орташа өсім</span></div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="float-badge fb1">💎 +20 XP</div>
          <div class="hero-card">
            <div class="q-meta"><span class="tag t-multi">Бірнеше дұрыс жауап</span><span class="tag">Цитология</span></div>
            <div class="q-mini">Прокариот жасушаларға тән белгілер:</div>
            <div class="opt-mini ok">✅ Қалыптасқан ядросы жоқ</div>
            <div class="opt-mini ok">✅ Сақина тәрізді ДНҚ</div>
            <div class="opt-mini">◻️ Митохондриялары бар</div>
            <div class="opt-mini ok">✅ 70S рибосомалар</div>
          </div>
          <div class="float-badge fb2">🔥 7 күн қатарынан</div>
        </div>
      </div></section>

      <section class="section"><div class="container">
        <div class="section-head"><h2>Неге дәл <span class="grad-text">BioҰБТ</span>?</h2><p class="muted">Тек жаттау емес — түсініп, нәтижеге жету.</p></div>
        <div class="features">${feats.map(f => `
          <div class="feature"><div class="ico" style="background:${f.bg}">${f.ico}</div><h3>${f.t}</h3><p>${f.d}</p></div>`).join("")}
        </div>
      </div></section>

      <section class="section" style="padding-top:0"><div class="container">
        <div class="section-head"><h2>Түлектер не дейді? 💬</h2><p class="muted">Жоғары балл жинаған оқушылардың өз сөздері</p></div>
        <div class="reviews">${window.TESTIMONIALS.map(t => `
          <div class="review">
            <div class="review-head">
              <div class="avatar" style="background:${t.grad}">${initials(t.name)}</div>
              <div><b>${esc(t.name)}</b><br><small class="muted">${esc(t.city)}</small></div>
              <span class="score">${t.score}</span>
            </div>
            <div class="stars">★★★★★</div>
            <p>${esc(t.text)}</p>
          </div>`).join("")}
        </div>
      </div></section>

      <section class="section" style="padding-top:0">
        <div class="cta-band container">
          <h2>10 сұрақ. 10 минут. Деңгейіңді біл! ⚡</h2>
          <p style="opacity:.9;margin:0 0 20px">Тіркелусіз тегін демо-тест тапсырып көр.</p>
          <a class="btn btn-cta btn-lg" href="#/demo">Тегін сынап көр</a>
        </div>
      </section>
      <footer class="footer">© ${new Date().getFullYear()} BioҰБТ · Биологиядан ҰБТ-ға дайындық платформасы</footer>`;
  }

  /* ================= Auth ================= */
  function renderAuth() {
    const isLogin = state.authTab === "login";
    app.innerHTML = `
      <div class="auth-wrap"><div class="auth-card">
        <a class="logo" href="#/"><span class="logo-mark">🧬</span>BioҰБТ</a>
        <div class="tabs" role="tablist">
          <button class="tab ${isLogin ? "active" : ""}" data-act="tab-login">Кіру</button>
          <button class="tab ${!isLogin ? "active" : ""}" data-act="tab-register">Тіркелу</button>
        </div>
        <div class="social-row">
          <button class="btn btn-social" data-act="social" data-p="google">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Google арқылы кіру</button>
          <button class="btn btn-tg" data-act="social" data-p="telegram">✈️ Telegram арқылы кіру</button>
        </div>
        <div class="divider">немесе</div>
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
          <button type="button" class="eye" data-act="eye" aria-label="Құпия сөзді көрсету">👁️</button></div></div>
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
      let user = null;
      if (looksLikeEmail(v)) user = Object.values(db.users).find(x => x.email && x.email.toLowerCase() === v.toLowerCase());
      else if (validPhone(v)) user = db.users[phoneDigits(v)];
      else { showErr(err, "Телефон нөмірін +7 (7XX) XXX-XX-XX форматында енгізіңіз."); id.classList.add("invalid"); return; }
      if (!user) { showErr(err, "Мұндай аккаунт табылмады. Алдымен тіркеліңіз."); return; }
      if (!user.pass) { showErr(err, "Бұл аккаунт Google/Telegram арқылы ашылған — жоғарыдағы батырманы басыңыз."); return; }
      if (user.pass !== hash(p)) { showErr(err, "Құпия сөз қате."); $("#l-pass").classList.add("invalid"); return; }
      setSession(user.id, $("#l-rem").checked);
      toast(`Қош келдің, ${user.name.split(" ")[0]}! 👋`);
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
        notify(user, "🎁", `Демо-тест нәтижесі сақталды: +${xp} XP`);
        saveUser(user);
      }
    }
    go("#/app");
  }

  function socialLogin(provider) {
    const id = provider + ":demo";
    toast(provider === "google" ? "Google аккаунты тексерілуде…" : "Telegram бот арқылы растау…");
    setTimeout(() => {
      let user = db.users[id];
      const isNew = !user;
      if (!user) {
        user = newUser(id, { name: provider === "google" ? "Google қолданушы" : "Telegram қолданушы", email: provider === "google" ? "student@gmail.com" : "" });
        notify(user, "🎉", "BioҰБТ-ға қош келдің! Алғашқы тестіңді тапсырып, XP жина.");
        saveUser(user);
      }
      setSession(id, true);
      if (isNew) {
        openModal(`<h3>Танысайық! 👋</h3><p class="muted">Сені қалай атайық?</p>
          <div class="field"><input class="input" id="s-name" placeholder="Мысалы: Аружан Нұрланова"></div>
          <div class="btn-row"><button class="btn btn-ghost" id="s-skip">Өткізу</button><button class="btn btn-primary" id="s-ok">Сақтау</button></div>`,
          (m, close) => {
            const done = () => { close(); afterLogin(user); };
            $("#s-skip", m).onclick = done;
            $("#s-ok", m).onclick = () => { const n = $("#s-name", m).value.trim(); if (n) { user.name = n; saveUser(user); } done(); };
          });
      } else afterLogin(user);
    }, 700);
  }

  function forgotModal() {
    openModal(`<h3>Құпия сөзді қалпына келтіру</h3>
      <p class="muted">Нөміріңді енгіз — қалпына келтіру кодын жібереміз.</p>
      <div class="field"><input class="input" id="f-phone" inputmode="tel" placeholder="+7 (7XX) XXX-XX-XX"></div>
      <div class="chips" style="margin-bottom:14px"><button class="chip active" data-ch="WhatsApp">💬 WhatsApp</button><button class="chip" data-ch="SMS">✉️ SMS</button></div>
      <div id="f-step2" class="hidden">
        <div class="field"><label>Код</label><input class="input" id="f-code" inputmode="numeric" maxlength="4" placeholder="4 таңбалы код"></div>
        <div class="field"><label>Жаңа құпия сөз</label><input class="input" id="f-new" type="password" placeholder="Кемінде 6 таңба"></div>
      </div>
      <div class="err hidden" id="f-err"></div>
      <div class="btn-row"><button class="btn btn-ghost" data-close>Жабу</button><button class="btn btn-primary" id="f-send">Жіберу</button></div>`,
      (m, close) => {
        let channel = "WhatsApp", code = null;
        bindPhoneMask($("#f-phone", m));
        $$(".chip", m).forEach(c => c.onclick = () => { $$(".chip", m).forEach(x => x.classList.remove("active")); c.classList.add("active"); channel = c.dataset.ch; });
        $("#f-send", m).onclick = () => {
          const ph = $("#f-phone", m).value, err = $("#f-err", m);
          if (!code) {
            if (!validPhone(ph)) return showErr(err, "Нөмірді дұрыс енгізіңіз.");
            if (!db.users[phoneDigits(ph)]) return showErr(err, "Бұл нөмір тіркелмеген.");
            code = String(Math.floor(1000 + Math.random() * 9000));
            err.classList.add("hidden");
            $("#f-step2", m).classList.remove("hidden");
            $("#f-send", m).textContent = "Сақтау";
            toast(`${channel}: қалпына келтіру коды — ${code} (демо)`);
          } else {
            if ($("#f-code", m).value !== code) return showErr(err, "Код қате.");
            if ($("#f-new", m).value.length < 6) return showErr(err, "Құпия сөз кемінде 6 таңба болуы керек.");
            const u = db.users[phoneDigits(ph)]; u.pass = hash($("#f-new", m).value); saveUser(u);
            close(); toast("✅ Құпия сөз жаңартылды. Енді кіре аласың!");
          }
        };
      });
  }

  /* ---- Registration (3 steps) ---- */
  function renderRegister() {
    if (!state.reg) state.reg = { step: 1, name: "", phone: "", code: null, verified: false, pass: "", target: 45, city: "", school: "", month: MONTHS[2], agree: false };
    const r = state.reg, body = $("#auth-body");
    const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= r.step ? "on" : ""}"></i>`).join("")}</div>`;

    if (r.step === 1) {
      body.innerHTML = steps + `
        <div class="step-title">1-қадам: Негізгі мәліметтер</div>
        <div class="field"><label for="r-name">Аты-жөні</label><input class="input" id="r-name" autocomplete="name" placeholder="Мысалы: Аружан Нұрланова" value="${esc(r.name)}"></div>
        <div class="field"><label for="r-phone">Телефон нөмірі</label>
          <div class="input-wrap"><input class="input" id="r-phone" inputmode="tel" autocomplete="tel" placeholder="+7 (7XX) XXX-XX-XX" value="${esc(r.phone)}" ${r.verified ? "disabled" : ""}>
          <button class="btn btn-primary ${validPhone(r.phone) && !r.verified ? "" : "hidden"}" id="r-send" type="button">Код жіберу</button></div>
          <div id="otp-box" class="${r.code && !r.verified ? "" : "hidden"}">
            <p class="hint">Нөміріңе келген 4 таңбалы SMS-кодты енгіз</p>
            <div class="otp">${[0, 1, 2, 3].map(i => `<input inputmode="numeric" maxlength="1" data-otp="${i}" aria-label="Код ${i + 1}">`).join("")}</div>
          </div>
          ${r.verified ? `<div class="verified">✅ Нөмір расталды</div>` : ""}
        </div>
        <div class="field"><label for="r-pass">Құпия сөз құрастыру</label>
          <div class="input-wrap"><input class="input" id="r-pass" type="password" autocomplete="new-password" placeholder="Кемінде 6 таңба" value="${esc(r.pass)}">
          <button type="button" class="eye" data-act="eye" aria-label="Құпия сөзді көрсету">👁️</button></div>
          <div class="strength"><i id="r-str"></i></div><div class="hint" id="r-str-l">Әріп, сан және белгі қоссаң — құпия сөз күшті болады</div>
        </div>
        <div class="err hidden" id="r-err"></div>
        <button class="btn btn-primary btn-lg btn-block" id="r-next">Әрі қарай →</button>`;
      const ph = $("#r-phone"), send = $("#r-send");
      bindPhoneMask(ph);
      ph.addEventListener("input", () => { r.phone = ph.value; r.code = null; send.classList.toggle("hidden", !validPhone(ph.value)); $("#otp-box").classList.add("hidden"); });
      $("#r-name").addEventListener("input", e => r.name = e.target.value);
      send.onclick = () => {
        if (db.users[phoneDigits(r.phone)]) return showErr($("#r-err"), "Бұл нөмір бұрын тіркелген. «Кіру» бөліміне өт.");
        r.code = String(Math.floor(1000 + Math.random() * 9000));
        toast(`📩 SMS-код: ${r.code} (демо режим)`);
        $("#otp-box").classList.remove("hidden");
        send.textContent = "Қайта жіберу";
        $("[data-otp='0']").focus();
      };
      const otps = $$("[data-otp]");
      otps.forEach((inp, i) => {
        inp.addEventListener("input", () => {
          inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
          if (inp.value && otps[i + 1]) otps[i + 1].focus();
          const val = otps.map(o => o.value).join("");
          if (val.length === 4) {
            if (val === r.code) { r.verified = true; toast("✅ Нөмір расталды!"); renderRegister(); }
            else { otps.forEach(o => { o.value = ""; o.classList.add("invalid"); }); otps[0].focus(); toast("Код қате, қайтадан енгіз"); }
          }
        });
        inp.addEventListener("keydown", e => { if (e.key === "Backspace" && !inp.value && otps[i - 1]) otps[i - 1].focus(); });
      });
      const pass = $("#r-pass");
      const upd = () => { r.pass = pass.value; const s = passStrength(pass.value); $("#r-str").style.width = s.pct + "%"; $("#r-str").style.background = s.color; if (s.label) $("#r-str-l").textContent = "Сенімділігі: " + s.label; };
      pass.addEventListener("input", upd); upd();
      $("#r-next").onclick = () => {
        const err = $("#r-err");
        if (r.name.trim().length < 2) return showErr(err, "Аты-жөніңді енгіз.");
        if (!validPhone(r.phone)) return showErr(err, "Телефон нөмірін толық енгіз.");
        if (!r.verified) return showErr(err, "Нөмірді SMS-код арқылы раста.");
        if (r.pass.length < 6) return showErr(err, "Құпия сөз кемінде 6 таңба болуы керек.");
        r.step = 2; renderRegister();
      };
    }

    if (r.step === 2) {
      body.innerHTML = steps + `
        <div class="step-title">2-қадам: Профиліңді баптайық 🎯</div>
        <div class="field"><label for="r-target">Нысаналы балл (биология)</label>
          <div class="range-val"><span class="grad-text" id="r-tv">${r.target}</span><span class="muted" style="font-size:20px">/50</span></div>
          <input type="range" id="r-target" min="10" max="50" step="1" value="${r.target}">
        </div>
        <div class="field"><label for="r-city">Қала</label><input class="input" id="r-city" list="cities" placeholder="Тізімнен таңда немесе жаз" value="${esc(r.city)}">
          <datalist id="cities">${window.CITIES.map(c => `<option value="${c}">`).join("")}</datalist></div>
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
        <div class="step-title">3-қадам: Соңғы қадам ✨</div>
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
        const id = phoneDigits(r.phone);
        const user = newUser(id, { name: r.name.trim(), phone: formatPhone(r.phone), pass: hash(r.pass), target: r.target, city: r.city.trim(), school: r.school.trim(), month: r.month });
        notify(user, "🎉", "BioҰБТ-ға қош келдің! Алғашқы тестіңді тапсырып, XP жина.");
        notify(user, "🌿", "Жаңа ботаника тесті қосылды — «Тақырыптық тесттер» бөлімін қара!");
        saveUser(user);
        setSession(id, true);
        state.reg = null;
        toast("🎉 Тіркелу сәтті аяқталды!", "xp");
        afterLogin(user);
      };
    }
  }

  /* ================= App shell ================= */
  const NAV = [
    { id: "dashboard",   ico: "🏠", t: "Басты бет" },
    { id: "topics",      ico: "📚", t: "Тақырыптық тесттер" },
    { id: "mock",        ico: "📝", t: "Толық ҰБТ сынамасы" },
    { id: "mistakes",    ico: "❌", t: "Қателер банкі" },
    { id: "notes",       ico: "📖", t: "Конспектілер" },
    { id: "leaderboard", ico: "🏆", t: "Рейтинг" },
    { id: "settings",    ico: "⚙️", t: "Баптаулар / Профиль" }
  ];

  function shell(u, active, inner) {
    const unread = u.notifications.filter(n => !n.read).length;
    const mc = mistakesCount(u);
    const cheer = CHEERS[new Date().getDate() % CHEERS.length];
    return `
      <div class="shell">
        <aside class="sidebar" id="sidebar">
          <a class="logo" href="#/"><span class="logo-mark">🧬</span>BioҰБТ</a>
          ${NAV.map(n => `<a class="nav-item ${active === n.id || (active === "topic" && n.id === "topics") ? "active" : ""}" href="#/app/${n.id}">
            <span class="ni">${n.ico}</span>${n.t}${n.id === "mistakes" && mc ? `<span class="count">${mc}</span>` : ""}</a>`).join("")}
          ${u.premium ? "" : `<div class="sidebar-promo"><b>⭐ Премиум</b>Шексіз ҰБТ сынамалары мен барлық конспектілер.<br>
            <button class="btn btn-cta btn-block" style="margin-top:10px;padding:10px" data-act="upgrade">Тарифті жаңарту</button></div>`}
        </aside>
        <div class="backdrop" id="backdrop" data-act="close-menu"></div>
        <div class="main-col">
          <header class="header">
            <button class="burger" data-act="menu" aria-label="Мәзір">☰</button>
            <div class="greet">
              <div class="avatar">${esc(initials(u.name))}</div>
              <div style="min-width:0"><h3>Сәлем, ${firstName(u)}! 👋</h3><small>${cheer}</small></div>
            </div>
            <div class="header-right">
              <span class="stat-pill" title="Күн қатарынан">🔥 ${streak(u)}<span class="lbl">&nbsp;күн</span></span>
              <span class="stat-pill xp-pill" title="Тәжірибе ұпайлары">💎 ${fmtNum(u.xp)}<span class="lbl">&nbsp;XP</span></span>
              ${u.premium ? `<span class="tariff pro">⭐ Премиум рұқсат (ҰБТ-ға дейін активті)</span>` :
                `<span class="tariff free">Тегін режим</span><button class="btn btn-cta btn-upgrade" data-act="upgrade">⭐<span class="up-txt">&nbsp;Тарифті жаңарту</span></button>`}
              <button class="bell" data-act="bell" aria-label="Хабарламалар">🔔${unread ? `<span class="dot"></span>` : ""}</button>
            </div>
            <div id="notif-pop" class="notif-pop hidden"></div>
          </header>
          <main class="content">${inner}</main>
        </div>
      </div>`;
  }

  function renderApp(u, page, arg) {
    const pages = { dashboard: pageDashboard, topics: pageTopics, topic: pageTopic, mock: pageMock, mistakes: pageMistakes, notes: pageNotes, leaderboard: pageLeaderboard, settings: pageSettings };
    const fn = pages[page] || pageDashboard;
    app.innerHTML = shell(u, page, fn(u, arg));
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
    return `<div class="card"><h3>📅 Апталық белсенділік</h3><p class="muted" style="margin:0;font-size:14px">Осы аптада: <b>${total}</b> тест</p>
      <div class="chart">${days.map(d => { const v = u.activity[d.k] || 0; return `
        <div class="col ${d.today ? "today" : ""}"><em>${v || ""}</em><i style="height:${Math.max(4, v / max * 100)}%"></i><span>${d.l}</span></div>`; }).join("")}
      </div></div>`;
  }

  function lbWidget(u, full) {
    const rows = leaderboard(u), me = rows.find(r => r.me);
    const medal = r => r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank;
    const row = r => `<div class="lb-row ${r.me ? "me" : ""}"><span class="lb-rank">${medal(r)}</span>
      <span class="lb-name">${esc(r.me ? `Сен (${(u.name || "Түлек").split(" ")[0]})` : r.name)}</span>
      <span class="lb-xp">${fmtNum(r.xp)} XP</span><span class="lb-score">(${r.score} балл)</span></div>`;
    if (full) return rows.map(row).join("");
    const top = rows.slice(0, 5);
    return top.map(row).join("") + (me.rank > 5 ? `<div class="lb-gap">⋯</div>${row(me)}` : "");
  }

  function badgesHtml(u) {
    return `<div class="badges">${window.BADGES.map(b => `
      <div class="badge ${u.badges.includes(b.id) ? "" : "locked"}" title="${esc(b.desc)}"><span class="b-ico">${b.icon}</span><b>${b.title}</b><small>${b.desc}</small></div>`).join("")}</div>`;
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
              <div class="row-between" style="margin:0 0 6px"><span>🎯 Мақсат: <b>${u.target} балл</b></span><span>Қазіргі орташа: <b>${avg} балл</b></span></div>
              <div class="bar"><i style="width:${avg / 50 * 100}%"></i><span class="mark" style="left:calc(${u.target / 50 * 100}% - 1px)"></span></div>
              <p class="hint">${avg >= u.target && u.history.length ? "🎉 Мақсатқа жеттің! Енді нәтижені тұрақтандыр." : `Мақсатқа дейін: <b>${Math.max(0, u.target - avg)}</b> балл`}</p>
            </div>
          </div>
        </div>
        ${weekChart(u)}
      </div>

      <h2 style="margin:26px 0 12px;font-size:20px">⚡ Жылдам бастау</h2>
      <div class="grid g-3">
        <button class="qa-card qa-1" data-act="start-mock"><span class="qa-ico">🎯</span><h3>Толық ҰБТ сынамасын бастау</h3>
          <p>${MOCK_SIZE} сұрақ / ${MOCK_MIN} минут · кері санақ таймері · жаңа формат</p><span class="go">Бастау →</span></button>
        <button class="qa-card qa-2" data-act="start-mistakes"><span class="qa-ico">🔄</span><h3>Қателермен жұмыс</h3>
          <p>Сенің әлсіз тұстарың</p>
          ${weak ? `<span class="warn">⚠️ Сізде ${weak.m.abl} ${weak.n} қате бар, қайталау керек!</span>` : `<span class="warn">Әзірге қате жоқ — керемет! 🌟</span>`}
          <span class="go">Қайталау →</span></button>
        <button class="qa-card qa-3" data-act="start-express"><span class="qa-ico">⚡</span><h3>Күнделікті 10 сұрақтық экспресс-тест</h3>
          <p>Жылдам жаттығу · әр жауаптан кейін талдау</p><span class="go">Бастау →</span></button>
      </div>

      <h2 style="margin:26px 0 12px;font-size:20px">📚 Тақырыптық модульдер</h2>
      <div class="grid g-4">${MODULES.map(m => moduleCard(u, m)).join("")}</div>

      <div class="grid g-2" style="margin-top:26px">
        <div class="card"><h3>🏆 Апталық үздік 5 түлек</h3>${lbWidget(u)}
          <a class="btn btn-ghost btn-block" style="margin-top:12px" href="#/app/leaderboard">Толық рейтингті көру</a></div>
        <div class="card"><h3>🏅 Жетістік белгілері <span class="muted" style="font-weight:600">${u.badges.length}/${window.BADGES.length}</span></h3>${badgesHtml(u)}</div>
      </div>`;
  }

  function moduleCard(u, m) {
    const p = moduleProgress(u, m.id), pct = Math.round(p.solved / p.total * 100);
    return `<a class="card module-card" href="#/app/topic/${m.id}" style="color:inherit">
      <div class="m-head"><span class="m-ico">${m.icon}</span><div><h4>${m.title}</h4><small>${m.desc}</small></div></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="m-foot"><span>${pct}% · ${p.solved}/${p.total}</span><span>${p.mistakes ? `❌ ${p.mistakes} қате` : "✨"}</span></div></a>`;
  }

  /* ---- Topics ---- */
  function pageTopics(u) {
    return `<h1 class="page-title">📚 Тақырыптық тесттер</h1><p class="page-sub">Биология бөлімдері бойынша жаттығу. Әр жауаптан кейін толық түсініктеме көрсетіледі.</p>
      <div class="grid g-3">${MODULES.map(m => moduleCard(u, m)).join("")}</div>`;
  }

  function pageTopic(u, id) {
    const m = MODULES.find(x => x.id === id);
    if (!m) return pageTopics(u);
    const p = moduleProgress(u, id), pct = Math.round(p.solved / p.total * 100);
    return `<a href="#/app/topics" class="muted">← Барлық тараулар</a>
      <div class="card" style="margin:12px 0 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <span class="m-ico" style="width:64px;height:64px;border-radius:18px;background:var(--purple-50);display:grid;place-items:center;font-size:34px">${m.icon}</span>
        <div style="flex:1;min-width:200px"><h1 class="page-title">${m.title}</h1><p class="muted" style="margin:0 0 8px">${m.desc}</p>
          <div class="bar"><i style="width:${pct}%"></i></div><small class="muted">${pct}% аяқталды · ${p.total} сұрақ · ${p.mistakes} қате</small></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-cta" data-act="start-topic" data-id="${m.id}">▶ Тақырыптық тест</button>
          ${p.mistakes ? `<button class="btn btn-ghost" data-act="start-mistakes" data-id="${m.id}">🔄 Қателерді қайталау</button>` : ""}
        </div>
      </div>
      <div class="grid g-2">
        <div class="card cheat"><h3>📖 Қысқаша шпаргалка</h3><ul>${m.cheat.map(c => `<li>${c}</li>`).join("")}</ul></div>
        <div class="card"><h3>🧮 Есептердің шешілу жолдары</h3>
          ${m.examples.length ? m.examples.map(e => `<div class="example"><b>Есеп:</b> ${e.q}<br><b style="color:var(--green)">Шешуі:</b> ${e.a}</div>`).join("") :
            `<p class="muted">Бұл тарауда есептер жоқ — теорияға және тест сұрақтарына назар аудар.</p>`}
        </div>
      </div>`;
  }

  /* ---- Mock ---- */
  function rulesHtml() {
    return `<div class="rules"><h3>📏 Балл жүйесі</h3><p class="muted" style="margin:0">Әр сұрақ — ең көбі 2 балл. Қате нұсқа белгіленсе — 0 балл.</p>
      <table><thead><tr><th>Дұрыс жауап саны</th><th>2 балл</th><th>1 балл</th><th>0 балл</th></tr></thead><tbody>
      <tr><td>3 дұрыс жауап</td><td>3-еуі де дұрыс</td><td>2 дұрыс</td><td>1, 4, 5 белгіленсе</td></tr>
      <tr><td>2 дұрыс жауап</td><td>2-еуі де дұрыс</td><td>1 дұрыс</td><td>3, 4, 5 белгіленсе</td></tr>
      <tr><td>1 дұрыс жауап</td><td>1 дұрыс</td><td>—</td><td>2, 3, 4, 5 белгіленсе</td></tr></tbody></table></div>`;
  }

  function pageMock(u) {
    const mocks = u.history.filter(h => h.mode === "mock").slice(-8).reverse();
    const left = u.premium ? "∞" : Math.max(0, FREE_MOCKS - u.mocks);
    return `<h1 class="page-title">📝 Толық ҰБТ сынамасы</h1><p class="page-sub">Нақты ҰБТ жағдайын модельдеу: таймер, жаңа формат, нәтиже мен толық талдау.</p>
      <div class="grid g-2">
        <div class="card">
          <h3>🎯 ${Math.min(MOCK_SIZE, Q.length)} сұрақ · ${MOCK_MIN} минут</h3>
          <ul class="muted" style="padding-left:18px"><li>Бір және бірнеше дұрыс жауабы бар сұрақтар</li><li>Контекстік тапсырмалар</li><li>Уақыт біткенде тест автоматты түрде аяқталады</li><li>Нәтиже 50 балдық шкалаға келтіріледі</li></ul>
          <p>Қалған тегін әрекет: <b>${left}</b></p>
          <button class="btn btn-cta btn-lg btn-block" data-act="start-mock">Сынаманы бастау</button>
        </div>
        <div class="card">${rulesHtml()}</div>
      </div>
      <div class="card" style="margin-top:16px"><h3>📈 Соңғы сынамалар</h3>
        ${mocks.length ? mocks.map(h => `<div class="lb-row"><span class="lb-name">${new Date(h.date).toLocaleDateString("kk-KZ")}</span>
          <span class="lb-xp">${h.scaled}/50</span><span class="lb-score">${h.score}/${h.max} · ${h.pct}%</span></div>`).join("") :
          `<p class="muted">Әзірге сынама тапсырылмаған. Алғашқысын баста! 💪</p>`}
      </div>`;
  }

  /* ---- Mistakes ---- */
  function pageMistakes(u) {
    const ids = Object.keys(u.mistakes).filter(id => QBY[id]);
    if (!ids.length) return `<h1 class="page-title">❌ Қателер банкі</h1>
      <div class="card empty"><div class="e-ico">🌟</div><h3>Қателер банкі бос</h3><p>Тест тапсыр — қате жіберген сұрақтарың осында жиналады.</p>
      <button class="btn btn-primary" data-act="start-express">Экспресс-тест тапсыру</button></div>`;
    const byMod = MODULES.map(m => ({ m, list: ids.filter(id => QBY[id].module === m.id) })).filter(x => x.list.length);
    return `<h1 class="page-title">❌ Қателер банкі</h1><p class="page-sub">Сенде <b>${ids.length}</b> қате сұрақ бар. Дұрыс жауап берсең, сұрақ банктен өшіріледі. Түзетілгені: <b>${u.fixed}</b></p>
      <button class="btn btn-cta btn-lg" data-act="start-mistakes" style="margin-bottom:16px">🔄 Барлығын қайта тапсыру</button>
      <div class="grid g-2">${byMod.map(x => `
        <div class="card"><div class="row-between" style="margin:0 0 10px"><h3 style="margin:0">${x.m.icon} ${x.m.title} <span class="muted">· ${x.list.length}</span></h3>
          <button class="btn btn-ghost" style="padding:8px 12px" data-act="start-mistakes" data-id="${x.m.id}">Қайталау</button></div>
          ${x.list.map(id => `<p style="margin:0 0 8px;font-size:14.5px">• ${QBY[id].q}</p>`).join("")}</div>`).join("")}
      </div>`;
  }

  /* ---- Notes ---- */
  function pageNotes(u) {
    return `<div class="row-between" style="margin:0"><div><h1 class="page-title">📖 Конспектілер мен шпаргалкалар</h1><p class="page-sub">Әр тараудың ең маңызды фактілері — бір жерде.</p></div>
      <button class="btn btn-primary no-print" data-act="${u.premium ? "print" : "upgrade"}">📄 PDF ретінде сақтау ${u.premium ? "" : "⭐"}</button></div>
      <div class="grid g-2">${MODULES.map(m => `
        <div class="card cheat"><h3>${m.icon} ${m.title}</h3><ul>${m.cheat.map(c => `<li>${c}</li>`).join("")}</ul>
          ${m.examples.map(e => `<div class="example"><b>Есеп:</b> ${e.q}<br><b style="color:var(--green)">Шешуі:</b> ${e.a}</div>`).join("")}</div>`).join("")}
      </div>`;
  }

  /* ---- Leaderboard ---- */
  function pageLeaderboard(u) {
    return `<h1 class="page-title">🏆 Рейтинг</h1><p class="page-sub">Апталық үздік түлектер. Сенің орның: <b>${myRank(u)}</b>. Тест тапсырып, XP жина!</p>
      <div class="card">${lbWidget(u, true)}</div>`;
  }

  /* ---- Settings ---- */
  function pageSettings(u) {
    const theme = store.get(THEME_KEY, "auto");
    return `<h1 class="page-title">⚙️ Баптаулар / Профиль</h1><p class="page-sub">Деректеріңді өзгерт, құпия сөзді ауыстыр.</p>
      <div class="grid g-2">
        <form class="card" id="profile-form">
          <h3>👤 Профиль</h3>
          <div class="field"><label>Аты-жөні</label><input class="input" name="name" value="${esc(u.name)}"></div>
          <div class="field"><label>Телефон</label><input class="input" value="${esc(u.phone || u.email || "—")}" disabled></div>
          <div class="field"><label>Нысаналы балл: <b id="s-tv">${u.target}</b>/50</label><input type="range" name="target" min="10" max="50" value="${u.target}"></div>
          <div class="field"><label>Қала</label><input class="input" name="city" list="cities2" value="${esc(u.city)}"><datalist id="cities2">${window.CITIES.map(c => `<option value="${c}">`).join("")}</datalist></div>
          <div class="field"><label>Мектеп</label><input class="input" name="school" value="${esc(u.school)}"></div>
          <div class="field"><label>ҰБТ айы</label><select class="input" name="month">${MONTHS.map(m => `<option ${m === u.month ? "selected" : ""}>${m}</option>`).join("")}</select></div>
          <button class="btn btn-primary btn-block">Сақтау</button>
        </form>
        <div class="grid" style="align-content:start">
          <form class="card" id="pass-form">
            <h3>🔒 Құпия сөзді ауыстыру</h3>
            ${u.pass ? `<div class="field"><input class="input" type="password" name="old" placeholder="Қазіргі құпия сөз" autocomplete="current-password"></div>` : `<p class="hint">Аккаунт әлеуметтік желі арқылы ашылған — құпия сөз орнатуға болады.</p>`}
            <div class="field"><input class="input" type="password" name="new" placeholder="Жаңа құпия сөз" autocomplete="new-password"></div>
            <button class="btn btn-ghost btn-block">Жаңарту</button>
          </form>
          <div class="card"><h3>🎨 Тақырып</h3><div class="chips">
            ${[["auto", "🌓 Авто"], ["light", "☀️ Жарық"], ["dark", "🌙 Қараңғы"]].map(([v, l]) => `<button class="chip ${theme === v ? "active" : ""}" data-act="theme" data-v="${v}">${l}</button>`).join("")}</div></div>
          <div class="card"><h3>🏅 Жетістіктерім</h3>${badgesHtml(u)}</div>
          <div class="card"><div class="btn-row" style="margin:0">
            <button class="btn btn-outline" data-act="reset">Прогресті тазалау</button>
            <button class="btn btn-outline" style="color:var(--red)" data-act="logout">Шығу</button></div></div>
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
      saveUser(u); toast("✅ Профиль сақталды"); render();
    });
    const ps = $("#pass-form");
    ps.addEventListener("submit", e => {
      e.preventDefault();
      const f = ps.elements;
      if (u.pass && hash(f.old.value) !== u.pass) return toast("Қазіргі құпия сөз қате");
      if (f.new.value.length < 6) return toast("Жаңа құпия сөз кемінде 6 таңба");
      u.pass = hash(f.new.value); saveUser(u); ps.reset(); toast("✅ Құпия сөз жаңартылды");
    });
  }

  function applyTheme() {
    const t = store.get(THEME_KEY, "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  /* ================= Tests ================= */
  function pick(list, n) { return shuffle(list).slice(0, Math.min(n, list.length)); }
  function buildDemo() { return { mode: "demo", title: "Тегін демо-тест", questions: pick(Q, DEMO_SIZE), timeLimit: 10 * 60, instant: false }; }

  function buildMock(u) {
    // ҰБТ құрылымына жақын: алдымен бір жауаптылар, содан кейін контекстік, соңында бірнеше жауаптылар
    const qs = pick(Q, MOCK_SIZE);
    const order = { single: 0, context: 1, multi: 2 };
    qs.sort((a, b) => order[a.type] - order[b.type]);
    return { mode: "mock", title: "Толық ҰБТ сынамасы", questions: qs, timeLimit: MOCK_MIN * 60, instant: false };
  }

  function startTest(t) {
    t.answers = t.questions.map(() => []);
    t.checked = t.questions.map(() => false);
    t.cur = 0; t.startedAt = Date.now();
    state.test = t; state.result = null;
    go("#/test");
  }

  function startMode(mode, id) {
    const u = currentUser();
    if (!u) return go("#/login");
    if (mode === "mock") {
      if (!u.premium && u.mocks >= FREE_MOCKS) return upgradeModal(`Тегін режимде ${FREE_MOCKS} толық сынама қолжетімді. Шексіз сынама үшін Премиумға өт!`);
      return startTest(buildMock(u));
    }
    if (mode === "express") return startTest({ mode: "express", title: "⚡ Экспресс-тест (10 сұрақ)", questions: pick(Q, EXPRESS_SIZE), instant: true });
    if (mode === "topic") {
      const m = MODULES.find(x => x.id === id);
      return startTest({ mode: "topic", title: `${m.icon} ${m.title}`, questions: shuffle(Q.filter(q => q.module === id)), instant: true, module: id });
    }
    if (mode === "mistakes") {
      const list = Object.keys(u.mistakes).map(k => QBY[k]).filter(q => q && (!id || q.module === id));
      if (!list.length) { toast("Қателер банкі бос — керемет! 🌟"); return go("#/app/mistakes"); }
      return startTest({ mode: "mistakes", title: "🔄 Қателермен жұмыс", questions: shuffle(list), instant: true });
    }
  }

  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = null; } }
  function timeLeft(t) { return t.timeLimit ? Math.max(0, t.timeLimit - Math.floor((Date.now() - t.startedAt) / 1000)) : null; }
  const fmtTime = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

  function renderTest() {
    const t = state.test, q = t.questions[t.cur], sel = t.answers[t.cur], multi = isMulti(q), checked = t.checked[t.cur];
    const answered = t.answers.filter(a => a.length).length;
    const typeTag = q.type === "context" ? `<span class="tag t-context">📄 Контекстік тапсырма</span>` :
      multi ? `<span class="tag t-multi">☑️ Бір немесе бірнеше дұрыс жауап</span>` : `<span class="tag t-single">⚪ Бір дұрыс жауап</span>`;
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
        <div class="q-meta"><span class="tag">${t.cur + 1} / ${t.questions.length}</span>${typeTag}<span class="tag">${modTitle(q.module)}</span>
          ${checked ? `<span class="pts p${pts}">${pts} балл</span>` : ""}</div>
        ${q.context ? `<div class="context-box">${q.context}</div>` : ""}
        <div class="q-text">${q.q}</div>
        <div class="opts">${q.options.map((o, i) => `
          <button class="opt ${multi ? "multi" : "single"} ${optClass(i)}" data-act="pick" data-i="${i}" ${checked ? "disabled" : ""} aria-pressed="${sel.includes(i)}">
            <span class="letter">${LETTERS[i]}</span><span>${o}</span></button>`).join("")}
        </div>
        ${checked ? `<div class="explain"><b>💡 Түсініктеме:</b> ${q.explain}<br><small class="muted">Дұрыс жауап: ${q.correct.map(i => LETTERS[i]).join(", ")}</small></div>` : ""}
        <div class="q-nav">
          <button class="btn btn-ghost" data-act="prev" ${t.cur === 0 ? "disabled" : ""}>← Алдыңғы</button>
          ${t.instant && !checked ? `<button class="btn btn-primary" data-act="check" ${sel.length ? "" : "disabled"}>Тексеру</button>` :
            isLast ? `<button class="btn btn-cta" data-act="finish">Тестті аяқтау ✓</button>` : `<button class="btn btn-primary" data-act="next">Келесі →</button>`}
        </div>
      </div>
      <div class="q-grid">${t.questions.map((qq, i) => {
        let c = t.answers[i].length ? "done" : "";
        if (t.checked[i]) { const p = scorePoints(qq, t.answers[i]); c = p === 2 ? "r-ok" : p === 1 ? "r-part" : "r-bad"; }
        return `<button class="${c} ${i === t.cur ? "cur" : ""}" data-act="goto" data-i="${i}">${i + 1}</button>`; }).join("")}
      </div>
    </div>`;

    if (u && t.mode !== "demo") app.innerHTML = shell(u, "test", inner);
    else app.innerHTML = `<header class="topbar"><div class="container"><a class="logo" href="#/"><span class="logo-mark">🧬</span>BioҰБТ</a>
      <a class="btn btn-ghost" href="#/register">Тіркелу</a></div></header><div class="content" style="margin:0 auto">${inner}</div>`;

    stopTimer();
    if (t.timeLimit) state.timer = setInterval(() => {
      const left = timeLeft(t), el = $("#timer");
      if (el) { el.textContent = "⏱ " + fmtTime(left); el.classList.toggle("low", left < 300); }
      if (left <= 0) { stopTimer(); toast("⏰ Уақыт бітті! Тест аяқталды."); finishTest(); }
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
    if (xp) setTimeout(() => toast(`💎 +${xp} XP`, "xp"), 300);
    go("#/result");
  }

  function renderResult() {
    const { test: t, res, xp } = state.result, u = currentUser();
    const msg = res.pct >= 90 ? "Керемет! Сен 50/50-ге дайынсың! 🏆" : res.pct >= 70 ? "Жақсы нәтиже! Аз ғана қалды 💪" : res.pct >= 40 ? "Жаман емес! Қателерді талдап, қайталайық 📚" : "Бастама жасалды! Түсініктемелерді оқып шық 🌱";
    const inner = `<div class="test-wrap">
      <div class="result-hero">
        <div style="font-size:15px;opacity:.9">${esc(t.title)}</div>
        <div class="big">${res.scaled}<span style="font-size:24px;opacity:.8">/50</span></div>
        <p>${res.score} / ${res.max} балл · ${res.pct}%${xp ? ` · 💎 +${xp} XP` : ""}</p>
        <p style="font-weight:700">${msg}</p>
      </div>
      <div class="result-stats">
        <div class="card"><b style="color:var(--green)">${res.full}</b><span>толық дұрыс (2 балл)</span></div>
        <div class="card"><b style="color:var(--amber)">${res.part}</b><span>жартылай (1 балл)</span></div>
        <div class="card"><b style="color:var(--red)">${res.zero}</b><span>қате (0 балл)</span></div>
        <div class="card"><b>${t.timeLimit ? fmtTime(Math.min(t.timeLimit, Math.floor((Date.now() - t.startedAt) / 1000))) : t.questions.length}</b><span>${t.timeLimit ? "жұмсалған уақыт" : "сұрақ"}</span></div>
      </div>
      ${!u ? `<div class="card" style="text-align:center;margin-bottom:18px;border:2px solid var(--pink)">
        <h3>🎁 Нәтижеңді сақтап, ${res.full * 10 + res.part * 4} XP ал!</h3><p class="muted">Тіркелсең, қателерің «Қателер банкіне» түседі және жеке статистикаң жүргізіледі.</p>
        <a class="btn btn-cta btn-lg" href="#/register">Тіркелу — 30 секунд</a></div>` : `
        <div class="btn-row" style="margin-bottom:18px"><a class="btn btn-primary" href="#/app">🏠 Басты бетке</a>
          ${res.zero + res.part ? `<button class="btn btn-cta" data-act="start-mistakes">🔄 Қателермен жұмыс</button>` : ""}</div>`}
      <h2 style="font-size:20px">🔍 Толық талдау</h2>
      ${t.questions.map((q, i) => {
        const sel = t.answers[i], p = res.per[i];
        const cls = j => { const ok = q.correct.includes(j), s = sel.includes(j); return ok && s ? "ok" : s ? "bad" : ok ? "miss" : ""; };
        return `<div class="q-card review-item">
          <div class="q-meta"><span class="tag">${i + 1}</span><span class="tag">${modTitle(q.module)}</span><span class="pts p${p}">${p} балл</span>${sel.length ? "" : `<span class="tag">Жауап берілмеген</span>`}</div>
          ${q.context ? `<div class="context-box">${q.context}</div>` : ""}
          <div class="q-text">${q.q}</div>
          <div class="opts">${q.options.map((o, j) => `<div class="opt ${isMulti(q) ? "multi" : "single"} ${cls(j)}"><span class="letter">${LETTERS[j]}</span><span>${o}</span></div>`).join("")}</div>
          <div class="explain"><b>💡 Түсініктеме:</b> ${q.explain}</div></div>`; }).join("")}
      <div class="card" style="margin-top:8px">${rulesHtml()}</div>
    </div>`;
    if (u) app.innerHTML = shell(u, "result", inner);
    else app.innerHTML = `<header class="topbar"><div class="container"><a class="logo" href="#/"><span class="logo-mark">🧬</span>BioҰБТ</a>
      <a class="btn btn-primary" href="#/register">Тіркелу</a></div></header><div class="content" style="margin:0 auto">${inner}</div>`;
  }

  /* ================= Modals ================= */
  function upgradeModal(reason) {
    openModal(`<h3>⭐ Премиум рұқсат</h3>
      ${reason ? `<p class="muted">${reason}</p>` : ""}
      <ul style="padding-left:18px"><li>Шексіз толық ҰБТ сынамалары</li><li>Барлық конспектілерді PDF-ке сақтау</li><li>1000+ сұрақ толық талдауымен</li><li>ҰБТ-ға дейін белсенді</li></ul>
      <div class="card" style="text-align:center;background:var(--surface-2);border:0;margin-bottom:14px"><b style="font-size:28px">4 990 ₸</b><span class="muted"> / ҰБТ-ға дейін</span></div>
      <button class="btn btn-cta btn-lg btn-block" id="up-ok">Премиумды қосу</button>
      <p class="hint" style="text-align:center">Демо режим: төлем алынбайды.</p>`,
      (m, close) => {
        $("#up-ok", m).onclick = () => {
          const u = currentUser(); if (!u) return close();
          u.premium = true; notify(u, "⭐", "Премиум рұқсат белсендірілді! ҰБТ-ға дейін белсенді."); saveUser(u);
          close(); toast("⭐ Премиум белсендірілді!", "xp"); render();
        };
      });
  }

  function toggleNotifs() {
    const u = currentUser(), pop = $("#notif-pop"); if (!u || !pop) return;
    state.notifOpen = !state.notifOpen;
    if (!state.notifOpen) return pop.classList.add("hidden");
    pop.innerHTML = u.notifications.length ? u.notifications.slice(0, 8).map(n => `
      <div class="notif"><span style="font-size:20px">${n.icon}</span><div>${esc(n.text)}<time>${new Date(n.time).toLocaleString("kk-KZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div></div>`).join("") :
      `<div class="notif muted">Хабарлама жоқ</div>`;
    pop.classList.remove("hidden");
    u.notifications.forEach(n => n.read = true); saveUser(u);
    const dot = $(".bell .dot"); if (dot) dot.remove();
  }

  /* ================= Events ================= */
  const actions = {
    "tab-login": () => go("#/login"),
    "tab-register": () => go("#/register"),
    social: el => socialLogin(el.dataset.p),
    forgot: forgotModal,
    terms: () => openModal(`<h3>Қолданушы келісімі</h3><p class="muted">Платформаны пайдалана отырып, сіз дербес деректеріңіздің (аты-жөні, телефон нөмірі, мектеп) тек оқу статистикасын жүргізу мақсатында өңделуіне келісесіз. Деректер үшінші тұлғаларға берілмейді. Тест материалдарын рұқсатсыз көшіріп таратуға тыйым салынады.</p><button class="btn btn-primary btn-block" data-close>Түсінікті</button>`),
    eye: el => { const inp = el.parentElement.querySelector("input"); inp.type = inp.type === "password" ? "text" : "password"; el.textContent = inp.type === "password" ? "👁️" : "🙈"; },
    menu: () => { $("#sidebar").classList.add("open"); $("#backdrop").classList.add("show"); },
    "close-menu": () => { $("#sidebar").classList.remove("open"); $("#backdrop").classList.remove("show"); },
    bell: toggleNotifs,
    upgrade: () => upgradeModal(),
    print: () => window.print(),
    theme: el => { store.set(THEME_KEY, el.dataset.v); applyTheme(); render(); },
    logout: () => confirmModal("Шығу", "Аккаунттан шыққыңыз келе ме?", "Шығу", () => { store.del(SESSION_KEY); memSession = null; go("#/"); }),
    reset: () => confirmModal("Прогресті тазалау", "XP, статистика, қателер банкі және жетістіктер өшіріледі. Жалғастырасыз ба?", "Тазалау", () => {
      const u = currentUser();
      Object.assign(u, { xp: 0, mocks: 0, history: [], solved: {}, mistakes: {}, fixed: 0, activity: {}, modulesTried: {}, badges: [] });
      saveUser(u); toast("Прогресс тазаланды"); render();
    }),
    "start-mock": () => startMode("mock"),
    "start-express": () => startMode("express"),
    "start-topic": el => startMode("topic", el.dataset.id),
    "start-mistakes": el => startMode("mistakes", el.dataset.id),
    pick: el => {
      const t = state.test, q = t.questions[t.cur], i = +el.dataset.i;
      if (t.checked[t.cur]) return;
      let sel = t.answers[t.cur];
      if (isMulti(q)) sel = sel.includes(i) ? sel.filter(x => x !== i) : sel.concat(i).sort();
      else sel = sel[0] === i ? [] : [i];
      t.answers[t.cur] = sel;
      renderTestKeepScroll();
    },
    check: () => {
      const t = state.test; t.checked[t.cur] = true;
      const p = scorePoints(t.questions[t.cur], t.answers[t.cur]);
      toast(p === 2 ? "✅ Дұрыс! +2 балл" : p === 1 ? "🟡 Жартылай дұрыс: 1 балл" : "❌ Қате. Түсініктемені оқы");
      renderTestKeepScroll();
    },
    next: () => { const t = state.test; if (t.cur < t.questions.length - 1) { t.cur++; renderTest(); window.scrollTo(0, 0); } },
    prev: () => { const t = state.test; if (t.cur > 0) { t.cur--; renderTest(); window.scrollTo(0, 0); } },
    goto: el => { state.test.cur = +el.dataset.i; renderTest(); window.scrollTo(0, 0); },
    finish: () => {
      const t = state.test; if (!t) return;
      const left = t.instant ? t.checked.filter(c => !c).length : t.answers.filter(a => !a.length).length;
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
    if (i >= 0 && i < q.options.length) actions.pick({ dataset: { i } });
    else if (e.key === "ArrowRight") actions.next();
    else if (e.key === "ArrowLeft") actions.prev();
    else if (e.key === "Enter" && t.instant && !t.checked[t.cur] && t.answers[t.cur].length) actions.check();
  });

  // Бір күн ішінде бірінші кіргенде — streak хабарламасы
  (function dailyGreeting() {
    const u = currentUser(); if (!u) return;
    const k = "bioubt_greet_" + u.id + "_" + dayKey();
    if (store.get(k, false)) return;
    store.set(k, true);
    const s = streak(u);
    if (s >= 2) { notify(u, "🔥", `${s} күн қатарынан! Тізбекті үзбе — бүгін де бір тест тапсыр.`); saveUser(u); }
  })();

  applyTheme();
  render();
})();

/*
 * Monitoring Kontrak — aplikasi utama (tampilan & interaksi)
 * Desain & sistem login sama dengan website Material Warehouse (Warehouse-SCM).
 */
(function () {
  'use strict';

  // ================= Utilitas =================
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function fmtMoney(n, cur) {
    if (n == null || isNaN(n)) return '—';
    if (cur && cur !== 'IDR') return cur + ' ' + nf2.format(n);
    return 'Rp ' + nf0.format(n);
  }
  function fmtBig(n, cur) {
    if (n == null || isNaN(n)) return '—';
    var p = cur && cur !== 'IDR' ? cur + ' ' : 'Rp ', a = Math.abs(n);
    if (a >= 1e12) return p + nf2.format(n / 1e12) + ' T';
    if (a >= 1e9) return p + nf2.format(n / 1e9) + ' M';
    if (a >= 1e6) return p + nf1.format(n / 1e6) + ' jt';
    return p + nf0.format(n);
  }
  function fmtDate(s) { if (!s) return '—'; var p = String(s).slice(0, 10).split('-'); return +p[2] + ' ' + BLN[+p[1] - 1] + ' ' + p[0]; }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function fmtQ(n) { if (n == null) return '—'; return Math.abs(n % 1) > 0 ? nf2.format(n) : nf0.format(n); }
  function pct(n) { return n == null ? '—' : nf0.format(Math.round(n)) + '%'; }
  // "1.250.000.000" / "1,5" / "1250000" -> angka
  function parseNum(v) {
    if (v == null) return null;
    var s = String(v).trim().replace(/[^\d,.\-]/g, '');
    if (!s) return null;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function uid(p) { return (p || 'K') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  var APP_VERSION = '20261111d'; // samakan dengan ?v= di index.html setiap rilis
  var DEFAULT_REPO = 'StackGeefer/Monitoring-Kontrak';
  var HERO = [{ path: 'assets/hero/pertamina-1-kilang.jpg', pos: '74% 40%' }, { path: 'assets/hero/pertamina-2-gudang.jpg', pos: '30% 60%' }];
  var ROLE_LABEL = { owner: 'Owner Utama', writer: 'Owner', viewer: 'Reader' };
  var DOC_CATS = ['Kontrak', 'Amandemen', 'Jaminan Pelaksanaan', 'BAPP / BAST', 'Invoice', 'Korespondensi', 'Lainnya'];

  // ================= State =================
  var S = {
    user: null, key: null, adminKey: null, users: [], D: null,
    f: Store.load('filters', null) || { q: '', st: 'open', jenis: '', fungsi: '', sort: 'end' },
    dueH: 12, imp: null, files: {}, whKey: null
  };
  var view = $('#view');

  function repoName() {
    var saved = Store.load('repo');
    if (saved) return saved;
    var h = location.hostname;
    if (/\.github\.io$/.test(h)) {
      var seg = location.pathname.split('/').filter(Boolean)[0];
      if (seg) return h.split('.')[0] + '/' + seg;
    }
    return DEFAULT_REPO;
  }
  GH.config({ repo: repoName() });
  function defaultWarehouseUrl() {
    if (/\.github\.io$/.test(location.hostname)) return location.origin + '/Warehouse-SCM/';
    return 'https://stackgeefer.github.io/Warehouse-SCM/';
  }
  function settings() { return Model.settingsOf(S.D); }
  function warehouseUrl() {
    var u = settings().warehouseUrl || defaultWarehouseUrl();
    return /\/$/.test(u) ? u : u + '/';
  }

  // ================= Modul Monitoring SAP =================
  var Sap = SapMod({
    S: S, esc: esc, ICON: ICON, Store: Store, GH: GH, Vault: Vault, Model: Model, APP_VERSION: APP_VERSION,
    nf0: nf0, fmtMoney: fmtMoney, fmtBig: fmtBig, fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtQ: fmtQ, pct: pct,
    bar: function (p, c, t) { return bar(p, c, t); }, toast: toast, loading: loading, loadScript: loadScript, loadXLSX: loadXLSX,
    settings: function () { return settings(); }, canWrite: function () { return canWrite(); }, me: function () { return me(); },
    warehouseUrl: function () { return warehouseUrl(); }, render: function () { render(); }, closeDrawer: function () { closeDrawer(); },
    ensureToken: function () { return ensureToken(); }, save: function (m, msg, x) { return save(m, msg, x); },
    modal: modal, confirmBox: confirmBox, fld: fld, inp: inp, sel: sel, parseNum: parseNum, nf2: nf2
  });

  var Wh = WhMod({
    S: S, esc: esc, ICON: ICON, Store: Store, Model: Model, BULAN: BULAN, nf0: nf0, nf2: nf2, fmtMoney: fmtMoney, fmtBig: fmtBig, fmtDate: fmtDate, pct: pct,
    bar: function (p, c, t) { return bar(p, c, t); }, absorbCls: function (p) { return absorbCls(p); }, infos: function () { return infos(); },
    settings: function () { return settings(); }, canWrite: function () { return canWrite(); }, render: function () { render(); },
    toast: toast, loading: loading, loadXLSX: loadXLSX
  });
  var Dash = DashMod({
    S: S, esc: esc, ICON: ICON, Model: Model, BLN: BLN, BULAN: BULAN, nf0: nf0, fmtMoney: fmtMoney, fmtBig: fmtBig, fmtDate: fmtDate, pct: pct, Sap: Sap, Wh: Wh,
    bar: function (p, c, t) { return bar(p, c, t); }, absorbCls: function (p) { return absorbCls(p); }, settings: function () { return settings(); },
    canWrite: function () { return canWrite(); }, me: function () { return me(); }
  });

  // ================= Peran =================
  function role() { return S.user ? S.user.role : ''; }
  function isOwner() { return role() === 'owner'; }
  function canWrite() { return Vault.canWrite(role()); }
  function roleLabel(r) { return ROLE_LABEL[r] || r; }
  function roleBadge(r) { return '<span class="badge ' + ({ owner: 'ok', writer: 'ok' }[r] || '') + '">' + roleLabel(r) + '</span>'; }
  function me() { return S.user ? S.user.name : ''; }

  // ================= UI dasar =================
  function toast(msg, bad) {
    var t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, bad ? 6500 : 2800);
  }
  function loading(msg) {
    var el = $('#loading');
    if (msg === false) { el.classList.add('hidden'); return; }
    $('#loadingText').textContent = msg || 'Memproses…';
    el.classList.remove('hidden');
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { s.remove(); resolve(); };
      s.onerror = function () { s.remove(); reject(new Error('Gagal memuat ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadXLSX() { return window.XLSX ? Promise.resolve() : loadScript('vendor/xlsx.full.min.js'); }

  // Modal form sederhana. fields: html berisi input ber-name. Hasil: object {name: value} atau null
  function modal(title, html, okLabel, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var el = document.createElement('div');
      el.className = 'pw-modal' + (opts.wide ? ' wide' : '');
      el.innerHTML = '<form class="card card-pad" autocomplete="off"><div class="toolbar" style="margin-bottom:10px"><h3 style="margin:0">' + esc(title) + '</h3><span class="spacer"></span><button type="button" class="icon-btn" data-x>' + ICON.close + '</button></div>' +
        html + '<div class="toolbar" style="margin-top:14px;justify-content:flex-end"><button type="button" class="btn" data-x>Batal</button><button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" type="submit">' + esc(okLabel || 'Simpan') + '</button></div></form>';
      document.body.appendChild(el);
      var first = el.querySelector('input:not([type=hidden]),select,textarea');
      setTimeout(function () { if (first) first.focus(); }, 30);
      function done(v) { el.remove(); resolve(v); }
      $$('[data-x]', el).forEach(function (b) { b.onclick = function () { done(null); }; });
      el.addEventListener('mousedown', function (e) { if (e.target === el) done(null); });
      el.querySelector('form').onsubmit = function (e) {
        e.preventDefault();
        var out = {};
        $$('[name]', el).forEach(function (i) { out[i.name] = i.type === 'checkbox' ? i.checked : i.type === 'file' ? i.files : i.value; });
        if (opts.validate) { var err = opts.validate(out); if (err) { toast(err, true); return; } }
        done(out);
      };
    });
  }
  function confirmBox(title, text, okLabel) {
    return modal(title, '<p style="margin:0;line-height:1.6">' + text + '</p>', okLabel || 'Ya, lanjutkan', { danger: true }).then(function (r) { return !!r; });
  }
  function fld(label, inner, cls) { return '<label class="fleet-fld' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span>' + inner + '</label>'; }
  function inp(name, val, attrs) { return '<input class="input" name="' + name + '" value="' + esc(val == null ? '' : val) + '" ' + (attrs || '') + '>'; }
  function sel(name, list, val, attrs) {
    return '<select class="select" name="' + name + '" ' + (attrs || '') + '>' + list.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(val == null ? '' : val) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '</select>';
  }

  // ================= Sesi & login =================
  function sessionGet() {
    try { var v = sessionStorage.getItem('mk:session') || localStorage.getItem('mk:session'); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function sessionSet(sess, remember) {
    try { (remember ? localStorage : sessionStorage).setItem('mk:session', JSON.stringify(sess)); } catch (e) { /* abaikan */ }
  }
  function sessionClear() { try { sessionStorage.removeItem('mk:session'); localStorage.removeItem('mk:session'); } catch (e) { /* abaikan */ } }

  async function loadMeta() {
    var t = Date.now();
    window.MK_USERS = null; window.MK_ADMIN = null;
    await loadScript('data/users.js?t=' + t).catch(function () {});
    await loadScript('data/admin.js?t=' + t).catch(function () {});
    S.users = window.MK_USERS || [];
  }
  function adminFile(tokEnc) {
    return '/* Token GitHub Owner Utama untuk penyimpanan oleh Writer — TERENKRIPSI (hanya Owner/Writer yang bisa membuka) */\n' +
      'window.MK_ADMIN = ' + JSON.stringify({ tok: tokEnc || null, by: me(), at: new Date().toISOString() }) + ';\n';
  }
  async function unlockToken() {
    var adm = window.MK_ADMIN, tok = null;
    if (S.adminKey && adm && adm.tok) {
      try { tok = (await Vault.decrypt(S.adminKey, adm.tok)).t || null; } catch (e) { console.warn('token tidak bisa dibuka', e); }
    }
    GH.config({ token: tok });
    return !!tok;
  }

  function heroHtml(title1, title2) {
    return '<div class="login-hero"><div class="lg-photos" aria-hidden="true">' + HERO.map(function (h, i) {
      return '<div class="lg-photo' + (i === 0 ? ' on' : '') + '" style="background-image:url(\'' + h.path + '\');background-position:' + h.pos + '"></div>';
    }).join('') + '<div class="lg-shade"></div></div>' +
      '<div class="lg-hero-inner"><div class="lg-logo">' + Brand.full('anim', '#ffffff') + '</div>' +
      '<div class="lg-copy"><div class="lg-eyebrow">Supply Chain Management · Warehouse &amp; Distribution</div>' +
      '<h1>' + title1 + '<br><span class="lg-grad">' + title2 + '</span></h1></div>' +
      '<div class="lg-dots">' + HERO.map(function (x, i) { return '<i class="' + (i === 0 ? 'on' : '') + '"></i>'; }).join('') + '</div></div></div>';
  }
  function startHeroTimer() {
    clearInterval(S.heroTimer);
    var k = 0;
    S.heroTimer = setInterval(function () {
      var ps = $$('#login .lg-photo'), ds = $$('#login .lg-dots i');
      if (!ps.length) { clearInterval(S.heroTimer); return; }
      k = (k + 1) % ps.length;
      ps.forEach(function (p, i) { p.classList.toggle('on', i === k); });
      ds.forEach(function (d, i) { d.classList.toggle('on', i === k); });
    }, 7000);
  }
  var IC_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  var IC_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var IC_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var IC_KEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/></svg>';

  function showLogin(err) {
    var el = $('#login');
    el.classList.add('photo');
    el.innerHTML = heroHtml('Monitoring', 'Kontrak') +
      '<div class="login-side"><form class="login-card" id="loginForm" autocomplete="on">' +
      '<div class="lc-logo">' + Brand.mark() + '</div>' +
      '<h2>Selamat datang</h2><p class="muted">Masuk dengan akun yang diberikan Owner.</p>' +
      '<label class="lbl" for="lgUser">Username</label>' +
      '<div class="field">' + IC_USER + '<input class="input" id="lgUser" name="username" autocomplete="username" placeholder="nama.pengguna" required></div>' +
      '<label class="lbl" for="lgPw">Password</label>' +
      '<div class="field">' + IC_LOCK + '<input class="input" id="lgPw" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required>' +
      '<button type="button" class="eye" data-act="toggle-pw" title="Tampilkan password">' + IC_EYE + '</button></div>' +
      '<label class="small remember"><input type="checkbox" id="lgRemember" checked> Ingat saya di perangkat ini</label>' +
      '<div class="lock-err" id="lgErr">' + esc(err || '') + '</div>' +
      '<button class="btn primary lg-btn" type="submit"><span>Masuk</span>' + ICON.arrow + '</button>' +
      '<div class="lc-foot"><span class="dot3"><i></i><i></i><i></i></span> Internal use only · Data terenkripsi</div>' +
      '</form></div>';
    el.classList.remove('hidden');
    setTimeout(function () { var i = $('#lgUser'); if (i) i.focus(); }, 50);
    startHeroTimer();
  }

  // Setup awal: belum ada pengguna sama sekali -> buat akun Owner Utama + hubungkan GitHub
  function showSetup(err) {
    var el = $('#login');
    el.classList.add('photo');
    el.innerHTML = heroHtml('Monitoring', 'Kontrak') +
      '<div class="login-side"><form class="login-card setup-card" id="setupForm" autocomplete="off">' +
      '<div class="lc-logo">' + Brand.mark() + '</div>' +
      '<h2>Setup awal</h2><p class="muted">Website belum punya pengguna. Buat akun <b>Owner Utama</b> dan hubungkan ke repo GitHub <span class="mono">' + esc(GH.repo()) + '</span>.</p>' +
      '<label class="lbl">Username Owner</label><div class="field">' + IC_USER + '<input class="input" id="suUser" placeholder="mis. Gerald.samosir" required></div>' +
      '<label class="lbl">Password (min. 6 karakter)</label><div class="field">' + IC_LOCK + '<input class="input" id="suPw" type="password" autocomplete="new-password" required minlength="6"></div>' +
      '<label class="lbl">Ulangi password</label><div class="field">' + IC_LOCK + '<input class="input" id="suPw2" type="password" autocomplete="new-password" required minlength="6"></div>' +
      '<label class="lbl">Token GitHub (Contents: Read and write)</label><div class="field">' + IC_KEY + '<input class="input masked" id="suTok" placeholder="github_pat_…" required></div>' +
      '<div class="small muted" style="margin:-8px 0 12px;line-height:1.5">Buat di <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a> → <i>Only select repositories</i>: <b>' + esc(GH.repo().split('/')[1]) + '</b> → Permissions <b>Contents: Read and write</b>.</div>' +
      '<div class="lock-err" id="suErr">' + esc(err || '') + '</div>' +
      '<button class="btn primary lg-btn" type="submit"><span>Buat akun Owner</span>' + ICON.arrow + '</button>' +
      '<div class="lc-foot"><span class="dot3"><i></i><i></i><i></i></span> Password tidak pernah disimpan — hanya kunci terenkripsi</div>' +
      '</form></div>';
    el.classList.remove('hidden');
    startHeroTimer();
  }
  async function doSetup() {
    var u = $('#suUser').value.trim(), pw = $('#suPw').value, pw2 = $('#suPw2').value, tok = $('#suTok').value.trim();
    var err = $('#suErr');
    if (!u || u.length < 3) { err.textContent = 'Username minimal 3 karakter'; return; }
    if (pw.length < 6) { err.textContent = 'Password minimal 6 karakter'; return; }
    if (pw !== pw2) { err.textContent = 'Ulangi password tidak sama'; return; }
    err.textContent = '';
    loading('Mengecek token GitHub…');
    try {
      await GH.testToken(tok);
      GH.config({ token: tok });
      var cur = await GH.readText('data/users.js');
      if (cur && /"id"\s*:/.test(cur)) throw new Error('Repo sudah punya pengguna — muat ulang halaman lalu login.');
      loading('Membuat kunci enkripsi & akun Owner…');
      var key = Vault.newKey(), ak = Vault.newKey();
      var owner = await Vault.makeUser(u, pw, 'owner', key, u, ak);
      S.user = { id: owner.id, name: owner.name, role: 'owner' };
      var D = Model.emptyData();
      D.updatedBy = u;
      D.audit = [];
      var tokEnc = await Vault.encrypt(ak, { t: tok });
      var files = {
        'data/users.js': Vault.usersFile([owner]),
        'data/admin.js': adminFile(tokEnc),
        'data/kontrak.js': Vault.encFile('MK_DATA', await Vault.encrypt(key, D), 'Data Monitoring Kontrak')
      };
      loading('Menyimpan ke GitHub…');
      await GH.commit(files, [], 'Setup awal Monitoring Kontrak: akun Owner ' + u);
      S.key = key; S.adminKey = ak; S.users = [owner]; S.D = D;
      window.MK_ADMIN = { tok: tokEnc };
      sessionSet({ user: S.user, key: Vault.toB64(key), ak: Vault.toB64(ak) }, true);
      await Store.set('data', D);
      $('#login').classList.add('hidden'); $('#login').innerHTML = '';
      loading(false);
      startApp(true);
      toast('Setup selesai. Selamat datang, ' + u + '!');
    } catch (e) {
      loading(false);
      GH.config({ token: null }); S.user = null;
      err.textContent = /Bad credentials|401/.test(e.message) ? 'Token tidak valid' : /Not Found|404/.test(e.message) ? 'Repo ' + GH.repo() + ' tidak ditemukan / token tidak punya akses' : e.message;
    }
  }

  async function doLogin() {
    var u = $('#lgUser').value, p = $('#lgPw').value;
    $('#lgErr').textContent = '';
    loading('Memeriksa akun…');
    try {
      var r = await Vault.login(S.users, u, p);
      S.user = r.user; S.key = r.key; S.adminKey = r.adminKey;
      sessionSet({ user: r.user, key: Vault.toB64(r.key), ak: r.adminKey ? Vault.toB64(r.adminKey) : null }, $('#lgRemember').checked);
      $('#login').classList.add('hidden'); $('#login').innerHTML = '';
      await startApp();
      toast('Selamat datang, ' + r.user.name);
    } catch (e) {
      loading(false);
      $('#lgErr').textContent = e.message;
    }
  }
  async function logout() {
    sessionClear();
    await Store.del('data');
    await Store.del('sap');
    S.user = null; S.key = null; S.adminKey = null; S.D = null; S.sap = null; S.sapPending = null; S.files = {}; S.imp = null; S.whKey = null; Sap.reset();
    GH.config({ token: null });
    view.innerHTML = '';
    showLogin();
  }

  // ================= Data kontrak =================
  async function loadData() {
    var repoD = null, cached = await Store.get('data');
    try {
      window.MK_DATA = null;
      await loadScript('data/kontrak.js?t=' + Date.now());
      if (window.MK_DATA) repoD = await Vault.decrypt(S.key, window.MK_DATA);
    } catch (e) { console.warn('data/kontrak.js', e); }
    // Owner/Writer: baca langsung dari repo agar selalu terbaru (GitHub Pages bisa terlambat ±1 menit)
    if (GH.hasToken()) {
      try {
        var p = Vault.payloadOf(await GH.readText('data/kontrak.js'));
        if (p) repoD = await Vault.decrypt(S.key, p);
      } catch (e) { console.warn('baca dari GitHub gagal', e); }
    }
    var D = repoD;
    if (cached && cached.updatedAt && (!D || cached.updatedAt > D.updatedAt)) D = cached;
    S.D = D || Model.emptyData();
    S.D.list = S.D.list || [];
    S.D.audit = S.D.audit || [];
    await Sap.load();
  }
  async function ensureToken() {
    if (GH.hasToken()) return true;
    await loadMeta();
    return unlockToken();
  }
  // Simpan perubahan: selalu dari data TERBARU di repo (aman bila beberapa Writer menyimpan bersamaan)
  async function save(mutate, message, extra) {
    if (!canWrite()) { toast('Akun Viewer tidak bisa mengubah data', true); return false; }
    if (!(await ensureToken())) {
      toast(isOwner() ? 'Hubungkan GitHub dulu di Pengaturan → Koneksi GitHub' : 'Akses simpan belum aktif. Minta Owner Utama menyimpan token GitHub & mengatur ulang password akun Anda.', true);
      return false;
    }
    loading((extra && extra.loading) || 'Menyimpan…');
    try {
      var next = await GH.atomic({
        path: 'data/kontrak.js', varName: 'MK_DATA', note: 'Data Monitoring Kontrak', key: S.key,
        message: message + ' (' + me() + ')', files: extra && extra.files, deletes: extra && extra.deletes,
        mutate: function (cur) {
          var D = cur || Model.emptyData();
          D.list = D.list || []; D.audit = D.audit || [];
          mutate(D);
          D.updatedAt = new Date().toISOString(); D.updatedBy = me();
          return D;
        }
      });
      S.D = next;
      await Store.set('data', next);
      return true;
    } catch (e) {
      console.error(e);
      toast('Gagal menyimpan: ' + e.message, true);
      return false;
    } finally { loading(false); }
  }
  function findK(id, D) { return ((D || S.D).list || []).filter(function (k) { return k.id === id; })[0] || null; }
  function addLog(k, msg) { k.log = k.log || []; k.log.unshift({ at: new Date().toISOString(), by: me(), msg: msg }); if (k.log.length > 60) k.log.length = 60; }
  function addAudit(D, what, label, data) {
    D.audit = D.audit || [];
    D.audit.unshift({ at: new Date().toISOString(), by: me(), what: what, label: label, data: data || null });
    if (D.audit.length > 400) D.audit.length = 400;
  }
  function infos() { var st = settings(), t = Model.todayStr(); return S.D.list.map(function (k) { return Model.info(k, st, t); }); }

  // ================= Routing =================
  var TITLES = {
    dashboard: ['Dashboard', 'Ringkasan seluruh kontrak & hal yang perlu ditindaklanjuti'],
    oa: ['Kontrak OA', 'Outline Agreement · ME3N'],
    po: ['PO / RO', 'Purchase Order & Release Order · ME2N'],
    progres: ['Progres PR & PO', 'Pengadaan & expediting material stock'],
    wh: ['Kontrak Warehouse', 'Nilai, realisasi & tagihan bulanan per Field'],
    gs: ['Kontrak GS', 'Nilai, realisasi & tagihan bulanan per Field'],
    kontrak: ['Kontrak Lainnya', ''],
    'jatuh-tempo': ['Jatuh Tempo', 'Kontrak yang berakhir per bulan & tindak lanjutnya'],
    baru: ['Tambah Kontrak', ''],
    edit: ['Edit Kontrak', ''],
    import: ['Data SAP', 'Upload ME3N, ME2N & progres PR/PO · penyimpanan'],
    pengaturan: ['Pengaturan', '']
  };
  var WRITE_ROUTES = { baru: 1, edit: 1, import: 1 };
  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    var parts = h.split('/');
    return { name: parts[0], arg: decodeURIComponent(parts.slice(1).join('/') || '') };
  }
  function render() {
    if (!S.user || !S.D) return;
    var r = currentRoute();
    if (!TITLES[r.name]) { location.replace('#/dashboard'); return; }
    if (WRITE_ROUTES[r.name] && !canWrite()) { location.replace('#/dashboard'); return; }
    $$('#nav a[data-route]').forEach(function (a) {
      var rn = a.getAttribute('data-route');
      var act = rn === r.name;
      if (r.name === 'kontrak' || r.name === 'edit') { var kk = r.arg ? findK(r.arg) : null, kt = kk ? (kk.kat === 'Warehouse' ? 'wh' : kk.kat === 'GS' ? 'gs' : 'kontrak') : 'kontrak'; act = rn === kt; }
      a.classList.toggle('active', act);
      a.classList.toggle('hidden', (a.hasAttribute('data-write') && !canWrite()) || (rn === 'kontrak' && !S.D.list.some(function (x) { return !x.kat; })));
    });
    var t = TITLES[r.name];
    $('#pageTitle').textContent = t[0];
    $('#pageSub').textContent = t[1];
    $('#pageActions').innerHTML = '';
    closeDrawer();
    if (r.name === 'dashboard') renderDashboard();
    else if (r.name === 'kontrak') { if (r.arg) renderDetail(r.arg); else { S.f.kat = 'other'; renderList(); } }
    else if (r.name === 'jatuh-tempo') renderDue();
    else if (r.name === 'oa') { if (r.arg) Sap.renderOADetail(r.arg); else Sap.renderOA(); }
    else if (r.name === 'po') Sap.renderPO();
    else if (r.name === 'progres') Sap.renderProgres();
    else if (r.name === 'wh') Wh.renderPage('Warehouse');
    else if (r.name === 'gs') Wh.renderPage('GS');
    else if (r.name === 'baru') renderForm(null, r.arg);
    else if (r.name === 'edit') renderForm(r.arg);
    else if (r.name === 'import') renderImport();
    else if (r.name === 'pengaturan') renderSettings();
    if (canWrite() && !GH.hasToken()) {
      view.insertAdjacentHTML('afterbegin', '<div class="card card-pad pending-banner"><div><b>Website belum terhubung ke GitHub — data belum bisa disimpan.</b><div class="small muted">' +
        (isOwner() ? 'Isi token GitHub sekali di Pengaturan → Koneksi GitHub. Setelah itu Writer otomatis ikut bisa menyimpan.' : 'Minta Owner Utama mengisi token GitHub di Pengaturan → Koneksi GitHub.') + '</div></div>' +
        (isOwner() && r.name !== 'pengaturan' ? '<a class="btn primary" href="#/pengaturan">Hubungkan GitHub</a>' : '') + '</div>');
    }
    if (r.name !== 'pengaturan') view.insertAdjacentHTML('beforeend', '<div class="last-edit small muted">Terakhir diubah: <b>' + esc(S.D.updatedBy || '—') + '</b> · ' + fmtDateTime(S.D.updatedAt) +
      (S.sap && S.sap.updatedAt ? ' &nbsp;|&nbsp; Data SAP: <b>' + esc(S.sap.updatedBy || '—') + '</b> · ' + fmtDateTime(S.sap.updatedAt) : '') + '</div>');
    renderSide();
    window.scrollTo(0, 0);
  }
  function renderSide() {
    var n = infos().filter(function (i) { return !i.closed && (i.st === 'crit' || i.st === 'expired'); }).length;
    n += Sap.has() ? Sap.idx().oas.filter(function (x) { var t = ((S.D.oaNotes || {})[x.c + ':' + x.no] || {}).tindak; return x.st === 'crit' && !t; }).length : 0;
    var b = $('#navDue');
    b.textContent = n; b.classList.toggle('hidden', !n);
    var nl = Sap.lateCount(), b2 = $('#navLate');
    b2.textContent = nl; b2.classList.toggle('hidden', !nl);
    $('#sideData').innerHTML = S.user ? '<div class="side-user"><div class="avatar">' + esc(S.user.name.charAt(0).toUpperCase()) + '</div><div style="min-width:0"><b>' + esc(S.user.name) + '</b><div class="small">' + roleLabel(S.user.role) + '</div></div>' +
      '<button class="icon-btn" data-act="logout" title="Keluar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg></button></div>' : '';
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open'); $('#scrim').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
  }

  // ================= Komponen =================
  function stBadge(i) { return '<span class="badge ' + i.stCls + '">' + esc(i.stLabel) + '</span>'; }
  function daysBadge(i) {
    if (i.closed) return '<span class="badge">' + esc(Model.TINDAK[i.k.tindak] || 'Ditutup') + '</span>';
    if (i.days == null) return '<span class="muted">—</span>';
    if (i.days < 0) return '<span class="badge bad">Lewat ' + nf0.format(-i.days) + ' hari</span>';
    return '<span class="badge ' + i.stCls + '">' + nf0.format(i.days) + ' hari lagi</span>';
  }
  function bar(p, cls, title) {
    if (p == null) return '<span class="muted small">—</span>';
    var w = Math.max(0, Math.min(100, p));
    return '<div class="mk-bar ' + (cls || '') + '" title="' + esc(title || '') + '"><i style="width:' + w.toFixed(1) + '%"></i></div>';
  }
  function absorbCls(p) { var s = settings(); return p == null ? '' : p >= 100 ? 'bad' : p >= s.absorbWarn ? 'warn' : ''; }
  function emptyState() {
    return '<div class="card empty"><div class="ico">' + ICON.doc + '</div><h3>Belum ada kontrak</h3>' +
      '<p>' + (canWrite() ? 'Tambahkan kontrak secara manual, atau tarik daftar OA langsung dari data ME3N di website Material Warehouse.' : 'Owner / Writer belum memasukkan data kontrak.') + '</p>' +
      (canWrite() ? '<div class="toolbar" style="justify-content:center"><a class="btn primary" href="#/baru">' + ICON.plus + ' Tambah Kontrak</a><a class="btn" href="#/import">' + ICON.upload + ' Import ME3N / Excel</a></div>' : '') + '</div>';
  }
  function sumByCur(list, fn) {
    var t = {};
    list.forEach(function (i) { var c = i.k.cur || 'IDR', v = fn(i); if (v) t[c] = (t[c] || 0) + v; });
    return t;
  }
  function curText(t) { var ks = Object.keys(t); return ks.length ? ks.map(function (c) { return fmtBig(t[c], c); }).join(' + ') : 'Rp 0'; }

  // ================= Dashboard =================
  function renderDashboard() { $('#pageTitle').textContent = 'Dashboard'; Dash.render(view); }

  // ================= Daftar kontrak =================
  var LIST_ST = [['open', 'Semua berjalan'], ['active', 'Aktif'], ['warn', 'Segera berakhir'], ['crit', 'Kritis'], ['expired', 'Lewat masa berlaku'], ['flag', 'Perlu tindakan'], ['closed', 'Ditutup'], ['all', 'Semua']];
  function passSt(i, st) {
    if (st === 'all') return true;
    if (st === 'open') return !i.closed;
    if (st === 'flag') return !i.closed && i.flags.length > 0;
    if (st === 'active') return i.st === 'active' || i.st === 'soon';
    return i.st === st;
  }
  function filtered() {
    var F = S.f, q = F.q.trim().toLowerCase();
    var list = infos().filter(function (i) {
      if (i.k.kat) return false;
      if (!passSt(i, F.st)) return false;
      if (F.jenis && i.k.jenis !== F.jenis) return false;
      if (F.fungsi && i.k.fungsi !== F.fungsi) return false;
      if (q) {
        var hay = [i.k.no, i.k.judul, i.k.vendor, i.k.vendorCode, i.k.pic, i.k.fungsi, i.k.jenis, i.k.pg, i.k.catatan].join(' ').toLowerCase();
        if (q.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return false;
      }
      return true;
    });
    list.sort(function (a, b) {
      if (F.sort === 'no') return String(a.k.no).localeCompare(String(b.k.no));
      if (F.sort === 'val') return b.value - a.value;
      if (F.sort === 'abs') return (b.realPct || 0) - (a.realPct || 0);
      if (F.sort === 'new') return (b.k.createdAt || '') < (a.k.createdAt || '') ? -1 : 1;
      return (a.end || '9999') < (b.end || '9999') ? -1 : (a.end || '9999') > (b.end || '9999') ? 1 : 0;
    });
    return list;
  }
  function renderList() {
    $('#pageActions').innerHTML = '<button class="btn" data-act="export">' + ICON.excel + ' Export Excel</button>' + (canWrite() ? '<a class="btn primary" href="#/baru">' + ICON.plus + ' Tambah Kontrak</a>' : '');
    if (!S.D.list.length) { view.innerHTML = emptyState(); return; }
    var F = S.f, st = settings(), all = infos();
    var chips = LIST_ST.map(function (x) {
      var n = all.filter(function (i) { return passSt(i, x[0]); }).length;
      return '<span class="chip-toggle' + (F.st === x[0] ? ' on' : '') + '" data-st="' + x[0] + '">' + x[1] + '<span class="chip-n">' + n + '</span></span>';
    }).join('');
    var jenisSet = {}, fungsiSet = {};
    S.D.list.forEach(function (k) { if (k.jenis) jenisSet[k.jenis] = 1; if (k.fungsi) fungsiSet[k.fungsi] = 1; });
    view.innerHTML =
      '<div class="card card-pad" style="margin-bottom:14px;display:flex;flex-direction:column;gap:12px">' +
      '<div class="toolbar"><div class="searchbox" style="flex:1;min-width:240px">' + ICON.search.replace('<svg', '<svg style="left:12px;width:18px;height:18px"') +
      '<input id="kq" class="input" style="height:40px;padding-left:38px;font-size:14px;border-radius:10px;box-shadow:none" placeholder="Cari nomor kontrak, pekerjaan, vendor, PIC…" value="' + esc(F.q) + '"></div>' +
      '<select class="select" id="kjenis"><option value="">Semua jenis</option>' + Object.keys(jenisSet).sort().map(function (j) { return '<option' + (F.jenis === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
      '<select class="select" id="kfungsi"><option value="">Semua fungsi</option>' + Object.keys(fungsiSet).sort().map(function (j) { return '<option' + (F.fungsi === j ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>' +
      '<select class="select" id="ksort">' + [['end', 'Urut: berakhir paling cepat'], ['abs', 'Urut: serapan tertinggi'], ['val', 'Urut: nilai terbesar'], ['no', 'Urut: nomor kontrak'], ['new', 'Urut: terbaru diinput']].map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="chips">' + chips + '</div></div><div id="klist"></div>';
    renderRows();
  }
  function renderRows() {
    var list = filtered();
    var rows = list.map(function (i) {
      var k = i.k;
      return '<tr class="clickable" data-open="' + esc(k.id) + '">' +
        '<td><div class="mono" style="font-weight:700;color:var(--brand)">' + esc(k.no) + '</div><div class="small muted">' + esc(k.jenis || '') + (i.amCount ? ' · Amd ' + i.amCount : '') + '</div></td>' +
        '<td class="mat-cell"><div class="mat-desc">' + esc(k.judul || '—') + '</div><div class="small muted">' + esc(k.vendor || '') + (k.fungsi ? ' · ' + esc(k.fungsi) : '') + '</div>' +
        (i.flags.length ? '<div style="margin-top:4px">' + i.flags.slice(0, 2).map(function (f) { return '<span class="badge ' + f.cls + ' flag">' + esc(f.t) + '</span>'; }).join(' ') + '</div>' : '') + '</td>' +
        '<td class="nowrap small">' + fmtDate(k.mulai) + '<br><b>' + fmtDate(i.end) + '</b></td>' +
        '<td>' + daysBadge(i) + '<div style="margin-top:6px;min-width:110px">' + bar(i.timePct, 'time', 'Waktu berjalan ' + pct(i.timePct)) + '</div></td>' +
        '<td class="num nowrap"><b>' + esc(fmtBig(i.value, k.cur)) + '</b><div class="small muted">sisa ' + esc(fmtBig(i.sisa, k.cur)) + '</div></td>' +
        '<td style="min-width:130px">' + bar(i.realPct, absorbCls(i.realPct), 'Terserap ' + pct(i.realPct)) + '<div class="small muted">' + pct(i.realPct) + (i.realSrc === 'sap' ? ' · SAP' : '') + '</div></td>' +
        '<td>' + stBadge(i) + '<div class="small muted" style="margin-top:4px">' + esc(k.pic || '') + '</div></td></tr>';
    }).join('');
    var tv = sumByCur(list, function (i) { return i.value; });
    $('#klist').innerHTML = list.length
      ? '<div class="result-meta" style="margin-bottom:10px"><b>' + list.length + '</b> kontrak · total nilai <b>' + esc(curText(tv)) + '</b></div>' +
        '<div class="table-wrap tall"><table class="grid"><thead><tr><th>No. Kontrak</th><th>Pekerjaan / Vendor</th><th>Periode</th><th>Sisa waktu</th><th class="num">Nilai</th><th>Serapan</th><th>Status / PIC</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      : '<div class="card empty"><h3>Tidak ada kontrak yang cocok</h3><p>Ubah kata kunci atau filter status.</p></div>';
  }

  // ================= Detail kontrak =================
  function whLink(k) {
    if (!k || !k.no) return '';
    var isOA = /^OA/i.test(k.jenis || '') || k.sap;
    return isOA ? '<a class="btn" href="' + esc(warehouseUrl() + '#/kontrak/' + encodeURIComponent(k.no)) + '" target="_blank" rel="noopener" title="Buka daftar material OA ini di website Material Warehouse">' + ICON.link + ' Material di Warehouse ↗</a>' : '';
  }
  function renderDetail(id) {
    var k = findK(id);
    if (!k) { view.innerHTML = '<div class="card empty"><h3>Kontrak tidak ditemukan</h3><p>Mungkin sudah dihapus.</p><a class="btn" href="#/kontrak">' + ICON.back + ' Kembali</a></div>'; return; }
    var i = Model.info(k, settings()), w = canWrite();
    var backTo = k.kat === 'Warehouse' ? 'wh' : k.kat === 'GS' ? 'gs' : 'kontrak';
    $('#pageTitle').textContent = k.short ? k.short + ' · ' + k.no : 'Kontrak ' + k.no;
    $('#pageSub').textContent = k.kat ? 'Kontrak ' + k.kat + (k.field ? ' · Field ' + k.field : '') + ' · ' + (k.vendor || '') : (k.judul || '');
    $('#pageActions').innerHTML = '<a class="btn" href="#/' + backTo + '">' + ICON.back + ' Daftar</a>' + (k.kat ? '' : whLink(k)) +
      (w ? '<a class="btn primary" href="#/edit/' + esc(k.id) + '">' + ICON.edit + ' Edit</a>' : '') +
      (w ? '<button class="btn danger" data-act="del-k" data-id="' + esc(k.id) + '">' + ICON.trash + ' Hapus</button>' : '');

    var head = '<div class="card head-card" style="margin-bottom:14px"><div><div class="toolbar" style="gap:8px"><span class="mono" style="font-weight:800;color:var(--brand);font-size:15px">' + esc(k.no) + '</span>' +
      '<span class="badge ro">' + esc(k.jenis || '—') + '</span>' + stBadge(i) + (k.sap ? '<span class="badge bau" title="Data dari ME3N ' + esc(k.sap.date || '') + '">SAP ME3N</span>' : '') + '</div>' +
      (k.short ? '<h2>' + esc(k.short) + '</h2><div class="small" style="margin:2px 0 6px;line-height:1.5;max-width:900px">' + esc(k.judul || '') + '</div>' : '<h2>' + esc(k.judul || '—') + '</h2>') + '<div class="muted">' + esc(k.vendor || '') + (k.vendorCode ? ' <span class="mono small">(' + esc(k.vendorCode) + ')</span>' : '') + '</div>' +
      (i.flags.length ? '<div class="toolbar" style="margin-top:10px;gap:6px">' + i.flags.map(function (f) { return '<span class="badge ' + f.cls + '">⚠ ' + esc(f.t) + '</span>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="mk-tindak"><div class="small muted" style="font-weight:700;margin-bottom:4px">Tindak lanjut</div>' +
      (w ? '<select class="select" data-tindak="' + esc(k.id) + '">' + Object.keys(Model.TINDAK).map(function (t) { return '<option value="' + t + '"' + ((k.tindak || '') === t ? ' selected' : '') + '>' + Model.TINDAK[t] + '</option>'; }).join('') + '</select>'
        : '<b>' + esc(Model.TINDAK[k.tindak || '']) + '</b>') + '</div></div>';

    var kpis = '<div class="kpis" style="margin-bottom:14px">' +
      '<div class="kpi"><div class="k">Nilai kontrak</div><div class="v">' + esc(fmtBig(i.value, k.cur)) + '</div><div class="s">' + (i.amCount && i.value !== +k.nilai ? 'awal ' + esc(fmtBig(+k.nilai, k.cur)) : esc(fmtMoney(i.value, k.cur))) + '</div></div>' +
      '<div class="kpi"><div class="k">Realisasi</div><div class="v">' + esc(fmtBig(i.real, k.cur)) + '</div><div class="s">' + (i.realSrc === 'sap' ? 'dari SAP ME3N (' + fmtDate(k.sap.date) + ')' : i.realSrc === 'manual' ? (k.realisasi || []).length + ' catatan realisasi' : 'belum ada realisasi') + '</div></div>' +
      '<div class="kpi"><div class="k">Sisa nilai</div><div class="v">' + esc(fmtBig(i.sisa, k.cur)) + '</div><div class="s">' + bar(i.realPct, absorbCls(i.realPct)) + '<span style="display:block;margin-top:4px">' + pct(i.realPct) + ' terserap</span></div></div>' +
      '<div class="kpi"><div class="k">Sisa waktu</div><div class="v">' + (i.days == null ? '—' : i.days < 0 ? 'Lewat ' + nf0.format(-i.days) + ' hr' : nf0.format(i.days) + ' hari') + '</div><div class="s">' + bar(i.timePct, 'time') + '<span style="display:block;margin-top:4px">berakhir ' + fmtDate(i.end) + '</span></div></div>' +
      '</div>';

    var j = k.jaminan || {};
    var infoCard = '<div class="card card-pad"><h3 class="section-title">Informasi kontrak</h3><div class="kv">' +
      kv('Nomor kontrak / OA', '<span class="mono">' + esc(k.no) + '</span>') + kv('Jenis', esc(k.jenis || '—')) +
      kv('Vendor', esc(k.vendor || '—')) + kv('Kode vendor', esc(k.vendorCode || '—')) +
      kv('Fungsi pengguna', esc(k.fungsi || '—')) + kv('PIC', esc(k.pic || '—')) +
      kv('Tanggal mulai', fmtDate(k.mulai)) + kv('Berakhir (awal)', fmtDate(k.akhir)) +
      kv('Berakhir (efektif)', '<b>' + fmtDate(i.end) + '</b>') + kv('Purch. Group', esc(k.pg || '—')) +
      kv('Nilai awal', esc(fmtMoney(+k.nilai || 0, k.cur))) + kv('Nilai efektif', '<b>' + esc(fmtMoney(i.value, k.cur)) + '</b>') +
      '</div>' + (k.catatan ? '<div class="mk-note">' + esc(k.catatan).replace(/\n/g, '<br>') + '</div>' : '') +
      (k.sap ? '<div class="small muted" style="margin-top:12px;line-height:1.6">Data SAP ME3N ' + fmtDate(k.sap.date) + ': target ' + esc(fmtMoney(k.sap.nilai, k.cur)) + ' · open ' + esc(fmtMoney(k.sap.open, k.cur)) + ' · berlaku s/d ' + fmtDate(k.sap.akhir) + ' · ' + (k.sap.items || 0) + ' item material</div>' : '') +
      '<div class="small muted" style="margin-top:10px">Dibuat ' + esc(k.createdBy || '—') + ' · ' + fmtDateTime(k.createdAt) + (k.editedAt ? ' — Last edit: ' + esc(k.editedBy) + ' · ' + fmtDateTime(k.editedAt) : '') + '</div></div>';

    var jamCard = '<div class="card card-pad"><h3 class="section-title">Jaminan pelaksanaan</h3>' +
      (j.no || j.akhir ? '<div class="kv">' + kv('Nomor', esc(j.no || '—')) + kv('Penerbit (bank / asuransi)', esc(j.bank || '—')) + kv('Nilai', esc(j.nilai ? fmtMoney(+j.nilai, k.cur) : '—')) +
        kv('Berlaku s/d', j.akhir ? (j.akhir < Model.todayStr() ? '<span class="badge bad">' + fmtDate(j.akhir) + ' — berakhir</span>' : '<b>' + fmtDate(j.akhir) + '</b>') : '—') + '</div>'
        : '<p class="muted small" style="margin:0">Belum diisi' + (w ? ' — isi lewat tombol Edit.' : '.') + '</p>') + '</div>';

    // Realisasi
    var rl = (k.realisasi || []).slice().sort(function (a, b) { return (a.periode || a.tgl || '').localeCompare(b.periode || b.tgl || ''); });
    var cum = 0, bill = Wh.billing(i);
    var rlRows = rl.map(function (r) {
      cum += +r.nilai || 0;
      var docs = [r.pr ? 'PR ' + r.pr : '', r.ro ? 'RO ' + r.ro : '', r.sa ? 'SA ' + r.sa : ''].filter(Boolean).map(function (d) { return '<span class="nowrap">' + esc(d) + '</span>'; }).join(' · ');
      return '<tr><td class="nowrap"><b>' + (r.periode ? Wh.ymLabel(r.periode, true) : fmtDate(r.tgl)) + '</b>' + (r.uraian ? '<div class="small muted">' + esc(r.uraian) + '</div>' : '') + '</td>' +
        '<td>' + (r.ref ? '<div class="small">' + esc(r.ref) + '</div>' : '') + (r.invTgl ? '<div class="small muted">' + fmtDate(r.invTgl) + '</div>' : '') + (!r.ref && !r.invTgl ? '<span class="badge warn">belum ada invoice</span>' : '') + '</td>' +
        '<td class="mono small">' + (docs || '<span class="muted">—</span>') + '</td>' +
        '<td class="num nowrap"><b>' + esc(fmtMoney(+r.nilai, k.cur)) + '</b></td><td class="num small muted nowrap">' + (i.value ? pct(cum / i.value * 100) : '') + '</td><td class="small muted nowrap">' + esc(r.by || '') + (r.at ? '<div>' + fmtDate(r.at.slice(0, 10)) + '</div>' : '') + '</td>' +
        (w ? '<td class="c nowrap"><button class="icon-btn" data-act="edit-real" data-id="' + esc(k.id) + '" data-rid="' + esc(r.id) + '" title="Edit">' + ICON.edit + '</button><button class="icon-btn" data-act="del-real" data-id="' + esc(k.id) + '" data-rid="' + esc(r.id) + '" title="Hapus">' + ICON.trash + '</button></td>' : '') + '</tr>';
    }).reverse().join('');
    var realCard = '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">Tagihan / realisasi per bulan</h3><span class="badge">' + rl.length + '</span><span class="spacer"></span>' +
      (w ? '<button class="btn sm primary" data-act="add-real" data-id="' + esc(k.id) + '">' + ICON.plus + ' Input tagihan</button>' : '') + '</div>' +
      (bill.missing.length ? '<div class="wh-alert small" style="margin-bottom:10px"><b>' + esc(Wh.missText(bill)) + '</b> — input tagihan bulan sebelumnya di awal bulan agar serapan nilai kontrak terpantau.</div>' : '') +
      (rl.length ? '<div class="table-wrap" style="box-shadow:none;max-height:520px"><table class="grid"><thead><tr><th>Periode</th><th>Invoice</th><th>PR · RO · SA</th><th class="num">Nilai (tanpa PPN)</th><th class="num">Kum.</th><th>Diubah</th>' + (w ? '<th></th>' : '') + '</tr></thead><tbody>' + rlRows +
        '<tr class="total"><td colspan="3">Total realisasi</td><td class="num nowrap">' + esc(fmtMoney(i.real, k.cur)) + '</td><td class="num small">' + pct(i.realPct) + '</td><td colspan="' + (w ? 2 : 1) + '"></td></tr></tbody></table></div>'
        : '<p class="muted small" style="margin:0">' + (k.sap ? 'Realisasi diambil dari data SAP ME3N (target − open value).' : 'Belum ada tagihan. Catat tagihan tiap bulan (PR, RO, SA & invoice) agar serapan nilai kontrak terpantau.') + '</p>') + '</div>';

    // Amandemen
    var am = (k.amandemen || []).slice().sort(function (a, b) { return (a.tgl || '').localeCompare(b.tgl || ''); });
    var amRows = am.map(function (a, idx) {
      return '<tr><td><b>Amd ' + (idx + 1) + '</b><div class="mono small">' + esc(a.no || '') + '</div></td><td class="nowrap">' + fmtDate(a.tgl) + '</td><td class="nowrap">' + (a.akhir ? fmtDate(a.akhir) : '—') + '</td><td class="num nowrap">' + (a.nilai ? esc(fmtMoney(+a.nilai, k.cur)) : '—') + '</td><td>' + esc(a.ket || '') + '</td>' +
        (w ? '<td class="c"><button class="icon-btn" data-act="del-am" data-id="' + esc(k.id) + '" data-aid="' + esc(a.id) + '" title="Hapus">' + ICON.trash + '</button></td>' : '') + '</tr>';
    }).join('');
    var amCard = '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">Amandemen</h3><span class="spacer"></span>' +
      (w ? '<button class="btn sm" data-act="add-am" data-id="' + esc(k.id) + '">' + ICON.plus + ' Tambah amandemen</button>' : '') + '</div>' +
      (am.length ? '<div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>Amandemen</th><th>Tanggal</th><th>Berakhir baru</th><th class="num">Nilai baru</th><th>Keterangan</th>' + (w ? '<th></th>' : '') + '</tr></thead><tbody>' + amRows + '</tbody></table></div>'
        : '<p class="muted small" style="margin:0">Belum ada amandemen. Tanggal berakhir & nilai kontrak otomatis mengikuti amandemen terakhir.</p>') + '</div>';

    // Dokumen
    var docs = k.docs || [];
    var docCard = '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">Dokumen</h3><span class="spacer"></span>' +
      (w ? '<button class="btn sm" data-act="add-doc" data-id="' + esc(k.id) + '">' + ICON.upload + ' Upload dokumen</button>' : '') + '</div>' +
      (docs.length ? '<div class="mk-docs">' + docs.map(function (d) {
        return '<div class="mk-doc"><div class="doc-ico">' + esc((d.fileName || '').split('.').pop().toUpperCase().slice(0, 4) || 'PDF') + '</div><div style="min-width:0;flex:1"><div class="small muted">' + esc(d.cat || '') + '</div><b>' + esc(d.title) + '</b><div class="small muted">' + esc(fmtSize(d.size)) + ' · ' + esc(d.by || '') + ' · ' + fmtDate((d.at || '').slice(0, 10)) + '</div></div>' +
          '<div class="toolbar" style="gap:4px"><button class="btn sm" data-act="view-doc" data-id="' + esc(k.id) + '" data-did="' + esc(d.id) + '">Lihat</button>' +
          (w ? '<button class="icon-btn" data-act="del-doc" data-id="' + esc(k.id) + '" data-did="' + esc(d.id) + '" title="Hapus">' + ICON.trash + '</button>' : '') + '</div></div>';
      }).join('') + '</div>' : '<p class="muted small" style="margin:0">Belum ada dokumen (kontrak, amandemen, jaminan, BAPP…). File disimpan terenkripsi.</p>') + '</div>';

    var log = (k.log || []);
    var logCard = '<div class="card card-pad"><h3 class="section-title">Riwayat perubahan</h3>' + (log.length ? '<div class="mk-log">' + log.slice(0, 20).map(function (l) {
      return '<div class="mk-log-row"><span>' + esc(l.msg) + '</span><span class="small muted nowrap">' + esc(l.by) + ' · ' + fmtDateTime(l.at) + '</span></div>';
    }).join('') + '</div>' : '<p class="muted small" style="margin:0">—</p>') + '</div>';

    view.innerHTML = head + kpis + (k.kat ? '<div style="margin-bottom:16px">' + realCard + '</div>' : '') + '<div class="mk-detail"><div class="mk-col">' + infoCard + (k.kat ? '' : realCard) + amCard + '</div><div class="mk-col">' + jamCard + docCard + logCard + '</div></div>';
  }
  function kv(label, val) { return '<div><span>' + label + '</span>' + val + '</div>'; }
  function fmtSize(b) { b = +b || 0; return b > 1048576 ? nf1.format(b / 1048576) + ' MB' : nf0.format(Math.max(1, b / 1024)) + ' KB'; }

  // ================= Form tambah / edit =================
  function renderForm(id, preKat) {
    var k = id ? findK(id) : null;
    if (id && !k) { view.innerHTML = '<div class="card empty"><h3>Kontrak tidak ditemukan</h3></div>'; return; }
    k = k || { cur: 'IDR', jenis: settings().jenis[0], kat: preKat === 'Warehouse' || preKat === 'GS' ? preKat : '', field: Store.load('whField', '') || 'Rantau' };
    var flds = {}; S.D.list.forEach(function (x) { if (x.field) flds[x.field] = 1; });
    if (id) { $('#pageTitle').textContent = 'Edit Kontrak ' + k.no; $('#pageSub').textContent = k.judul || ''; }
    var st = settings(), j = k.jaminan || {};
    var jenis = st.jenis.slice(); if (k.jenis && jenis.indexOf(k.jenis) < 0) jenis.push(k.jenis);
    var fungsi = [''].concat(st.fungsi); if (k.fungsi && fungsi.indexOf(k.fungsi) < 0) fungsi.push(k.fungsi);
    var pics = {}; S.D.list.forEach(function (x) { if (x.pic) pics[x.pic] = 1; });
    var vendors = {}; S.D.list.forEach(function (x) { if (x.vendor) vendors[x.vendor] = 1; });
    view.innerHTML = '<form class="card card-pad" id="kForm" data-id="' + esc(id || '') + '" autocomplete="off">' +
      '<h3 class="section-title">Data kontrak</h3><div class="fleet-form mk-form">' +
      fld('Nomor kontrak / OA *', inp('no', k.no, 'required placeholder="mis. 4610012345"')) +
      fld('Jenis kontrak', sel('jenis', jenis, k.jenis)) +
      fld('Kategori', sel('kat', [['Warehouse', 'Kontrak Warehouse'], ['GS', 'Kontrak GS'], ['', 'Lainnya']], k.kat || '')) +
      fld('Field', inp('field', k.field, 'list="dlField" placeholder="mis. Rantau"') + '<datalist id="dlField">' + Object.keys(flds).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>') +
      fld('Nama singkat (tampil di kartu)', inp('short', k.short, 'placeholder="mis. Crane 55 Ton & Tronton"'), 'wide') +
      fld('Judul / nama pekerjaan *', inp('judul', k.judul, 'required placeholder="mis. Pengadaan Valve & Fitting Zona 1"'), 'wide') +
      fld('Vendor / penyedia', inp('vendor', k.vendor, 'list="dlVendor"') + '<datalist id="dlVendor">' + Object.keys(vendors).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>') +
      fld('Kode vendor (SAP)', inp('vendorCode', k.vendorCode)) +
      fld('Fungsi pengguna', sel('fungsi', fungsi.map(function (f) { return [f, f || '— pilih —']; }), k.fungsi || '')) +
      fld('PIC', inp('pic', k.pic, 'list="dlPic" placeholder="nama PIC kontrak"') + '<datalist id="dlPic">' + Object.keys(pics).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>') +
      fld('Tanggal mulai', inp('mulai', k.mulai, 'type="date"')) +
      fld('Tanggal berakhir *', inp('akhir', k.akhir, 'type="date" required')) +
      fld('Nilai kontrak', inp('nilai', k.nilai != null && k.nilai !== '' ? nf2.format(+k.nilai) : '', 'inputmode="decimal" placeholder="mis. 1.250.000.000"')) +
      fld('Mata uang', sel('cur', ['IDR', 'USD', 'EUR', 'SGD'], k.cur || 'IDR')) +
      fld('Purchasing Group', inp('pg', k.pg, 'placeholder="mis. X07"')) +
      fld('Tindak lanjut', sel('tindak', Object.keys(Model.TINDAK).map(function (t) { return [t, Model.TINDAK[t]]; }), k.tindak || '')) +
      fld('Catatan', '<textarea class="input" name="catatan" rows="3">' + esc(k.catatan || '') + '</textarea>', 'wide') +
      '</div><h3 class="section-title" style="margin-top:22px">Jaminan pelaksanaan (opsional)</h3><div class="fleet-form mk-form">' +
      fld('Nomor jaminan', inp('jNo', j.no)) + fld('Penerbit (bank / asuransi)', inp('jBank', j.bank)) +
      fld('Nilai jaminan', inp('jNilai', j.nilai ? nf2.format(+j.nilai) : '', 'inputmode="decimal"')) + fld('Berlaku s/d', inp('jAkhir', j.akhir, 'type="date"')) +
      '</div><div class="fleet-actions" style="margin-top:18px"><button class="btn primary" type="submit">' + (id ? 'Simpan perubahan' : 'Simpan kontrak') + '</button>' +
      '<a class="btn" href="' + (id ? '#/kontrak/' + esc(id) : '#/' + (k.kat === 'GS' ? 'gs' : k.kat === 'Warehouse' ? 'wh' : 'kontrak')) + '">Batal</a><span class="small muted">* wajib diisi · tersimpan untuk semua pengguna ±1 menit setelah disimpan</span></div></form>';
  }
  async function submitForm(form) {
    var id = form.getAttribute('data-id'), g = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    var rec = {
      no: g('no'), jenis: g('jenis'), kat: g('kat'), field: g('field'), short: g('short'), judul: g('judul'), vendor: g('vendor'), vendorCode: g('vendorCode'), fungsi: g('fungsi'), pic: g('pic'),
      mulai: g('mulai'), akhir: g('akhir'), nilai: parseNum(g('nilai')), cur: g('cur') || 'IDR', pg: g('pg').toUpperCase(), tindak: g('tindak'), catatan: g('catatan'),
      jaminan: { no: g('jNo'), bank: g('jBank'), nilai: parseNum(g('jNilai')), akhir: g('jAkhir') }
    };
    if (!rec.no || !rec.judul || !rec.akhir) { toast('Nomor kontrak, judul & tanggal berakhir wajib diisi', true); return; }
    if (rec.mulai && rec.akhir < rec.mulai) { toast('Tanggal berakhir lebih awal dari tanggal mulai', true); return; }
    var dup = S.D.list.filter(function (x) { return x.no === rec.no && x.id !== id; })[0];
    if (dup && !(await confirmBox('Nomor kontrak sudah ada', 'Nomor <b>' + esc(rec.no) + '</b> sudah dipakai kontrak "' + esc(dup.judul || '') + '". Tetap simpan sebagai kontrak terpisah?', 'Tetap simpan'))) return;
    var newId = id || uid('K'), now = new Date().toISOString();
    var ok = await save(function (D) {
      var k = findK(newId, D);
      if (!k) { k = { id: newId, createdBy: me(), createdAt: now, realisasi: [], amandemen: [], docs: [], log: [] }; D.list.push(k); addLog(k, 'Kontrak dibuat'); }
      else {
        var ch = [];
        ['no', 'judul', 'vendor', 'akhir', 'nilai', 'pic', 'tindak'].forEach(function (f) { if (String(k[f] == null ? '' : k[f]) !== String(rec[f] == null ? '' : rec[f])) ch.push(f); });
        k.editedBy = me(); k.editedAt = now;
        addLog(k, 'Data diubah' + (ch.length ? ' (' + ch.join(', ') + ')' : ''));
      }
      Object.assign(k, rec);
    }, (id ? 'Edit kontrak ' : 'Tambah kontrak ') + rec.no);
    if (ok) { toast(id ? 'Perubahan disimpan' : 'Kontrak ditambahkan'); location.hash = '#/kontrak/' + newId; }
  }

  // ================= Realisasi, amandemen, dokumen =================
  async function addReal(id, rid) {
    var k = findK(id); if (!k) return;
    var old = rid ? (k.realisasi || []).filter(function (x) { return x.id === rid; })[0] : null;
    var bill = Wh.billing(Model.info(k, settings())), o = old || { periode: bill.missing[0] || Wh.prevMonth() };
    var r = await modal((old ? 'Edit tagihan — ' : 'Input tagihan — ') + (k.short || k.no),
      '<div class="fleet-form">' + fld('Periode (bulan pekerjaan) *', inp('periode', o.periode, 'type="month" required')) + fld('Nilai tanpa PPN (' + esc(k.cur || 'IDR') + ') *', inp('nilai', o.nilai ? nf2.format(+o.nilai) : '', 'required inputmode="decimal" placeholder="mis. 246.500.000"')) +
      fld('No. PR', inp('pr', o.pr)) + fld('No. RO / PO', inp('ro', o.ro)) + fld('No. SA / BA', inp('sa', o.sa)) + fld('Tanggal invoice', inp('invTgl', o.invTgl, 'type="date"')) +
      fld('No. invoice', inp('ref', o.ref), 'wide') + fld('Keterangan', inp('uraian', o.uraian, 'placeholder="mis. Termijn ke-36 / Tagihan-8"'), 'wide') + '</div>' +
      '<p class="small muted" style="margin:10px 0 0">PR, RO, SA & invoice boleh dikosongkan dulu dan dilengkapi nanti lewat tombol edit.</p>', 'Simpan',
      { validate: function (x) { return !(parseNum(x.nilai) > 0) ? 'Nilai tagihan harus lebih dari 0' : !/^\d{4}-\d{2}$/.test(x.periode) ? 'Pilih periode (bulan)' : null; } });
    if (!r) return;
    var dup = (k.realisasi || []).filter(function (x) { return x.periode === r.periode && x.id !== rid; })[0];
    if (dup && !(await confirmBox('Periode sudah ada', 'Tagihan <b>' + esc(Wh.ymLabel(r.periode, true)) + '</b> sudah tercatat (' + esc(fmtMoney(+dup.nilai, k.cur)) + '). Tambahkan sebagai tagihan kedua di bulan yang sama?', 'Tetap tambah'))) return;
    var nid = rid || uid('R'), lastDay = new Date(+r.periode.slice(0, 4), +r.periode.slice(5, 7), 0).getDate();
    var rec = Object.assign({}, old || {}, { id: nid, periode: r.periode, tgl: r.invTgl || r.periode + '-' + lastDay, nilai: parseNum(r.nilai), pr: r.pr.trim(), ro: r.ro.trim(), sa: r.sa.trim(), ref: r.ref.trim(), invTgl: r.invTgl, uraian: r.uraian.trim(), by: me(), at: new Date().toISOString() });
    if (await save(function (D) {
      var x = findK(id, D); if (!x) throw new Error('Kontrak sudah dihapus');
      x.realisasi = (x.realisasi || []).filter(function (y) { return y.id !== nid; }).concat([rec]);
      addLog(x, (old ? 'Tagihan diubah: ' : 'Tagihan ') + Wh.ymLabel(rec.periode, true) + ' ' + fmtMoney(rec.nilai, x.cur));
    }, (old ? 'Edit tagihan ' : 'Tagihan ') + k.no + ' ' + rec.periode)) { toast(old ? 'Tagihan diperbarui' : 'Tagihan ' + Wh.ymLabel(rec.periode, true) + ' dicatat'); render(); }
  }
  async function delReal(id, rid) {
    var k = findK(id), r = k && (k.realisasi || []).filter(function (x) { return x.id === rid; })[0];
    if (!r || !(await confirmBox('Hapus realisasi?', 'Tagihan ' + esc(fmtMoney(+r.nilai, k.cur)) + ' ' + (r.periode ? Wh.ymLabel(r.periode, true) : fmtDate(r.tgl)) + (r.ref ? ' (' + esc(r.ref) + ')' : '') + ' akan dihapus.', 'Hapus'))) return;
    if (await save(function (D) {
      var x = findK(id, D); if (!x) return;
      x.realisasi = (x.realisasi || []).filter(function (y) { return y.id !== rid; });
      addLog(x, 'Realisasi dihapus: ' + fmtMoney(+r.nilai, x.cur));
      addAudit(D, 'Realisasi', x.no + ' · ' + fmtMoney(+r.nilai, x.cur) + ' · ' + r.tgl, r);
    }, 'Hapus realisasi ' + k.no)) { toast('Realisasi dihapus'); render(); }
  }
  async function addAm(id) {
    var k = findK(id); if (!k) return;
    var i = Model.info(k, settings());
    var r = await modal('Tambah amandemen — ' + k.no,
      '<div class="fleet-form">' + fld('No. amandemen', inp('no', '', 'placeholder="mis. Amd-01/…"')) + fld('Tanggal amandemen', inp('tgl', Model.todayStr(), 'type="date" required')) +
      fld('Tanggal berakhir baru', inp('akhir', '', 'type="date"')) + fld('Nilai kontrak baru (total)', inp('nilai', '', 'inputmode="decimal" placeholder="kosongkan bila tidak berubah"')) +
      fld('Keterangan', inp('ket', '', 'placeholder="mis. perpanjangan waktu 6 bulan"'), 'wide') + '</div>' +
      '<p class="small muted" style="margin:10px 0 0">Saat ini: berakhir <b>' + fmtDate(i.end) + '</b>, nilai <b>' + esc(fmtMoney(i.value, k.cur)) + '</b>.</p>', 'Simpan',
      { validate: function (o) { return !o.akhir && !parseNum(o.nilai) ? 'Isi tanggal berakhir baru dan/atau nilai baru' : null; } });
    if (!r) return;
    var aid = uid('A'), rec = { id: aid, no: r.no.trim(), tgl: r.tgl, akhir: r.akhir, nilai: parseNum(r.nilai), ket: r.ket.trim(), by: me(), at: new Date().toISOString() };
    if (await save(function (D) {
      var x = findK(id, D); if (!x) throw new Error('Kontrak sudah dihapus');
      x.amandemen = (x.amandemen || []).filter(function (y) { return y.id !== aid; }).concat([rec]);
      if (x.tindak === 'amandemen') x.tindak = '';
      addLog(x, 'Amandemen ' + (rec.no || '') + (rec.akhir ? ' → berakhir ' + fmtDate(rec.akhir) : '') + (rec.nilai ? ' → nilai ' + fmtMoney(rec.nilai, x.cur) : ''));
    }, 'Amandemen kontrak ' + k.no)) { toast('Amandemen dicatat'); render(); }
  }
  async function delAm(id, aid) {
    var k = findK(id), a = k && (k.amandemen || []).filter(function (x) { return x.id === aid; })[0];
    if (!a || !(await confirmBox('Hapus amandemen?', 'Amandemen ' + esc(a.no || fmtDate(a.tgl)) + ' akan dihapus.', 'Hapus'))) return;
    if (await save(function (D) {
      var x = findK(id, D); if (!x) return;
      x.amandemen = (x.amandemen || []).filter(function (y) { return y.id !== aid; });
      addLog(x, 'Amandemen dihapus: ' + (a.no || a.tgl));
      addAudit(D, 'Amandemen', x.no + ' · ' + (a.no || a.tgl), a);
    }, 'Hapus amandemen ' + k.no)) { toast('Amandemen dihapus'); render(); }
  }
  async function setTindak(id, val) {
    var k = findK(id); if (!k || (k.tindak || '') === val) return;
    if (await save(function (D) {
      var x = findK(id, D); if (!x) return;
      x.tindak = val; x.editedBy = me(); x.editedAt = new Date().toISOString();
      addLog(x, 'Tindak lanjut: ' + Model.TINDAK[val]);
    }, 'Tindak lanjut ' + k.no + ': ' + Model.TINDAK[val])) toast('Tindak lanjut disimpan');
    render();
  }
  async function delK(id) {
    var k = findK(id); if (!k || !canWrite()) return;
    if (!(await confirmBox('Hapus kontrak?', 'Kontrak <b>' + esc(k.no) + '</b> — ' + esc(k.judul || '') + ' beserta realisasi, amandemen & ' + (k.docs || []).length + ' dokumen akan dihapus. Tercatat di History hapus.', 'Hapus kontrak'))) return;
    var dels = (k.docs || []).map(function (d) { return d.path; });
    if (await save(function (D) {
      var x = findK(id, D); if (!x) return;
      D.list = D.list.filter(function (y) { return y.id !== id; });
      var copy = clone(x); delete copy.log;
      addAudit(D, 'Kontrak', x.no + ' · ' + (x.judul || ''), copy);
    }, 'Hapus kontrak ' + k.no, { deletes: dels })) { toast('Kontrak dihapus'); location.hash = '#/kontrak'; }
  }

  async function addDoc(id) {
    var k = findK(id); if (!k) return;
    var r = await modal('Upload dokumen — ' + k.no,
      '<div class="fleet-form">' + fld('File (PDF / JPG / PNG, maks. 20 MB)', '<input class="input" type="file" name="file" accept="application/pdf,image/jpeg,image/png" required>', 'wide') +
      fld('Judul dokumen', inp('title', '', 'placeholder="kosongkan = nama file"'), 'wide') + fld('Kategori', sel('cat', DOC_CATS, 'Kontrak')) + '</div>', 'Upload',
      { validate: function (o) { var f = o.file && o.file[0]; return !f ? 'Pilih file' : f.size > 20 * 1048576 ? 'File lebih dari 20 MB' : null; } });
    if (!r) return;
    var f = r.file[0];
    loading('Mengenkripsi ' + f.name + '…');
    var did = uid('D'), path = Vault.filePath(did);
    var u8 = new Uint8Array(await f.arrayBuffer());
    var payload = await Vault.encryptBytes(S.key, u8);
    S.files[did] = new Blob([u8], { type: f.type || 'application/pdf' });
    var meta = { id: did, title: r.title.trim() || f.name.replace(/\.[^.]+$/, ''), cat: r.cat, fileName: f.name, type: f.type, size: f.size, path: path, by: me(), at: new Date().toISOString() };
    var files = {}; files[path] = Vault.fileFile(did, payload);
    if (await save(function (D) {
      var x = findK(id, D); if (!x) throw new Error('Kontrak sudah dihapus');
      x.docs = (x.docs || []).filter(function (y) { return y.id !== did; }).concat([meta]);
      addLog(x, 'Dokumen diupload: ' + meta.title);
    }, 'Dokumen kontrak ' + k.no + ': ' + meta.title, { files: files, loading: 'Mengupload dokumen…' })) { toast('Dokumen tersimpan'); render(); }
  }
  async function delDoc(id, did) {
    var k = findK(id), d = k && (k.docs || []).filter(function (x) { return x.id === did; })[0];
    if (!d || !(await confirmBox('Hapus dokumen?', 'Dokumen <b>' + esc(d.title) + '</b> akan dihapus.', 'Hapus'))) return;
    if (await save(function (D) {
      var x = findK(id, D); if (!x) return;
      x.docs = (x.docs || []).filter(function (y) { return y.id !== did; });
      addLog(x, 'Dokumen dihapus: ' + d.title);
      addAudit(D, 'Dokumen', x.no + ' · ' + d.title, { title: d.title, fileName: d.fileName });
    }, 'Hapus dokumen ' + k.no, { deletes: [d.path] })) { toast('Dokumen dihapus'); render(); }
  }
  async function docBlob(d) {
    if (S.files[d.id]) return S.files[d.id];
    var payload = null;
    try {
      window.MK_FILE = window.MK_FILE || {};
      await loadScript(d.path + '?v=' + d.id);
      payload = window.MK_FILE[d.id];
      delete window.MK_FILE[d.id];
    } catch (e) { /* belum tersedia di GitHub Pages */ }
    if (!payload && GH.hasToken()) payload = Vault.payloadOf(await GH.readText(d.path));
    if (!payload) throw new Error('File belum tersedia (GitHub Pages sedang memproses, coba ±1 menit lagi)');
    var u8 = await Vault.decryptBytes(S.key, payload);
    return (S.files[d.id] = new Blob([u8], { type: d.type || 'application/pdf' }));
  }
  async function viewDoc(id, did) {
    var k = findK(id), d = k && (k.docs || []).filter(function (x) { return x.id === did; })[0];
    if (!d) return;
    loading('Membuka dokumen…');
    try {
      var blob = await docBlob(d), url = URL.createObjectURL(blob);
      loading(false);
      var v = $('#viewer'), isImg = /^image\//.test(blob.type);
      v.innerHTML = '<div class="viewer-bar"><div style="min-width:0"><b>' + esc(d.title) + '</b><div class="small" style="opacity:.75">' + esc([d.cat, k.no].filter(Boolean).join(' · ')) + '</div></div><span class="spacer"></span>' +
        '<a class="btn sm" href="' + url + '" download="' + esc(d.fileName || d.title) + '">Download</a>' +
        '<a class="btn sm" href="' + url + '" target="_blank" rel="noopener">Buka di tab baru</a>' +
        '<button class="btn sm" data-act="viewer-close">' + ICON.close + ' Tutup</button></div>' +
        '<div class="pdf-pages" id="pdfPages">' + (isImg ? '<img src="' + url + '" style="max-width:100%;border-radius:6px">' : '<div class="pdf-msg">Memuat dokumen…</div>') + '</div>';
      v.classList.remove('hidden');
      if (!isImg) renderPdf($('#pdfPages'), url).catch(function () { var b = $('#pdfPages'); if (b) b.innerHTML = '<iframe src="' + url + '" title="' + esc(d.title) + '"></iframe>'; });
    } catch (e) { loading(false); toast(e.message, true); }
  }
  async function renderPdf(box, url) {
    if (!window.pdfjsLib) { await loadScript('vendor/pdf.min.js'); window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; }
    var pdf = await window.pdfjsLib.getDocument({ url: url }).promise;
    if (!box.isConnected) return;
    box.innerHTML = '';
    var width = Math.min(box.clientWidth - 24, 1000), dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (var i = 1; i <= pdf.numPages; i++) {
      if (!box.isConnected) return;
      var page = await pdf.getPage(i), vp = page.getViewport({ scale: 1 }), scale = width / vp.width, v2 = page.getViewport({ scale: scale * dpr });
      var c = document.createElement('canvas');
      c.width = v2.width; c.height = v2.height; c.style.width = width + 'px'; c.style.height = (vp.height * scale) + 'px';
      box.appendChild(c);
      await page.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
    }
  }

  // ================= Jatuh tempo =================
  function renderDue() {
    $('#pageActions').innerHTML = '<select class="select" id="dueSrc">' + [['', 'OA & kontrak Warehouse/GS'], ['sap', 'OA material (ME3N) saja'], ['manual', 'Kontrak Warehouse & GS saja']].map(function (o) { return '<option value="' + o[0] + '"' + ((S.dueSrc || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<select class="select" id="dueH">' + [3, 6, 12, 24].map(function (n) { return '<option value="' + n + '"' + (S.dueH === n ? ' selected' : '') + '>' + n + ' bulan ke depan</option>'; }).join('') + '</select>';
    var w = canWrite(), st = settings(), notes = S.D.oaNotes || {};
    var items = [];
    if (S.dueSrc !== 'sap') infos().filter(function (i) { return !i.closed && i.end; }).forEach(function (i) { items.push({ m: i, end: i.end, days: i.days, crit: i.st === 'crit' }); });
    if (S.dueSrc !== 'manual' && Sap.has()) Sap.dueList().filter(function (x) { return !x.closed && x.end; }).forEach(function (x) { items.push({ s: x, end: x.end, days: x.days, crit: x.days != null && x.days <= st.crit }); });
    if (!items.length && !S.D.list.length && !Sap.has()) { view.innerHTML = emptyState(); return; }
    var now = new Date(), lim = new Date(now.getFullYear(), now.getMonth() + S.dueH, 1), limS = lim.getFullYear() + '-' + ('0' + (lim.getMonth() + 1)).slice(-2);
    var exp = items.filter(function (i) { return i.days < 0; });
    var groups = {};
    items.filter(function (i) { return i.days >= 0 && i.end.slice(0, 7) < limS; }).forEach(function (i) { (groups[i.end.slice(0, 7)] = groups[i.end.slice(0, 7)] || []).push(i); });
    function dB(days) { return days < 0 ? '<span class="badge bad">Lewat ' + nf0.format(-days) + ' hari</span>' : '<span class="badge ' + (days <= st.crit ? 'bad' : days <= st.warn ? 'warn' : 'ok') + '">' + nf0.format(days) + ' hari lagi</span>'; }
    function tSel(attr, val) { return '<select class="select sm" ' + attr + '>' + Object.keys(Model.TINDAK).map(function (t) { return '<option value="' + t + '"' + ((val || '') === t ? ' selected' : '') + '>' + Model.TINDAK[t] + '</option>'; }).join('') + '</select>'; }
    function rows(list) {
      return list.sort(function (a, b) { return a.end < b.end ? -1 : a.end > b.end ? 1 : 0; }).map(function (it) {
        if (it.m) {
          var i = it.m, k = i.k;
          return '<tr><td class="nowrap"><b>' + fmtDate(i.end) + '</b><div>' + dB(i.days) + '</div></td>' +
            '<td><span class="badge">' + esc(k.kat || 'Lainnya') + '</span> <a class="mono" href="#/kontrak/' + esc(k.id) + '" style="font-weight:700">' + esc(k.no) + '</a><div class="small muted">' + esc(k.jenis || '') + '</div></td>' +
            '<td class="mat-cell"><div class="mat-desc">' + esc(k.judul || '—') + '</div><div class="small muted">' + esc(k.vendor || '') + (k.pic ? ' · PIC ' + esc(k.pic) : '') + '</div></td>' +
            '<td style="min-width:120px">' + bar(i.realPct, absorbCls(i.realPct)) + '<div class="small muted">' + pct(i.realPct) + ' · sisa ' + esc(fmtBig(i.sisa, k.cur)) + '</div></td>' +
            '<td>' + (w ? tSel('data-tindak="' + esc(k.id) + '"', k.tindak) : '<span class="badge ' + (k.tindak ? 'ro' : 'warn') + '">' + esc(Model.TINDAK[k.tindak || '']) + '</span>') + '</td></tr>';
        }
        var x = it.s, o = x.x.o, key = x.c + ':' + x.no, n = notes[key] || {};
        return '<tr><td class="nowrap"><b>' + fmtDate(x.end) + '</b><div>' + dB(x.days) + '</div></td>' +
          '<td>' + Sap.clientBadge(x.c) + ' <a class="mono" href="#/oa/' + esc(x.c + '/' + x.no) + '" style="font-weight:700">' + esc(x.no) + '</a><div class="small muted">OA ME3N' + (o.pg ? ' · ' + esc(o.pg) : '') + '</div></td>' +
          '<td class="mat-cell"><div class="mat-desc">' + esc(o.vendor || '—') + '</div><div class="small muted">' + esc(x.x.cat || '') + (n.catatan ? ' · <i>' + esc(n.catatan) + '</i>' : '') + '</div></td>' +
          '<td style="min-width:120px">' + bar(x.x.pct, absorbCls(x.x.pct)) + '<div class="small muted">' + pct(x.x.pct) + ' · sisa ' + esc(fmtBig(x.x.sisa, o.cur)) + '</div></td>' +
          '<td>' + (w ? Sap.oaTindakSelect(x.c, x.no, n.tindak) : '<span class="badge ' + (n.tindak ? 'ro' : 'warn') + '">' + esc(Model.TINDAK[n.tindak || '']) + '</span>') + '</td></tr>';
      }).join('');
    }
    var head = '<thead><tr><th>Berakhir</th><th>No. kontrak / OA</th><th>Pekerjaan / vendor</th><th>Serapan</th><th>Tindak lanjut</th></tr></thead>';
    var html = '';
    if (exp.length) html += '<div class="mk-due-group bad"><h3>Lewat masa berlaku — belum ditutup <span class="badge bad">' + exp.length + '</span></h3><div class="table-wrap"><table class="grid">' + head + '<tbody>' + rows(exp) + '</tbody></table></div></div>';
    Object.keys(groups).sort().forEach(function (ym) {
      var g = groups[ym], soon = g.some(function (i) { return i.crit; });
      html += '<div class="mk-due-group' + (soon ? ' bad' : '') + '"><h3>' + BULAN[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4) + ' <span class="badge ' + (soon ? 'bad' : 'warn') + '">' + g.length + ' kontrak</span></h3><div class="table-wrap"><table class="grid">' + head + '<tbody>' + rows(g) + '</tbody></table></div></div>';
    });
    view.innerHTML = (Sap.has() ? '<div class="toolbar" style="margin-bottom:12px">' + Sap.clientChips() + '</div>' : '') +
      (html || '<div class="card empty"><h3>Tidak ada kontrak yang berakhir dalam ' + S.dueH + ' bulan ke depan</h3></div>');
  }

  // ================= Export Excel =================
  async function exportExcel() {
    loading('Menyiapkan Excel…');
    try {
      await loadXLSX();
      var list = currentRoute().name === 'kontrak' ? filtered() : infos();
      var rows = list.map(function (i) {
        var k = i.k, j = k.jaminan || {};
        return {
          'No. Kontrak / OA': k.no, 'Jenis': k.jenis || '', 'Judul / Pekerjaan': k.judul || '', 'Vendor': k.vendor || '', 'Kode Vendor': k.vendorCode || '',
          'Fungsi': k.fungsi || '', 'PIC': k.pic || '', 'Purch. Group': k.pg || '', 'Mulai': k.mulai || '', 'Berakhir (awal)': k.akhir || '', 'Berakhir (efektif)': i.end || '',
          'Sisa hari': i.days, 'Status': i.stLabel, 'Mata Uang': k.cur || 'IDR', 'Nilai Awal': +k.nilai || 0, 'Nilai Efektif': i.value, 'Realisasi': i.real,
          'Sumber Realisasi': i.realSrc === 'sap' ? 'SAP ME3N' : i.realSrc === 'manual' ? 'Manual' : '', 'Serapan %': i.realPct == null ? '' : Math.round(i.realPct * 10) / 10,
          'Sisa Nilai': i.sisa, 'Waktu Berjalan %': i.timePct == null ? '' : Math.round(i.timePct), 'Jumlah Amandemen': i.amCount, 'Tindak Lanjut': Model.TINDAK[k.tindak || ''],
          'No. Jaminan': j.no || '', 'Jaminan s/d': j.akhir || '', 'Peringatan': i.flags.map(function (f) { return f.t; }).join('; '), 'Catatan': k.catatan || ''
        };
      });
      var rl = [];
      list.forEach(function (i) { (i.k.realisasi || []).forEach(function (r) { rl.push({ 'No. Kontrak': i.k.no, 'Tanggal': r.tgl, 'Referensi': r.ref || '', 'Uraian': r.uraian || '', 'Nilai': +r.nilai, 'Oleh': r.by || '' }); }); });
      var am = [];
      list.forEach(function (i) { (i.k.amandemen || []).forEach(function (a) { am.push({ 'No. Kontrak': i.k.no, 'No. Amandemen': a.no || '', 'Tanggal': a.tgl, 'Berakhir Baru': a.akhir || '', 'Nilai Baru': a.nilai || '', 'Keterangan': a.ket || '' }); }); });
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0] || { a: 1 }).map(function (h) { return { wch: Math.min(40, Math.max(10, h.length + 2)) }; });
      XLSX.utils.book_append_sheet(wb, ws, 'Kontrak');
      if (rl.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rl), 'Realisasi');
      if (am.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(am), 'Amandemen');
      XLSX.writeFile(wb, 'Monitoring-Kontrak-' + Model.todayStr() + '.xlsx');
    } catch (e) { toast('Gagal export: ' + e.message, true); }
    finally { loading(false); }
  }
  async function downloadTemplate() {
    await loadXLSX();
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([TPL_HEAD, ['4610012345', 'Kontrak Jasa', 'Jasa Pengangkutan Material Zona 1', 'PT Contoh Vendor', 'SCM - Warehouse & Distribution', 'Nama PIC', '2026-01-01', '2027-12-31', 2500000000, 'IDR', 'contoh — hapus baris ini']]);
    ws['!cols'] = TPL_HEAD.map(function () { return { wch: 22 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Kontrak');
    XLSX.writeFile(wb, 'Template-Import-Kontrak.xlsx');
  }
  var TPL_HEAD = ['No Kontrak', 'Jenis', 'Judul Pekerjaan', 'Vendor', 'Fungsi', 'PIC', 'Tanggal Mulai', 'Tanggal Berakhir', 'Nilai Kontrak', 'Mata Uang', 'Catatan'];
  var TPL_COLS = {
    no: ['no kontrak', 'nomor kontrak', 'no. kontrak', 'no oa', 'nomor oa', 'no. oa', 'no kontrak / oa', 'contract no'],
    jenis: ['jenis', 'jenis kontrak', 'tipe'], judul: ['judul pekerjaan', 'judul', 'nama pekerjaan', 'pekerjaan', 'uraian', 'deskripsi'],
    vendor: ['vendor', 'penyedia', 'nama vendor', 'mitra'], fungsi: ['fungsi', 'fungsi pengguna', 'user'], pic: ['pic'],
    mulai: ['tanggal mulai', 'mulai', 'tgl mulai', 'start'], akhir: ['tanggal berakhir', 'berakhir', 'tgl berakhir', 'tanggal akhir', 'akhir', 'end', 'masa berlaku'],
    nilai: ['nilai kontrak', 'nilai', 'value'], cur: ['mata uang', 'currency', 'cur'], catatan: ['catatan', 'keterangan', 'remark']
  };

  // ================= Import =================
  function renderImport() {
    var wh = warehouseUrl(), I = S.imp;
    view.innerHTML = Sap.uploadCard() + '<div class="card card-pad" id="storageCard" style="margin-bottom:16px"><h4 class="section-title">Penyimpanan GitHub</h4><div class="small muted">Menghitung…</div></div>' +
      '<details class="card set-sec"' + (I ? ' open' : '') + '><summary><span class="set-t">Import kontrak dari Excel / Warehouse</span><span class="set-chev"></span></summary><div class="set-body"><div class="ds-grid" style="margin-bottom:16px">' +
      '<div class="card ds-card"><h4>' + ICON.link + ' Ambil dari Material Warehouse</h4><p class="small muted" style="margin:0;line-height:1.6">Tarik daftar OA dari data <b>ME3N</b> yang sudah di-upload di website <a href="' + esc(wh) + '" target="_blank" rel="noopener">Material Warehouse</a> — tanpa upload ulang. ' +
      'Perlu akun Warehouse (otomatis bila Anda sedang login Warehouse di browser ini).</p><div class="toolbar" style="margin-top:auto"><button class="btn primary" data-act="imp-wh">' + ICON.link + ' Ambil data ME3N Warehouse</button></div></div>' +
      '<div class="card ds-card"><h4>' + ICON.upload + ' Upload file Excel</h4><p class="small muted" style="margin:0;line-height:1.6">File export <b>ME3N</b> SAP (dideteksi otomatis dari judul kolom), atau <b>template Excel</b> daftar kontrak (kontrak jasa, SPK, dll. yang tidak ada di ME3N).</p>' +
      '<div class="toolbar" style="margin-top:auto"><label class="btn primary">' + ICON.upload + ' Pilih file Excel<input type="file" id="impFile" accept=".xlsx,.xls,.xlsm" hidden></label><button class="btn" data-act="tpl">' + ICON.excel + ' Download template</button></div></div></div>' +
      '<div id="impBox">' + (I ? '' : '<div class="card card-pad small muted" style="line-height:1.7"><b>Cara kerja import:</b><ul style="margin:6px 0 0;padding-left:18px"><li>Nomor kontrak yang <b>belum ada</b> → ditambahkan sebagai kontrak baru.</li><li>Nomor yang <b>sudah ada</b> → data SAP (periode, nilai target, realisasi/open value) diperbarui. Judul, PIC, catatan, realisasi manual, amandemen & dokumen <b>tidak</b> ditimpa.</li><li>Pilih dulu baris yang akan diimport di tabel preview — tidak ada yang tersimpan sebelum klik <b>Import</b>.</li></ul></div>') + '</div></div></details>';
    fillStorage();

    if (I) renderImpTable();
  }
  function impFiltered() {
    var I = S.imp, q = (I.q || '').toLowerCase(), today = Model.todayStr();
    return I.rows.filter(function (r) {
      if (I.pg && r.pg !== I.pg) return false;
      if (I.active && r.akhir && r.akhir < today) return false;
      if (I.onlyNew && r.state !== 'new') return false;
      if (q && [r.no, r.vendor, r.cat, r.judul].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function impState(r) {
    var ex = S.D.list.filter(function (k) { return k.no === r.no; })[0];
    if (!ex) return 'new';
    if (r.kind === 'sap') {
      var s = ex.sap || {};
      return s.akhir === r.akhir && +s.nilai === +r.nilai && +s.open === +r.open ? 'same' : 'upd';
    }
    return 'upd';
  }
  function renderImpTable() {
    var I = S.imp, list = impFiltered(), pgs = {};
    I.rows.forEach(function (r) { r.state = impState(r); if (r.pg) pgs[r.pg] = (pgs[r.pg] || 0) + 1; });
    var nSel = I.rows.filter(function (r) { return I.sel[r.no]; }).length;
    var stl = { 'new': ['ok', 'Baru'], upd: ['ro', 'Update'], same: ['', 'Sama'] };
    var rows = list.slice(0, 500).map(function (r) {
      return '<tr><td class="c"><input type="checkbox" data-isel="' + esc(r.no) + '"' + (I.sel[r.no] ? ' checked' : '') + '></td><td><span class="badge ' + stl[r.state][0] + '">' + stl[r.state][1] + '</span></td>' +
        '<td class="mono">' + esc(r.no) + '</td><td class="mat-cell"><div class="mat-desc">' + esc(r.judul || r.cat || '—') + '</div><div class="small muted">' + esc(r.vendor || '') + '</div></td>' +
        '<td>' + (r.pg ? '<span class="pg-tag">' + esc(r.pg) + '</span>' : '') + '</td><td class="nowrap small">' + fmtDate(r.mulai) + ' – ' + fmtDate(r.akhir) + '</td>' +
        '<td class="num nowrap">' + esc(fmtBig(r.nilai, r.cur)) + '</td><td class="num nowrap">' + (r.rel != null ? esc(fmtBig(r.rel, r.cur)) : '—') + '</td><td class="num">' + (r.items || '') + '</td></tr>';
    }).join('');
    $('#impBox').innerHTML = '<div class="card card-pad" style="margin-bottom:12px"><div class="toolbar"><div><b>' + esc(I.source) + '</b><div class="small muted">' + I.rows.length + ' kontrak terbaca · ' + I.rows.filter(function (r) { return r.state === 'new'; }).length + ' baru · ' + I.rows.filter(function (r) { return r.state === 'upd'; }).length + ' berubah</div></div><span class="spacer"></span>' +
      '<button class="btn" data-act="imp-cancel">Batal</button><button class="btn primary" data-act="imp-go"' + (nSel ? '' : ' disabled') + '>Import ' + nSel + ' kontrak terpilih</button></div>' +
      '<div class="toolbar" style="margin-top:12px"><input class="input" id="impQ" placeholder="Cari nomor / vendor…" value="' + esc(I.q || '') + '" style="min-width:220px">' +
      (Object.keys(pgs).length ? '<select class="select" id="impPg"><option value="">Semua Purch. Group</option>' + Object.keys(pgs).sort().map(function (p) { return '<option' + (I.pg === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>' : '') +
      '<span class="chip-toggle' + (I.active ? ' on' : '') + '" data-imp="active">Hanya yang masih berlaku</span><span class="chip-toggle' + (I.onlyNew ? ' on' : '') + '" data-imp="onlyNew">Hanya yang baru</span>' +
      '<span class="spacer"></span><button class="btn sm" data-act="imp-all">Pilih semua (' + list.length + ')</button><button class="btn sm" data-act="imp-none">Kosongkan</button></div></div>' +
      '<div class="table-wrap tall"><table class="grid"><thead><tr><th></th><th>Status</th><th>No. OA / Kontrak</th><th>Judul / Vendor</th><th>PG</th><th>Periode</th><th class="num">Nilai</th><th class="num">Realisasi SAP</th><th class="num">Item</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="9" class="center muted" style="padding:24px">Tidak ada baris yang cocok dengan filter</td></tr>') + '</tbody></table></div>' +
      (list.length > 500 ? '<div class="small muted" style="margin-top:8px">Menampilkan 500 dari ' + list.length + ' — persempit dengan filter/cari.</div>' : '');
  }
  function setImport(source, rows) {
    S.imp = { source: source, rows: rows, sel: {}, pg: '', active: true, onlyNew: false, q: '' };
    var today = Model.todayStr();
    rows.forEach(function (r) { r.state = impState(r); if ((!r.akhir || r.akhir >= today) && r.state !== 'same') S.imp.sel[r.no] = true; });
    if (currentRoute().name !== 'import') location.hash = '#/import'; else renderImport();
  }
  function fromME3N(rows, date) {
    return Model.aggregateME3N(rows).map(function (h) { return Object.assign(h, { kind: 'sap', date: date, judul: '' }); });
  }

  async function importFile(file) {
    if (!file) return;
    loading('Membaca ' + file.name + '…');
    try {
      var buf = await file.arrayBuffer(), res = null;
      try { res = await parseInWorker(buf, file.name, file.lastModified); } catch (e) { if (!/Format tidak dikenali/.test(e.message)) throw e; }
      var me3n = res && res.parts.filter(function (p) { return p.type === 'me3n'; })[0];
      if (me3n) { setImport('File ME3N: ' + file.name + ' (data ' + fmtDate(res.date) + ')', fromME3N(me3n.rows, res.date)); return; }
      if (res) throw new Error('File ini berisi ' + res.parts.map(function (p) { return p.type.toUpperCase(); }).join(', ') + ', bukan ME3N / template kontrak');
      await loadXLSX();
      var rows = templateRows(XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false }));
      if (!rows.length) throw new Error('Tidak ada baris kontrak terbaca. Gunakan file ME3N atau template (Download template).');
      setImport('Template Excel: ' + file.name, rows);
    } catch (e) { toast('Gagal membaca file: ' + e.message, true); }
    finally { loading(false); }
  }
  function parseInWorker(buf, name, lm) {
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker('js/worker.js?v=' + APP_VERSION); } catch (e) { return reject(e); }
      w.onmessage = function (e) { w.terminate(); if (e.data.ok) resolve(e.data.res); else reject(new Error(e.data.error)); };
      w.onerror = function (e) { e.preventDefault(); w.terminate(); reject(new Error('Gagal membaca file di background')); };
      w.postMessage({ buf: buf, name: name, lastModified: lm }, [buf]);
    });
  }
  function xlDateStr(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') { var d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function templateRows(wb) {
    var out = [];
    wb.SheetNames.forEach(function (sn) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false });
      for (var h = 0; h < Math.min(rows.length, 15); h++) {
        var heads = (rows[h] || []).map(function (x) { return String(x == null ? '' : x).toLowerCase().replace(/\s+/g, ' ').trim(); }), map = {};
        Object.keys(TPL_COLS).forEach(function (k) { for (var i = 0; i < heads.length; i++) if (TPL_COLS[k].indexOf(heads[i]) >= 0) { map[k] = i; break; } });
        if (map.no == null || map.akhir == null) continue;
        for (var r = h + 1; r < rows.length; r++) {
          var row = rows[r] || [], g = function (k) { return map[k] == null ? null : row[map[k]]; };
          var no = String(g('no') == null ? '' : g('no')).trim();
          if (!no) continue;
          var nilai = g('nilai');
          out.push({ kind: 'excel', no: no, jenis: String(g('jenis') || '').trim(), judul: String(g('judul') || '').trim(), vendor: String(g('vendor') || '').trim(),
            fungsi: String(g('fungsi') || '').trim(), pic: String(g('pic') || '').trim(), mulai: xlDateStr(g('mulai')), akhir: xlDateStr(g('akhir')),
            nilai: typeof nilai === 'number' ? nilai : parseNum(nilai), cur: String(g('cur') || 'IDR').trim().toUpperCase() || 'IDR', catatan: String(g('catatan') || '').trim(), pg: '', rel: null });
        }
        return;
      }
    });
    var seen = {};
    return out.filter(function (r) { if (seen[r.no]) return false; seen[r.no] = 1; return true; });
  }

  // ---------- Penyimpanan GitHub ----------
  function sizeTxt(b) {
    if (b == null) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1).replace('.', ',') + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return (b / 1073741824).toFixed(2).replace('.', ',') + ' GB';
  }
  function storageGroup(path) {
    if (path === 'data/sap.js') return 'Data SAP (ME3N, ME2N, progres)';
    if (path === 'data/kontrak.js') return 'Kontrak Warehouse & GS + tagihan';
    if (/^data\/files\//.test(path)) return 'Dokumen kontrak (PDF)';
    if (/^data\//.test(path)) return 'Data lain (pengguna, token)';
    if (/^assets\//.test(path)) return 'Foto & gambar';
    if (/^vendor\//.test(path)) return 'Library (Excel, PDF)';
    return 'Kode website (HTML, JS, CSS)';
  }
  async function fillStorage(force) {
    var box = $('#storageCard');
    if (!box) return;
    var GB = 1073741824;
    var head = '<h4 class="section-title" style="display:flex;align-items:center">Penyimpanan GitHub<span class="spacer"></span><button class="btn sm" data-act="storage-refresh">Hitung ulang</button></h4>';
    var sb = function (used) { var p = Math.min(100, used / GB * 100); return '<div class="progress storage-bar' + (p >= 90 ? ' bad' : p >= 70 ? ' warn' : '') + '"><i style="width:' + Math.max(p, 0.6).toFixed(1) + '%"></i></div>'; };
    if (!GH.hasToken()) { box.innerHTML = head + '<div class="small muted">Perlu koneksi GitHub (Pengaturan → Koneksi GitHub).</div>'; return; }
    if (force) box.innerHTML = head + '<div class="small muted">Menghitung…</div>';
    try {
      var info = await GH.req('GET', ''), tree = await GH.req('GET', '/git/trees/' + GH.BRANCH + '?recursive=1');
      var groups = {}, total = 0, files = [];
      tree.tree.forEach(function (e) {
        if (e.type !== 'blob') return;
        total += e.size || 0; files.push(e);
        var g = storageGroup(e.path);
        (groups[g] = groups[g] || { size: 0, n: 0 }).size += e.size || 0; groups[g].n++;
      });
      if (!box.isConnected) return;
      var repo = (info.size || 0) * 1024;
      var gl = Object.keys(groups).sort(function (a, b) { return groups[b].size - groups[a].size; });
      var big = files.sort(function (a, b) { return (b.size || 0) - (a.size || 0); }).slice(0, 6);
      box.innerHTML = head + '<div class="storage-grid">' +
        '<div class="storage-kpi"><div class="k">Website (file yang tayang)</div><div class="v">' + sizeTxt(total) + '</div>' + sb(total) + '<div class="s">' + (total / GB * 100).toFixed(2).replace('.', ',') + '% dari batas GitHub Pages 1 GB · ' + files.length + ' file</div></div>' +
        '<div class="storage-kpi"><div class="k">Repo GitHub (termasuk riwayat versi)</div><div class="v">' + sizeTxt(repo) + '</div>' + sb(repo) + '<div class="s">' + (repo / GB * 100).toFixed(2).replace('.', ',') + '% dari anjuran 1 GB</div></div></div>' +
        '<div class="storage-cols"><div><div class="small" style="font-weight:700;margin:10px 0 6px">Rincian isi website</div><table class="grid"><tbody>' +
        gl.map(function (g) { return '<tr><td>' + esc(g) + '<div class="small muted">' + groups[g].n + ' file</div></td><td class="num"><b>' + sizeTxt(groups[g].size) + '</b></td><td class="num small muted">' + (groups[g].size / total * 100).toFixed(1).replace('.', ',') + '%</td></tr>'; }).join('') +
        '</tbody></table></div><div><div class="small" style="font-weight:700;margin:10px 0 6px">File terbesar</div><table class="grid"><tbody>' +
        big.map(function (e) { return '<tr><td class="mono small" style="word-break:break-all">' + esc(e.path) + '</td><td class="num"><b>' + sizeTxt(e.size) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>';
    } catch (e) { box.innerHTML = head + '<div class="small" style="color:var(--bad)">Gagal membaca dari GitHub: ' + esc(e.message) + '</div>'; }
  }

  // ---------- Koneksi ke Material Warehouse ----------
  function whSessionKey() {
    try {
      var v = sessionStorage.getItem('mw:session') || localStorage.getItem('mw:session');
      var s = v ? JSON.parse(v) : null;
      return s && s.key ? Vault.fromB64(s.key) : null;
    } catch (e) { return null; }
  }
  async function whLogin() {
    var wh = warehouseUrl();
    window.MW_USERS = null;
    await loadScript(wh + 'data/users.js?t=' + Date.now());
    if (!window.MW_USERS) throw new Error('Data pengguna Warehouse tidak terbaca dari ' + wh);
    var r = await modal('Login Material Warehouse', '<p class="small muted" style="margin:0 0 12px;line-height:1.6">Masukkan akun website <b>Material Warehouse</b> untuk membuka data ME3N (sekali per sesi). Password tidak disimpan.</p>' +
      '<div class="fleet-form">' + fld('Username Warehouse', inp('u', me(), 'required autocomplete="off"'), 'wide') + fld('Password', '<input class="input" type="password" name="p" required>', 'wide') + '</div>', 'Buka data');
    if (!r) return null;
    loading('Memeriksa akun Warehouse…');
    try { var res = await Vault.login(window.MW_USERS, r.u, r.p, 'mw:'); return res.key; }
    finally { loading(false); }
  }
  async function loadWarehouseOA() {
    var wh = warehouseUrl();
    loading('Membaca daftar versi data Warehouse…');
    try {
      window.MW_MANIFEST = null;
      await loadScript(wh + 'data/manifest.js?t=' + Date.now());
      var man = window.MW_MANIFEST;
      if (!man || !man.versions || !(man.versions.oa || []).length) throw new Error('Belum ada data ME3N di website Warehouse');
      var list = man.versions.oa, id = man.active && man.active.oa, v = list.filter(function (x) { return x.id === id; })[0] || list[0];
      loading('Mengunduh data ME3N Warehouse ' + fmtDate(v.date) + '…');
      window.MW_SNAP = window.MW_SNAP || {};
      await loadScript(wh + 'data/' + v.id + '.js?v=' + encodeURIComponent(v.id));
      var payload = window.MW_SNAP[v.id];
      delete window.MW_SNAP[v.id];
      if (!payload) throw new Error('File data ME3N tidak ditemukan');
      loading(false);
      var keys = [S.whKey, whSessionKey()].filter(Boolean), ds = null;
      for (var i = 0; i < keys.length && !ds; i++) { try { ds = await Vault.decrypt(keys[i], payload); S.whKey = keys[i]; } catch (e) { /* kunci lain */ } }
      while (!ds) {
        var k = await whLogin();
        if (!k) return;
        try { ds = await Vault.decrypt(k, payload); S.whKey = k; } catch (e) { toast('Akun Warehouse tidak bisa membuka data ini', true); }
      }
      setImport('Material Warehouse — ME3N ' + fmtDate(v.date) + ' (upload ' + (v.by || '-') + ')', fromME3N(ds.rows || [], v.date));
      toast('Data ME3N Warehouse terbaca: ' + S.imp.rows.length + ' OA');
    } catch (e) {
      toast(/Username atau password/.test(e.message) ? 'Username / password Warehouse salah' : 'Gagal mengambil data Warehouse: ' + e.message, true);
    } finally { loading(false); }
  }

  async function runImport() {
    var I = S.imp, pick = I.rows.filter(function (r) { return I.sel[r.no]; });
    if (!pick.length) return;
    var st = settings(), now = new Date().toISOString(), oaJenis = st.jenis.filter(function (j) { return /^OA/i.test(j); })[0] || st.jenis[0];
    var ids = {}; pick.forEach(function (r) { ids[r.no] = uid('K'); });
    var nNew = 0, nUpd = 0;
    var ok = await save(function (D) {
      nNew = 0; nUpd = 0;
      pick.forEach(function (r) {
        var k = D.list.filter(function (x) { return x.no === r.no; })[0];
        if (!k) {
          k = { id: ids[r.no], no: r.no, createdBy: me(), createdAt: now, realisasi: [], amandemen: [], docs: [], log: [], src: r.kind, tindak: '' };
          D.list.push(k); nNew++;
          if (r.kind === 'sap') Object.assign(k, { jenis: oaJenis, judul: r.cat ? 'OA ' + r.cat : 'OA ' + r.no });
          addLog(k, 'Diimport dari ' + (r.kind === 'sap' ? 'ME3N SAP' : 'Excel'));
        } else { nUpd++; addLog(k, 'Diperbarui dari ' + (r.kind === 'sap' ? 'ME3N SAP ' + (r.date || '') : 'Excel')); }
        if (r.kind === 'sap') {
          if (!k.vendor || k.src === 'sap') { k.vendor = r.vendor; k.vendorCode = r.vendorCode; }
          if (r.pg) k.pg = r.pg;
          if (!k.mulai || k.src === 'sap') k.mulai = r.mulai || k.mulai;
          if (k.src === 'sap' || !k.akhir) k.akhir = r.akhir || k.akhir;
          if (k.src === 'sap' || k.nilai == null || k.nilai === '') k.nilai = r.nilai;
          k.cur = r.cur || k.cur || 'IDR';
          k.sap = { nilai: r.nilai, open: r.open, rel: r.rel, akhir: r.akhir, date: r.date, items: r.items };
        } else {
          ['jenis', 'judul', 'vendor', 'fungsi', 'pic', 'mulai', 'akhir', 'catatan', 'cur'].forEach(function (f) { if (r[f]) k[f] = r[f]; });
          if (r.nilai != null) k.nilai = r.nilai;
          if (!k.jenis) k.jenis = st.jenis[0];
          if (!k.judul) k.judul = k.no;
        }
        k.editedBy = me(); k.editedAt = now;
      });
    }, 'Import ' + pick.length + ' kontrak dari ' + I.source.split(':')[0].split(' — ')[0], { loading: 'Mengimport ' + pick.length + ' kontrak…' });
    if (ok) { toast('Import selesai: ' + nNew + ' baru, ' + nUpd + ' diperbarui'); S.imp = null; S.f.st = 'open'; location.hash = '#/kontrak'; }
  }

  // ================= Pengaturan =================
  function renderSettings() {
    var st = settings(), owner = isOwner(), w = canWrite();
    var sec = function (title, body, id) { return '<div class="card card-pad"' + (id ? ' id="' + id + '"' : '') + '><h4 class="section-title">' + title + '</h4>' + body + '</div>'; };
    var top = '<div class="card card-pad toolbar"><div><div class="small muted">Masuk sebagai</div><b style="font-size:16px">' + esc(me()) + '</b> ' + roleBadge(role()) + '</div><span class="spacer"></span><button class="btn" data-act="logout">Keluar</button></div>';
    var pwBox = '<div><div style="font-weight:700;margin-bottom:6px">Ganti password saya</div><form id="pwForm" class="toolbar" autocomplete="off">' +
      '<input class="input sm" type="password" name="pw" placeholder="Password baru" required minlength="6" autocomplete="new-password">' +
      '<input class="input sm" type="password" name="pw2" placeholder="Ulangi password baru" required autocomplete="new-password">' +
      '<button class="btn sm primary" type="submit">Simpan</button></form></div>';

    var users = '';
    if (owner) {
      var rows = S.users.map(function (u) {
        var self = S.user && u.id === S.user.id, warn = u.role === 'writer' && !u.ak ? ' <span class="badge warn" title="Isi password orang tsb lalu Simpan agar bisa menyimpan data">belum bisa simpan</span>' : '';
        var ctl = self || u.role === 'owner' ? '' :
          '<select class="select sm" data-urole>' + ['writer', 'viewer'].map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + roleLabel(r) + '</option>'; }).join('') + '</select>' +
          '<input class="input sm" type="password" data-upw placeholder="' + (u.role === 'writer' && u.ak ? 'Password baru (opsional)' : 'Password orang tsb (wajib)') + '" autocomplete="new-password" style="width:200px">' +
          '<button class="btn sm" data-act="user-save">Simpan</button><button class="btn sm danger" data-act="user-del" title="Hapus pengguna">' + ICON.trash + '</button>';
        return '<tr data-uid="' + esc(u.id) + '"><td><b>' + esc(u.name) + '</b>' + (self ? ' <span class="badge ro">Anda</span>' : '') + '</td><td>' + roleBadge(u.role) + warn + '</td>' +
          '<td class="right"><div class="toolbar" style="justify-content:flex-end">' + ctl + '</div></td></tr>';
      }).join('');
      users = sec('Pengguna &amp; Login',
        '<div class="table-wrap"><table class="grid"><thead><tr><th>Username</th><th>Peran</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="set-2col">' +
        '<div><div style="font-weight:700;margin-bottom:6px">Tambah pengguna</div><form id="addUser" class="toolbar" autocomplete="off">' +
        '<input class="input sm" name="u" placeholder="Username" required autocomplete="off">' +
        '<input class="input sm" type="password" name="pw" placeholder="Password" required minlength="6" autocomplete="new-password">' +
        '<select class="select sm" name="role"><option value="writer">Owner (bisa mengedit)</option><option value="viewer">Reader (lihat saja)</option></select>' +
        '<button class="btn sm primary" type="submit">Tambah</button></form></div>' + pwBox + '</div>' +
        '<div class="small muted" style="margin-top:10px"><b>Owner</b> bisa mengedit semua data · <b>Reader</b> hanya melihat · pengguna &amp; token GitHub diatur Owner Utama.</div>');
    } else if (w) {
      users = sec('Akun saya', pwBox);
    }

    var ghCard = owner ? sec('Koneksi GitHub',
      '<p class="muted small" style="margin-top:0">Agar data yang disimpan langsung tampil untuk semua pengguna.</p>' +
      '<div class="toolbar" style="margin-bottom:10px"><span>Status:</span>' + (GH.hasToken() ? '<span class="badge ok">Terhubung ke ' + esc(GH.repo()) + '</span>' : '<span class="badge warn">Belum terhubung</span>') + '</div>' +
      '<ol class="steps small"><li>Buka <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub › Fine-grained token baru</a> (login sebagai pemilik repo).</li>' +
      '<li>Isi <b>Token name</b> bebas (mis. "Monitoring Kontrak"), <b>Expiration</b> → <i>Custom</i> ±1 tahun.</li>' +
      '<li><b>Repository access</b> → <i>Only select repositories</i> → pilih <b>' + esc(GH.repo().split('/')[1]) + '</b>.</li>' +
      '<li><b>Permissions › Repository permissions › Contents</b> → <b>Read and write</b>.</li>' +
      '<li>Klik <b>Generate token</b>, salin token (diawali <span class="mono">github_pat_</span>), tempel di bawah lalu klik <b>Simpan &amp; Tes</b>.</li></ol>' +
      '<form id="tokForm" class="toolbar" style="margin-top:8px" autocomplete="off"><input class="input sm mono masked" name="tok" style="flex:1;min-width:260px" placeholder="' + (GH.hasToken() ? 'Token tersimpan — isi untuk mengganti' : 'github_pat_…') + '" required autocomplete="off" spellcheck="false" data-lpignore="true" data-1p-ignore>' +
      '<button class="btn sm primary" type="submit">Simpan &amp; Tes</button></form>' +
      '<div class="small muted" style="margin-top:8px">Hanya <b>Owner Utama</b> yang mengisi token. Token otomatis dibagikan terenkripsi ke semua Writer (mereka tidak pernah melihat token).</div>') : '';

    var cl = st.clients || {};
    var sapCard = sec('Monitoring SAP', owner ?
      '<form id="sapSetForm" autocomplete="off"><div class="set-grid">' +
      fld('Kurs USD → IDR', '<input class="input" name="kurs" inputmode="decimal" value="' + esc(nf0.format(+st.kurs || 16000)) + '">') +
      fld('Nama Client 100', '<input class="input" name="c100" value="' + esc(cl['100'] || 'Pertamina EP') + '">') +
      fld('Nama Client 180', '<input class="input" name="c180" value="' + esc(cl['180'] || 'PHE') + '">') +
      '</div><div class="small muted" style="margin-top:6px">Kurs dipakai untuk total gabungan IDR + USD di Dashboard, Kontrak OA &amp; PO/RO.</div>' +
      '<div class="toolbar" style="margin-top:12px"><button class="btn sm primary" type="submit">Simpan</button></div></form>'
      : '<div class="small" style="line-height:1.8">Kurs USD: <b>' + nf0.format(+st.kurs || 16000) + '</b> · Client 100: <b>' + esc(cl['100'] || 'Pertamina EP') + '</b> · Client 180: <b>' + esc(cl['180'] || 'PHE') + '</b></div>');

    var remind = sec('Pengingat &amp; daftar pilihan', owner ?
      '<form id="setForm" autocomplete="off"><div class="set-grid">' +
      fld('Segera berakhir (hari)', '<input class="input" type="number" name="warn" min="1" value="' + st.warn + '">') +
      fld('Kritis (hari)', '<input class="input" type="number" name="crit" min="1" value="' + st.crit + '">') +
      fld('Peringatan serapan nilai (%)', '<input class="input" type="number" name="absorb" min="1" max="200" value="' + st.absorbWarn + '">') + '</div>' +
      '<div class="set-grid" style="margin-top:12px">' +
      fld('Jenis kontrak (satu per baris)', '<textarea class="input" name="jenis" rows="6">' + esc(st.jenis.join('\n')) + '</textarea>') +
      fld('Fungsi pengguna (satu per baris)', '<textarea class="input" name="fungsi" rows="6">' + esc(st.fungsi.join('\n')) + '</textarea>') + '</div>' +
      '<div class="toolbar" style="margin-top:12px"><button class="btn sm primary" type="submit">Simpan pengaturan</button></div></form>'
      : '<div class="small" style="line-height:1.8">Segera berakhir ≤ <b>' + st.warn + '</b> hari · Kritis ≤ <b>' + st.crit + '</b> hari · Peringatan serapan ≥ <b>' + st.absorbWarn + '%</b></div>');

    var wh = warehouseUrl();
    var whCard = sec('Integrasi Material Warehouse',
      '<p class="muted small" style="margin-top:0;line-height:1.6">Tombol <b>Material di Warehouse</b> di detail OA membuka daftar material OA tersebut di website Warehouse, dan <b>Upload Data → Ambil data ME3N Warehouse</b> menarik daftar OA ke Daftar Kontrak tanpa upload ulang.</p>' +
      (owner ? '<form id="whForm" class="toolbar" autocomplete="off"><input class="input sm" name="url" value="' + esc(st.warehouseUrl || '') + '" placeholder="' + esc(defaultWarehouseUrl()) + '" style="flex:1;min-width:260px"><button class="btn sm primary" type="submit">Simpan URL</button></form>' : '') +
      '<div class="toolbar" style="margin-top:10px"><a class="btn sm" href="' + esc(wh) + '" target="_blank" rel="noopener">' + ICON.ext + ' Buka website Warehouse</a></div>');

    var audit = (S.D.audit || []);
    var auditCard = w ? sec('History hapus data',
      '<p class="muted small" style="margin-top:0">Catatan siapa yang menghapus data apa &amp; kapan — kontrak, realisasi, amandemen, dokumen, pengguna.</p>' +
      (audit.length ? '<div class="table-wrap" style="max-height:340px"><table class="grid"><thead><tr><th>Waktu</th><th>Oleh</th><th>Data</th><th>Keterangan</th></tr></thead><tbody>' +
        audit.slice(0, 200).map(function (a) { return '<tr><td class="nowrap small">' + fmtDateTime(a.at) + '</td><td>' + esc(a.by) + '</td><td><span class="badge">' + esc(a.what) + '</span></td><td class="small">' + esc(a.label) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="small muted" style="margin:0">Belum ada data yang dihapus.</p>')) : '';

    view.innerHTML = '<div class="mk-settings">' + top + users + ghCard + sapCard + remind + whCard + auditCard + '</div>' +
      '<div class="small muted" style="margin-top:16px">Monitoring Kontrak · versi ' + APP_VERSION + ' · data terakhir disimpan ' + esc(S.D.updatedBy || '—') + ' · ' + fmtDateTime(S.D.updatedAt) + '</div>';
    collapseSettings(view.querySelector('.mk-settings'));
  }
  // Setiap kartu (kecuali akun) jadi bagian buka-tutup; status buka diingat di browser (sama seperti Material Warehouse)
  function collapseSettings(root) {
    var open = Store.load('setOpen', null) || { 'Pengguna & Login': true, 'Akun saya': true };
    Array.prototype.slice.call(root.children).forEach(function (card, i) {
      if (i === 0 || !card.classList.contains('card')) return;
      var h = card.querySelector('h4.section-title');
      if (!h || h.parentNode !== card) return;
      var key = h.textContent.trim(), d = document.createElement('details'), sm = document.createElement('summary'), body = document.createElement('div');
      d.className = 'card set-sec';
      if (open[key]) d.open = true;
      sm.innerHTML = '<span class="set-t">' + h.innerHTML + '</span><span class="set-chev" aria-hidden="true"></span>';
      h.remove();
      body.className = 'set-body';
      while (card.firstChild) body.appendChild(card.firstChild);
      d.appendChild(sm); d.appendChild(body);
      d.addEventListener('toggle', function () { var o = Store.load('setOpen', null) || { 'Pengguna & Login': true, 'Akun saya': true }; o[key] = d.open; Store.save('setOpen', o); });
      card.replaceWith(d);
    });
  }

  // ---------- Pengguna (users.js) ----------
  function parseUsers(text) {
    if (!text) return [];
    var m = /window\.MK_USERS\s*=\s*([\s\S]*?);?\s*$/.exec(text.trim());
    return m ? JSON.parse(m[1]) : [];
  }
  async function saveUsers(mutate, msg) {
    if (!(await ensureToken())) { toast('Akses simpan belum aktif', true); return false; }
    loading('Menyimpan pengguna…');
    try {
      var cur = parseUsers(await GH.readText('data/users.js'));
      if (!cur.length) cur = S.users;
      var next = await mutate(cur);
      await GH.commit({ 'data/users.js': Vault.usersFile(next) }, [], msg);
      S.users = next; window.MK_USERS = next;
      return true;
    } catch (e) { toast('Gagal menyimpan: ' + e.message, true); return false; }
    finally { loading(false); }
  }
  async function addUser(f) {
    var u = f.u.value.trim(), r = f.role.value, pw = f.pw.value;
    if (u.length < 3) { toast('Username minimal 3 karakter', true); return; }
    if (pw.length < 6) { toast('Password minimal 6 karakter', true); return; }
    var h = await Vault.hashUser(u);
    if (S.users.some(function (x) { return x.id === h; })) { toast('Username sudah ada', true); return; }
    if (r === 'writer' && !S.adminKey) { toast('Kunci akses belum tersedia — logout lalu login ulang sebagai Owner', true); return; }
    loading('Membuat akun…');
    var entry = await Vault.makeUser(u, pw, r, S.key, u, S.adminKey);
    if (await saveUsers(function (list) { return list.filter(function (x) { return x.id !== entry.id; }).concat([entry]); }, 'Tambah pengguna ' + u + ' (' + roleLabel(r) + ')')) {
      toast(u + ' ditambahkan sebagai ' + roleLabel(r)); renderSettings();
    }
  }
  async function saveUserRow(tr) {
    var id = tr.getAttribute('data-uid'), u = S.users.filter(function (x) { return x.id === id; })[0];
    if (!u || u.role === 'owner') return;
    var r = tr.querySelector('[data-urole]').value, pw = tr.querySelector('[data-upw]').value;
    var entry;
    if (pw) {
      if (pw.length < 6) { toast('Password minimal 6 karakter', true); return; }
      loading('Menyimpan…');
      entry = await Vault.makeUser(u.name, pw, r, S.key, u.name, S.adminKey);
      entry.id = u.id;
    } else if (r === 'writer' && !u.ak) {
      toast('Untuk menjadikan Writer, isi password baru ' + u.name + ' (akses simpan dikunci dengan password)', true); return;
    } else {
      entry = Object.assign({}, u, { role: r });
      if (r !== 'writer') { delete entry.ak; delete entry.aiv; }
    }
    if (await saveUsers(function (list) { return list.map(function (x) { return x.id === id ? entry : x; }); }, 'Pengguna ' + u.name + ' → ' + roleLabel(r) + (pw ? ' (password diatur ulang)' : ''))) {
      toast('Pengguna ' + u.name + ' disimpan' + (pw ? ' — berikan password baru ke yang bersangkutan' : '')); renderSettings();
    }
  }
  async function delUser(tr) {
    var id = tr.getAttribute('data-uid'), u = S.users.filter(function (x) { return x.id === id; })[0];
    if (!u || u.role === 'owner' || !(await confirmBox('Hapus pengguna?', 'Akun <b>' + esc(u.name) + '</b> tidak akan bisa login lagi.', 'Hapus'))) return;
    if (await saveUsers(function (list) { return list.filter(function (x) { return x.id !== id; }); }, 'Hapus pengguna ' + u.name)) {
      await save(function (D) { addAudit(D, 'Pengguna', u.name + ' (' + roleLabel(u.role) + ')'); }, 'History hapus pengguna');
      toast('Pengguna dihapus'); renderSettings();
    }
  }
  async function changePw(f) {
    var pw = f.pw.value, pw2 = f.pw2.value;
    if (pw.length < 6) { toast('Password baru minimal 6 karakter', true); return; }
    if (pw !== pw2) { toast('Ulangi password tidak sama', true); return; }
    if (canWrite() && !S.adminKey) { toast('Kunci akses belum ada di sesi ini — logout, login ulang, lalu ganti password', true); return; }
    loading('Menyimpan password baru…');
    var entry = await Vault.makeUser(me(), pw, role(), S.key, me(), S.adminKey);
    entry.id = S.user.id;
    if (await saveUsers(function (list) { return list.map(function (x) { return x.id === entry.id ? entry : x; }); }, 'Ganti password ' + me())) {
      toast('Password diganti. Gunakan password baru saat login berikutnya.'); f.reset();
    }
  }
  async function saveToken(tok) {
    if (!isOwner()) return;
    if (!S.adminKey) { toast('Kunci akses belum tersedia — logout lalu login ulang', true); return; }
    loading('Mengecek token…');
    try {
      await GH.testToken(tok);
      GH.config({ token: tok });
      var enc = await Vault.encrypt(S.adminKey, { t: tok });
      await GH.commit({ 'data/admin.js': adminFile(enc) }, [], 'Token GitHub diperbarui (' + me() + ')');
      window.MK_ADMIN = { tok: enc };
      toast('Token tersimpan & dibagikan terenkripsi ke Writer');
      renderSettings();
    } catch (e) { toast('Token gagal: ' + e.message, true); }
    finally { loading(false); }
  }

  // ================= Event =================
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'scrim') { closeDrawer(); return; }
    var go = t.closest('[data-goto]');
    if (go) { S.f.st = go.getAttribute('data-goto'); S.f.q = ''; Store.save('filters', S.f); }
    var tr = t.closest('tr[data-open]');
    if (tr && !t.closest('a,button,select,input')) { location.hash = '#/kontrak/' + tr.getAttribute('data-open'); return; }
    var chip = t.closest('[data-st]');
    if (chip) { S.f.st = chip.getAttribute('data-st'); Store.save('filters', S.f); renderList(); return; }
    var ic = t.closest('[data-imp]');
    if (ic && S.imp) { var key = ic.getAttribute('data-imp'); S.imp[key] = !S.imp[key]; renderImpTable(); return; }
    var b = t.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'toggle-pw') { var p = $('#lgPw'); p.type = p.type === 'password' ? 'text' : 'password'; b.classList.toggle('on', p.type === 'text'); }
    else if (act === 'logout') logout();
    else if (act === 'export') exportExcel();
    else if (act === 'storage-refresh') fillStorage(true);
    else if (act === 'tpl') downloadTemplate();
    else if (act === 'add-real') addReal(id);
    else if (act === 'edit-real') addReal(id, b.getAttribute('data-rid'));
    else if (act === 'del-real') delReal(id, b.getAttribute('data-rid'));
    else if (act === 'add-am') addAm(id);
    else if (act === 'del-am') delAm(id, b.getAttribute('data-aid'));
    else if (act === 'add-doc') addDoc(id);
    else if (act === 'del-doc') delDoc(id, b.getAttribute('data-did'));
    else if (act === 'view-doc') viewDoc(id, b.getAttribute('data-did'));
    else if (act === 'viewer-close') { var v = $('#viewer'); v.classList.add('hidden'); v.innerHTML = ''; }
    else if (act === 'del-k') delK(id);
    else if (act === 'imp-wh') loadWarehouseOA();
    else if (act === 'imp-cancel') { S.imp = null; renderImport(); }
    else if (act === 'imp-all') { impFiltered().forEach(function (r) { S.imp.sel[r.no] = true; }); renderImpTable(); }
    else if (act === 'imp-none') { S.imp.sel = {}; renderImpTable(); }
    else if (act === 'imp-go') runImport();
    else if (act === 'user-save') saveUserRow(b.closest('tr'));
    else if (act === 'user-del') delUser(b.closest('tr'));
  });
  var timer;
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'kq') { S.f.q = t.value; clearTimeout(timer); timer = setTimeout(function () { Store.save('filters', S.f); renderRows(); }, 150); }
    else if (t.id === 'impQ') { S.imp.q = t.value; clearTimeout(timer); timer = setTimeout(function () { renderImpTable(); var i = $('#impQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'kjenis') { S.f.jenis = t.value; Store.save('filters', S.f); renderRows(); }
    else if (t.id === 'kfungsi') { S.f.fungsi = t.value; Store.save('filters', S.f); renderRows(); }
    else if (t.id === 'ksort') { S.f.sort = t.value; Store.save('filters', S.f); renderRows(); }
    else if (t.id === 'dueH') { S.dueH = +t.value; renderDue(); }
    else if (t.id === 'dueSrc') { S.dueSrc = t.value; renderDue(); }
    else if (t.id === 'impPg') { S.imp.pg = t.value; renderImpTable(); }
    else if (t.id === 'impFile') { importFile(t.files[0]); t.value = ''; }
    else if (t.hasAttribute('data-isel')) { S.imp.sel[t.getAttribute('data-isel')] = t.checked; renderImpTable(); }
    else if (t.hasAttribute('data-tindak')) setTindak(t.getAttribute('data-tindak'), t.value);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'loginForm') { e.preventDefault(); doLogin(); }
    else if (f.id === 'setupForm') { e.preventDefault(); doSetup(); }
    else if (f.id === 'kForm') { e.preventDefault(); submitForm(f); }
    else if (f.id === 'addUser') { e.preventDefault(); addUser(f); }
    else if (f.id === 'pwForm') { e.preventDefault(); changePw(f); }
    else if (f.id === 'tokForm') { e.preventDefault(); saveToken(f.tok.value.trim()); }
    else if (f.id === 'whForm') {
      e.preventDefault();
      var url = f.url.value.trim();
      if (url && !/^https?:\/\//.test(url)) { toast('URL harus diawali https://', true); return; }
      save(function (D) { D.settings = Object.assign({}, Model.settingsOf(D), { warehouseUrl: url }); }, 'URL Material Warehouse').then(function (ok) { if (ok) { toast('URL Warehouse disimpan'); render(); } });
    } else if (f.id === 'sapSetForm') {
      e.preventDefault();
      var k = parseNum(f.kurs.value);
      if (!(k > 1000)) { toast('Isi kurs USD yang benar, mis. 16.000', true); return; }
      save(function (D) { D.settings = Object.assign({}, Model.settingsOf(D), { kurs: k, clients: { '100': f.c100.value.trim() || 'Pertamina EP', '180': f.c180.value.trim() || 'PHE' } }); }, 'Pengaturan Monitoring SAP').then(function (ok) { if (ok) { toast('Pengaturan disimpan'); Sap.reset(); render(); } });
    } else if (f.id === 'setForm') {
      e.preventDefault();
      var lines = function (s) { return s.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
      var ns = { warn: Math.max(1, +f.warn.value || 90), crit: Math.max(1, +f.crit.value || 30), absorbWarn: Math.max(1, +f.absorb.value || 90), jenis: lines(f.jenis.value), fungsi: lines(f.fungsi.value) };
      if (ns.crit > ns.warn) { toast('Hari "Kritis" harus lebih kecil dari "Segera berakhir"', true); return; }
      save(function (D) { D.settings = Object.assign({}, Model.settingsOf(D), ns); }, 'Pengaturan pengingat').then(function (ok) { if (ok) { toast('Pengaturan disimpan'); render(); } });
    }
  });
  window.addEventListener('hashchange', render);

  // Versi baru website: muat ulang otomatis sekali
  function checkUpdate() {
    fetch('index.html?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
      var m = /app\.js\?v=([\w]+)/.exec(html || '');
      if (!m || m[1] === APP_VERSION) return;
      var k = 'mk:reload-' + m[1];
      try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { return; }
      toast('Versi baru website tersedia — memuat ulang…');
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    checkUpdate();
    // data terbaru dari pengguna lain
    if (S.user && S.D && !$('.pw-modal') && !$('#kForm') && !S.sapPending && !$('#drawer.open')) loadData().then(render).catch(function () {});
  });

  async function startApp(fresh) {
    loading('Memuat data kontrak…');
    try {
      await unlockToken();
      if (!fresh) await loadData(); else await Sap.load();
      loading(false);
      render();
    } catch (e) { loading(false); toast('Gagal memuat data: ' + e.message, true); }
  }
  async function boot() {
    loading('Memuat…');
    await loadMeta();
    loading(false);
    if (!S.users.length) { showSetup(); return; }
    var sess = sessionGet();
    if (sess && sess.user && sess.key && S.users.some(function (u) { return u.id === sess.user.id; })) {
      var cur = S.users.filter(function (u) { return u.id === sess.user.id; })[0];
      S.user = { id: cur.id, name: cur.name, role: cur.role };
      S.key = Vault.fromB64(sess.key);
      S.adminKey = sess.ak && Vault.hasAdminKey(cur.role) ? Vault.fromB64(sess.ak) : null;
      await startApp();
      checkUpdate();
    } else { sessionClear(); showLogin(); }
  }
  boot();
})();

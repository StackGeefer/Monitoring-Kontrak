/*
 * Kontrak OA (ME3N) ala Material Warehouse + alur Permintaan RO:
 *   pilih item di detail OA (saran qty dari stok & pemakaian Zona 1)
 *   → Permintaan RO → MIM isi No. PR → RO terbit (otomatis terhubung ke ME2N) → diterima.
 * Permintaan RO disimpan di data kontrak (data/kontrak.js → roReq), ringkasan stok di data/stok.js.
 */
(function (root) {
  'use strict';
  var PG_MAIN = ['X07', 'X02'];
  var PG_LABEL = { X07: 'Zona 1', X02: 'Regional 1' };
  var PLANT_NAME = { W101: 'Rantau', W803: 'Lirik', W802: 'Jambi', W102: 'Pangkalan Susu' };
  var RO_ST = { 'Menunggu PR': 'warn', 'PR dibuat': 'ro', 'RO terbit': 'bau', Diterima: 'ok', Selesai: 'ok', Batal: '' };
  var PAGE = 60;

  function OaMod(ctx) {
    var S = ctx.S, esc = ctx.esc, ICON = ctx.ICON, Sap = ctx.Sap, $ = function (s) { return document.querySelector(s); };
    var V = { q: '', pg: '', active: true, sort: 'rel', n: PAGE, home: ctx.Store.load('roHome', 'W101'), f: 'all', rq: '', rst: '' };
    var sel = ctx.Store.load('roSel', null) || { key: '', items: {} };
    var memo = null;

    function st() { return ctx.settings(); }
    function cover() { return +st().cover || 3; }
    function lead() { return st().lead != null ? +st().lead : 1; }
    function today() { return ctx.Model.todayStr(); }
    function pgTag(pg) { return pg ? '<span class="pg-tag' + (PG_MAIN.indexOf(pg) < 0 ? ' other' : '') + '">' + esc(pg) + '</span>' + (PG_LABEL[pg] ? ' <span class="small muted">' + PG_LABEL[pg] + '</span>' : '') : ''; }
    function stk(m) { return S.stok && S.stok.m && S.stok.m[m]; }
    function hasStok() { return !!(S.stok && S.stok.m); }
    function fmtQ(n) { return ctx.fmtQ(n); }
    function plantLabel(p) { return (PLANT_NAME[p] || p); }
    function homeIdx() { return ['W101', 'W803', 'W802', 'W102'].indexOf(V.home); }

    // ---------- statistik per OA (stok & pemakaian Zona 1) ----------
    function itemInfo(c, it) {
      if (c !== '100' || !hasStok()) return null;
      var o = stk(it[1]) || { s: [0, 0, 0, 0] }, hi = homeIdx();
      var sg = root.Stok.suggest(o, V.home, cover(), lead());
      var used = !!(o.u && Object.keys(o.u).length), usedHome = !!(o.u && o.u[V.home]);
      var other = o.s.reduce(function (a, v, i) { return i === hi ? a : a + v; }, 0);
      return { o: o, sg: sg, used: used, usedHome: usedHome, home: o.s[hi] || 0, other: other, empty: usedHome && !(o.s[hi] > 0) };
    }
    function stats(x) {
      var key = (S.stok && S.stok.src && S.stok.src.at) + '|' + V.home + '|' + cover() + '|' + lead() + '|' + (S.sap && S.sap.updatedAt);
      if (!memo || memo.key !== key) memo = { key: key, m: {} };
      var k = x.c + ':' + x.no;
      if (memo.m[k]) return memo.m[k];
      var used = 0, empty = 0, sug = 0;
      x.o.items.forEach(function (it) {
        if (it[8] === 'L') return;
        var i = itemInfo(x.c, it); if (!i) return;
        if (i.usedHome) used++;
        if (i.empty) empty++;
        if (i.sg.sug > 0) sug++;
      });
      return (memo.m[k] = { used: used, empty: empty, sug: sug });
    }
    function reqsOf(c, no) { return roList().filter(function (r) { return r.c === c && r.oa === no; }); }

    // ================= Daftar OA =================
    function pgPass(pg) {
      var F = V.pg;
      if (!F) return PG_MAIN.indexOf(pg) >= 0;
      if (F === '*other') return PG_MAIN.indexOf(pg) < 0;
      if (F === '*all') return true;
      return pg === F;
    }
    function filtered() {
      var q = V.q.trim().toLowerCase(), t = today();
      var list = Sap.idx().oas.filter(function (x) {
        if (!Sap.clientOk(x.c) || !pgPass(x.o.pg)) return false;
        if (V.active && x.st === 'expired') return false;
        if (q) {
          var hay = [x.no, x.o.vendor, x.o.vcode, x.cat, x.o.pg, PG_LABEL[x.o.pg] || ''].join(' ').toLowerCase();
          if (q.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0 && !x.o.items.some(function (i) { return (i[1] + ' ' + i[2]).toLowerCase().indexOf(w) >= 0; }); })) return false;
        }
        return true;
      });
      list.sort(function (a, b) {
        if (V.sort === 'end') return (a.o.ve || '9999') < (b.o.ve || '9999') ? -1 : (a.o.ve || '9999') > (b.o.ve || '9999') ? 1 : 0;
        if (V.sort === 'val') return Sap.idr(b.sisa, b.o.cur) - Sap.idr(a.sisa, a.o.cur);
        if (V.sort === 'no') return a.no.localeCompare(b.no);
        var sa = stats(a), sb = stats(b);
        return (sb.sug - sa.sug) || (sb.used - sa.used) || ((b.st !== 'expired') - (a.st !== 'expired')) || PG_MAIN.indexOf(a.o.pg) - PG_MAIN.indexOf(b.o.pg) || a.no.localeCompare(b.no);
      });
      return list;
    }
    function render() {
      $('#pageActions').innerHTML = '<button class="btn" data-act="sap-export" data-what="oa">' + ICON.excel + ' Export Excel</button>';
      var view = $('#view');
      if (!Sap.idx().oas.length) { view.innerHTML = Sap.clientChips() + '<div class="card empty"><h3>Belum ada data ME3N</h3><p>Upload export ME3N di menu Data SAP.</p></div>'; return; }
      var base = Sap.idx().oas.filter(function (x) { return Sap.clientOk(x.c) && (!V.active || x.st !== 'expired'); });
      var cnt = {}; base.forEach(function (x) { cnt[x.o.pg] = (cnt[x.o.pg] || 0) + 1; });
      var other = Object.keys(cnt).filter(function (p) { return PG_MAIN.indexOf(p) < 0; }).sort();
      var opt = function (v, l) { return '<option value="' + esc(v) + '"' + (V.pg === v ? ' selected' : '') + '>' + esc(l) + '</option>'; };
      var pgSel = '<select class="select" id="oapg2">' +
        opt('', 'Zona 1 & Regional 1 (X07 & X02)') + opt('X07', 'Zona 1 — X07 saja (' + (cnt.X07 || 0) + ')') + opt('X02', 'Regional 1 — X02 saja (' + (cnt.X02 || 0) + ')') +
        (other.length ? '<optgroup label="PG lain">' + opt('*other', 'Other: ' + other.join(' & ')) + other.map(function (p) { return opt(p, p + ' (' + cnt[p] + ')'); }).join('') + '</optgroup>' : '') +
        opt('*all', 'Semua Purch. Group') + '</select>';
      view.innerHTML = '<div class="toolbar" style="margin-bottom:12px">' + Sap.clientChips() + '<span class="spacer"></span><div class="src-line small muted">' + srcTxt() + '</div></div>' +
        '<div class="card card-pad toolbar" style="margin-bottom:14px">' +
        '<div class="searchbox" style="flex:1;min-width:240px">' + ICON.search.replace('<svg', '<svg style="left:12px;width:18px;height:18px"') + '<input id="oaq2" class="input" style="height:40px;padding-left:38px;font-size:14px;border-radius:10px;box-shadow:none" placeholder="Cari nomor OA, vendor, atau jenis material…" value="' + esc(V.q) + '"></div>' +
        pgSel + '<select class="select" id="oasort2">' + [['rel', 'Urut: relevan untuk ' + plantLabel(V.home)], ['end', 'Urut: berakhir paling cepat'], ['val', 'Urut: sisa nilai terbesar'], ['no', 'Urut: nomor OA']].map(function (o) { return opt(o[0], o[1]).replace(' selected', '').replace('value="' + V.sort + '"', 'value="' + V.sort + '" selected'); }).join('') + '</select>' +
        '<span class="chip-toggle' + (V.active ? ' on' : '') + '" data-oaact>Hanya kontrak aktif</span></div><div id="oaList2"></div>';
      cards();
    }
    function srcTxt() {
      var src = (S.sap && S.sap.src) || {}, a = [];
      ['me3n-100', 'me3n-180'].forEach(function (k) { if (src[k]) a.push('ME3N ' + k.slice(5) + ': <b>' + ctx.fmtDate(src[k].date) + '</b>'); });
      if (S.stok && S.stok.stockDate) a.push('Stok Warehouse: <b>' + ctx.fmtDate(S.stok.stockDate) + '</b>');
      return a.join(' · ');
    }
    function cards() {
      var list = filtered(), box = $('#oaList2');
      if (!box) return;
      var tot = list.reduce(function (a, x) { return a + Sap.idr(x.sisa, x.o.cur); }, 0), soon = list.filter(function (x) { return x.st === 'warn' || x.st === 'crit'; }).length;
      var html = list.slice(0, V.n).map(function (x) {
        var o = x.o, sx = stats(x), d = x.days, rq = reqsOf(x.c, x.no).filter(function (r) { return !/Diterima|Selesai|Batal/.test(r.state); }).length;
        var badge = x.st === 'expired' ? '<span class="badge bad">Berakhir</span>' : '<span class="badge ' + (x.st === 'crit' ? 'bad' : x.st === 'warn' ? 'warn' : 'ok') + '">Aktif · ' + ctx.nf0.format(d) + ' hari</span>';
        var usedTxt = hasStok() && x.c === '100';
        return '<a class="card oa-card" href="#/oa/' + esc(x.c + '/' + x.no) + '">' +
          '<div class="toolbar"><span class="po">' + esc(x.no) + '</span>' + Sap.clientBadge(x.c) + '<span class="spacer"></span>' + badge + '</div>' +
          '<div class="vendor">' + esc(o.vendor || '—') + '</div>' + (x.cat ? '<div class="cat">' + esc(x.cat) + '</div>' : '') +
          '<div class="meta"><span><b>' + x.nItems + '</b> item</span>' + (usedTxt ? '<span><b>' + sx.used + '</b> pernah dipakai ' + esc(plantLabel(V.home)) + '</span>' : '') +
          (sx.empty ? '<span style="color:var(--warn)"><b>' + sx.empty + '</b> stok ' + esc(plantLabel(V.home)) + ' habis</span>' : '') + '</div>' +
          '<div class="meta"><span>s/d <b>' + ctx.fmtDate(o.ve) + '</b></span><span>PG <b>' + esc(o.pg || '-') + '</b>' + (PG_LABEL[o.pg] ? ' · ' + PG_LABEL[o.pg] : '') + '</span><span>Sisa nilai <b>' + esc(ctx.fmtBig(x.sisa, o.cur)) + '</b></span></div>' +
          (x.pct != null ? '<div class="progress" title="Terserap ' + ctx.pct(x.pct) + '"><i style="width:' + Math.min(100, Math.max(0, x.pct)).toFixed(1) + '%"></i></div>' : '') +
          ((sx.sug || x.ros.length || rq) ? '<div class="oa-foot">' + (sx.sug ? '<span class="badge ro">' + sx.sug + ' item saran RO</span>' : '') + (rq ? '<span class="badge warn">' + rq + ' permintaan RO berjalan</span>' : '') + (x.ros.length ? '<span class="small muted">' + x.ros.length + ' RO di SAP</span>' : '') + '</div>' : '') +
          '</a>';
      }).join('');
      box.innerHTML = list.length
        ? '<div class="result-meta" style="margin-bottom:10px"><b>' + list.length + '</b> kontrak' + (soon ? ' · <b style="color:var(--warn)">' + soon + '</b> segera berakhir' : '') + ' · sisa nilai <b>' + esc(ctx.fmtBig(tot)) + '</b></div><div class="oa-grid">' + html + '</div>' +
          (list.length > V.n ? '<div class="center" style="margin-top:14px"><button class="btn" data-act="oa2-more">Tampilkan lebih banyak (' + (list.length - V.n) + ' lagi)</button></div>' : '')
        : '<div class="card empty"><h3>Tidak ada kontrak yang cocok</h3><p>Ubah kata kunci, matikan "Hanya kontrak aktif", atau pilih Purch. Group lain.</p></div>';
    }

    // ================= Detail OA + pemilih item RO =================
    function selFor(key) { if (sel.key !== key) sel = { key: key, items: {} }; return sel; }
    function saveSel() { ctx.Store.save('roSel', sel); }
    function renderDetail(arg) {
      var p = arg.split('/'), c = p[0], no = p[1], x = Sap.idx().oas.filter(function (y) { return y.c === c && y.no === no; })[0], view = $('#view'), w = ctx.canWrite();
      if (!x) { view.innerHTML = '<div class="card empty"><h3>OA ' + esc(no || '') + ' tidak ada di data ME3N</h3><a class="btn" href="#/oa">' + ICON.back + ' Kembali</a></div>'; return; }
      var o = x.o, n = Sap.noteOf(c, no) || {}, key = c + ':' + no;
      selFor(key);
      $('#pageTitle').textContent = 'OA ' + no;
      $('#pageSub').textContent = o.vendor;
      $('#pageActions').innerHTML = '<a class="btn" href="#/oa">' + ICON.back + ' Daftar OA</a>' + (c === '100' ? '<a class="btn" href="' + esc(ctx.warehouseUrl() + '#/kontrak/' + encodeURIComponent(no)) + '" target="_blank" rel="noopener">' + ICON.link + ' Buka di Warehouse ↗</a>' : '') +
        '<button class="btn" data-act="sap-export" data-what="oa1" data-key="' + esc(arg) + '">' + ICON.excel + ' Export</button>';
      var head = '<div class="card head-card" style="margin-bottom:14px"><div><div class="toolbar" style="gap:8px">' + Sap.clientBadge(c) + '<span class="mono" style="font-weight:800;color:var(--brand);font-size:15px">' + esc(no) + '</span>' + pgTag(o.pg) + Sap.daysBadge(x.days) + '</div>' +
        '<h2>' + esc(o.vendor || '—') + '</h2><div class="muted">' + esc(x.cat || '') + '</div>' +
        '<div class="oa-hd-meta"><span>Berlaku <b>' + ctx.fmtDate(o.vs) + ' – ' + ctx.fmtDate(o.ve) + '</b></span><span>Nilai <b>' + esc(ctx.fmtBig(o.tgt, o.cur)) + '</b></span><span>Released <b>' + esc(ctx.fmtBig(o.rel, o.cur)) + '</b> (' + ctx.pct(x.pct) + ')</span><span>Sisa <b>' + esc(ctx.fmtBig(x.sisa, o.cur)) + '</b></span><span>RO di SAP <b>' + x.ros.length + '</b></span></div>' +
        (x.pct != null ? '<div class="progress" style="margin-top:10px;max-width:520px"><i style="width:' + Math.min(100, Math.max(0, x.pct)).toFixed(1) + '%"></i></div>' : '') + '</div>' +
        '<div class="mk-tindak"><div class="small muted" style="font-weight:700;margin-bottom:4px">Tindak lanjut kontrak</div>' +
        (w ? '<select class="select" data-oatindak="' + esc(key) + '">' + Object.keys(ctx.Model.TINDAK).filter(function (t) { return t !== 'terminasi'; }).map(function (t) { return '<option value="' + t + '"' + ((n.tindak || '') === t ? ' selected' : '') + '>' + ctx.Model.TINDAK[t] + '</option>'; }).join('') + '</select>' +
          '<textarea class="input" data-oanote="' + esc(key) + '" rows="2" placeholder="Catatan…" style="width:100%;margin-top:6px">' + esc(n.catatan || '') + '</textarea>' +
          '<button class="btn sm" data-act="oa-note" data-key="' + esc(key) + '" style="margin-top:6px">Simpan catatan</button>'
          : '<b>' + esc(ctx.Model.TINDAK[n.tindak || '']) + '</b>' + (n.catatan ? '<div class="small" style="margin-top:4px">' + esc(n.catatan) + '</div>' : '')) +
        (n.by ? '<div class="small muted" style="margin-top:6px">' + esc(n.by) + ' · ' + ctx.fmtDateTime(n.at) + '</div>' : '') + '</div></div>';

      var reqs = reqsOf(c, no).sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
      var reqHtml = reqs.length ? '<div class="card card-pad" style="margin-bottom:14px"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">Permintaan RO untuk OA ini</h3><span class="badge">' + reqs.length + '</span><span class="spacer"></span><a class="small" href="#/progres" data-prtab="ro">Buka di Progres →</a></div>' +
        '<div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>Diajukan</th><th>Item</th><th class="num">Nilai</th><th>Status</th><th>No. PR</th><th>No. RO</th></tr></thead><tbody>' + reqs.map(function (r) {
          return '<tr class="clickable" data-roreq="' + esc(r.id) + '"><td class="nowrap small"><b>' + ctx.fmtDate((r.at || '').slice(0, 10)) + '</b><div class="muted">' + esc(r.by || '') + '</div></td><td>' + r.items.length + ' item<div class="small muted ell">' + esc(r.items.map(function (i) { return i.d; }).join(', ')) + '</div></td>' +
            '<td class="num nowrap"><b>' + esc(ctx.fmtBig(r.nilai, r.cur)) + '</b></td><td>' + stBadge(r) + '</td><td class="mono small">' + esc(r.pr || '—') + '</td><td class="mono small">' + esc(r.roNo || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' : '';

      var ros = x.ros.slice().sort(function (a, b) { return (b.p.dd || '').localeCompare(a.p.dd || ''); });
      var roHtml = '<div class="card card-pad" style="margin-top:14px"><h3 class="section-title">RO yang sudah terbit di SAP (ME2N) <span class="badge">' + ros.length + '</span></h3>' +
        (ros.length ? '<div class="table-wrap" style="box-shadow:none;max-height:420px"><table class="grid">' + Sap.poHead() + '<tbody>' + ros.map(Sap.poRow).join('') + '</tbody></table></div>' : '<p class="muted small" style="margin:0">Belum ada RO untuk OA ini di data ME2N.</p>') + '</div>';

      view.innerHTML = head + reqHtml + '<div class="card card-pad" id="roPick"></div>' + roHtml;
      pickTable(x);
    }
    function pickTable(x) {
      var box = $('#roPick'); if (!box) return;
      var c = x.c, o = x.o, w = ctx.canWrite(), s = selFor(c + ':' + x.no), stokOk = c === '100' && hasStok();
      var rows = o.items.filter(function (it) { return it[8] !== 'L'; }).map(function (it) { return { it: it, i: itemInfo(c, it) }; });
      var nSug = rows.filter(function (r) { return r.i && r.i.sg.sug > 0; }).length, nUsed = rows.filter(function (r) { return r.i && r.i.usedHome; }).length, nEmpty = rows.filter(function (r) { return r.i && r.i.empty; }).length;
      if (!stokOk && V.f !== 'all') V.f = 'all';
      var list = rows.filter(function (r) {
        if (V.f === 'sug') return r.i && r.i.sg.sug > 0;
        if (V.f === 'used') return r.i && r.i.usedHome;
        if (V.f === 'empty') return r.i && r.i.empty;
        if (V.f === 'sel') return s.items[r.it[0]] != null;
        return true;
      });
      if (stokOk) list.sort(function (a, b) { return ((b.i && b.i.sg.sug) || 0) - ((a.i && a.i.sg.sug) || 0) || ((b.i && b.i.sg.use12) || 0) - ((a.i && a.i.sg.use12) || 0); });
      var nSel = Object.keys(s.items).length, val = 0;
      Object.keys(s.items).forEach(function (k) { var it = o.items.filter(function (y) { return y[0] === k; })[0]; if (it) val += (+s.items[k] || 0) * it[4]; });
      var chip = function (k, l, n) { return '<span class="chip-toggle' + (V.f === k ? ' on' : '') + '" data-rof="' + k + '">' + l + (n != null ? '<span class="chip-n">' + n + '</span>' : '') + '</span>'; };
      var homeSel = '<label class="fld-pick"><span>Field</span><select class="select" id="roHome">' + ['W101', 'W803', 'W802', 'W102'].map(function (p) { return '<option value="' + p + '"' + (V.home === p ? ' selected' : '') + '>' + plantLabel(p) + ' · ' + p + '</option>'; }).join('') + '</select></label>';
      var body = list.map(function (r) {
        var it = r.it, i = r.i, on = s.items[it[0]] != null, q = on ? s.items[it[0]] : '';
        var stokTd = stokOk ? '<td class="num">' + qty(i.home, true) + '</td><td class="num" title="' + esc(['W101', 'W803', 'W802', 'W102'].map(function (p, j) { return plantLabel(p) + ': ' + fmtQ(i.o.s[j]); }).join(' · ')) + '">' + qty(i.other) + '</td>' +
          '<td class="num nowrap">' + (i.sg.use12 ? '<b>' + fmtQ(Math.round(i.sg.use12 * 100) / 100) + '</b><div class="small muted">' + fmtQ(Math.round(i.sg.rate * 10) / 10) + '/bln</div>' : '<span class="muted">—</span>') + '</td>' +
          '<td class="num">' + (i.sg.sug > 0 ? (w ? '<button class="hint-btn" data-rosug="' + esc(it[0]) + '" title="Klik untuk isi qty">' + fmtQ(i.sg.sug) + '</button>' : '<b>' + fmtQ(i.sg.sug) + '</b>') : i.sg.rate > 0 ? '<span class="small" style="color:var(--ok)" title="Stok cukup ±' + (i.sg.months != null ? Math.round(i.sg.months) : '') + ' bulan">cukup</span>' : '<span class="muted">—</span>') + '</td>' : '';
        return '<tr class="' + (on ? 'in-cart' : '') + '"><td class="c">' + (w ? '<input type="checkbox" data-ropick="' + esc(it[0]) + '"' + (on ? ' checked' : '') + '>' : '') + '</td>' +
          '<td class="mat-cell"><div class="mat-code">' + esc(it[1]) + ' · item ' + esc(it[0]) + '</div><div class="mat-desc">' + esc(it[2]) + '</div></td><td>' + esc(it[3]) + '</td>' +
          '<td class="num nowrap">' + esc(ctx.fmtMoney(it[4], o.cur)) + '</td>' + stokTd +
          '<td class="num">' + (w ? '<input class="input num" type="number" min="0" step="any" data-roqty="' + esc(it[0]) + '" value="' + esc(q) + '" placeholder="0">' : '') + '</td>' +
          '<td class="num nowrap">' + (on && +q ? esc(ctx.fmtBig(+q * it[4], o.cur)) : '') + '</td></tr>';
      }).join('');
      box.innerHTML = '<div class="toolbar" style="margin-bottom:12px"><div><h3 class="section-title" style="margin:0">Pilih item yang perlu di-RO</h3>' +
        (stokOk ? '<div class="small muted" style="margin-top:4px">Saran = pemakaian/bulan × (' + cover() + ' bln cover + ' + lead() + ' bln lead time) − stok ' + esc(plantLabel(V.home)) + ' · stok ' + ctx.fmtDate(S.stok.stockDate) + ', pemakaian s/d ' + ctx.fmtDate(S.stok.useTo) + '</div>'
          : c === '100' ? '<div class="small muted" style="margin-top:4px">Data stok Warehouse belum tersedia — perbarui di menu Data SAP.</div>' : '<div class="small muted" style="margin-top:4px">Stok & pemakaian hanya tersedia untuk plant Zona 1 (client 100).</div>') + '</div>' +
        '<span class="spacer"></span>' + (stokOk ? homeSel : '') + '</div>' +
        '<div class="chips" style="margin-bottom:10px">' + chip('all', 'Semua item', rows.length) + (stokOk ? chip('sug', 'Ada saran RO', nSug) + chip('used', 'Pernah dipakai ' + plantLabel(V.home), nUsed) + chip('empty', 'Stok habis', nEmpty) : '') + (nSel ? chip('sel', 'Dipilih', nSel) : '') + '</div>' +
        '<div class="table-wrap" style="box-shadow:none;max-height:560px"><table class="grid"><thead><tr><th class="c">' + (w ? '<input type="checkbox" data-ropickall title="Pilih semua yang tampil">' : '') + '</th><th>Material</th><th>UoM</th><th class="num">Harga</th>' +
        (stokOk ? '<th class="num">Stok ' + esc(plantLabel(V.home)) + '</th><th class="num">Stok Zona 1 lain</th><th class="num">Pakai 12 bln</th><th class="num">Saran</th>' : '') + '<th class="num">Qty RO</th><th class="num">Nilai</th></tr></thead><tbody>' +
        (body || '<tr><td colspan="10" class="center muted" style="padding:20px">Tidak ada item untuk filter ini</td></tr>') + '</tbody></table></div>' +
        (w ? '<div class="ro-bar' + (nSel ? ' on' : '') + '"><div><b>' + nSel + '</b> item dipilih · <b>' + esc(ctx.fmtMoney(val, o.cur)) + '</b></div><span class="spacer"></span>' +
          (nSel ? '<button class="btn sm" data-act="ro-clear">Kosongkan</button>' : '') + '<button class="btn primary" data-act="ro-submit" data-key="' + esc(x.c + '/' + x.no) + '"' + (nSel ? '' : ' disabled') + '>Ajukan Permintaan RO</button></div>' : '');
    }
    function qty(v, strong) { return v > 0 ? '<span class="qty pos' + (strong ? ' home' : '') + '">' + fmtQ(v) + '</span>' : '<span class="qty zero">0</span>'; }
    function curOA() { var k = sel.key.split(':'); return Sap.idx().oas.filter(function (y) { return y.c === k[0] && y.no === k[1]; })[0]; }

    async function submit(arg) {
      var p = arg.split('/'), x = Sap.idx().oas.filter(function (y) { return y.c === p[0] && y.no === p[1]; })[0]; if (!x) return;
      var s = selFor(x.c + ':' + x.no), items = [];
      Object.keys(s.items).forEach(function (k) {
        var it = x.o.items.filter(function (y) { return y[0] === k; })[0], q = +s.items[k];
        if (it) items.push({ item: it[0], m: it[1], d: it[2], u: it[3], price: it[4], qty: q });
      });
      if (items.some(function (i) { return !(i.qty > 0); })) { ctx.toast('Isi qty untuk semua item yang dipilih', true); return; }
      var nilai = items.reduce(function (a, i) { return a + i.qty * i.price; }, 0);
      var r = await ctx.modal('Ajukan Permintaan RO — OA ' + x.no,
        '<div class="small muted" style="margin-bottom:10px">' + esc(x.o.vendor) + ' · ' + items.length + ' item · <b>' + esc(ctx.fmtMoney(nilai, x.o.cur)) + '</b></div>' +
        '<div class="fleet-form">' + ctx.fld('Untuk field / plant', ctx.sel('plant', ['W101', 'W803', 'W802', 'W102'].map(function (p) { return [p, plantLabel(p) + ' · ' + p]; }).concat([['', 'Lainnya']]), x.c === '100' ? V.home : '')) +
        ctx.fld('Dibutuhkan paling lambat', ctx.inp('need', '', 'type="date"')) + ctx.fld('Keperluan / catatan untuk MIM', '<textarea class="input" name="note" rows="3" placeholder="mis. stok Rantau habis, pemakaian rutin sumur…"></textarea>', 'wide') + '</div>', 'Ajukan');
      if (!r) return;
      var id = 'RQ' + Date.now().toString(36), now = new Date().toISOString();
      var rec = { id: id, c: x.c, oa: x.no, vendor: x.o.vendor, pg: x.o.pg, cur: x.o.cur, plant: r.plant, need: r.need, note: r.note.trim(), items: items, nilai: nilai, pr: '', ro: '', pic: '', status: '', by: ctx.me(), at: now, log: [{ at: now, by: ctx.me(), msg: 'Permintaan RO diajukan (' + items.length + ' item)' }] };
      var ok = await ctx.save(function (D) { D.roReq = (D.roReq || []).filter(function (y) { return y.id !== id; }).concat([rec]); }, 'Permintaan RO OA ' + x.no + ' (' + items.length + ' item)');
      if (ok) { sel = { key: '', items: {} }; saveSel(); ctx.toast('Permintaan RO diajukan — MIM bisa memproses PR di Progres PR & PO'); ctx.render(); }
    }

    // ================= Permintaan RO (tab di Progres PR & PO) =================
    function roList() {
      var I = Sap.idx(), byPr = {};
      I.pos.forEach(function (x) { x.pr.forEach(function (p) { (byPr[x.c + ':' + p] = byPr[x.c + ':' + p] || []).push(x); }); });
      return ((S.D && S.D.roReq) || []).map(function (r) {
        var doc = r.ro ? I.poByNo[r.ro] : null, auto = false;
        if (!doc && r.pr) { var hit = (byPr[r.c + ':' + r.pr] || []).filter(function (x) { return x.oa.indexOf(r.oa) >= 0; })[0] || (byPr[r.c + ':' + r.pr] || [])[0]; if (hit) { doc = hit; auto = true; } }
        var state = r.status === 'Batal' ? 'Batal' : r.status === 'Selesai' ? 'Selesai' : doc && doc.out <= 0.5 ? 'Diterima' : doc || r.ro ? 'RO terbit' : r.pr ? 'PR dibuat' : 'Menunggu PR';
        return Object.assign({}, r, { doc: doc, auto: auto, roNo: r.ro || (doc ? doc.no : ''), state: state, late: !!(doc && doc.late) });
      });
    }
    function stBadge(r) { return '<span class="badge ' + RO_ST[r.state] + '">' + esc(r.state) + '</span>' + (r.late ? ' <span class="badge bad">terlambat</span>' : ''); }
    function waiting() { return roList().filter(function (r) { return r.state === 'Menunggu PR'; }).length; }
    function renderTab(box) {
      var all = roList().filter(function (r) { return Sap.clientOk(r.c); }), w = ctx.canWrite(), q = V.rq.trim().toLowerCase();
      var cnt = {}; all.forEach(function (r) { cnt[r.state] = (cnt[r.state] || 0) + 1; });
      var order = ['Menunggu PR', 'PR dibuat', 'RO terbit', 'Diterima', 'Selesai', 'Batal'];
      var list = all.filter(function (r) { return (!V.rst || r.state === V.rst) && (!q || [r.oa, r.vendor, r.pr, r.roNo, r.by, r.pic, r.note, r.items.map(function (i) { return i.m + ' ' + i.d; }).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0); });
      list.sort(function (a, b) { return order.indexOf(a.state) - order.indexOf(b.state) || (b.at || '').localeCompare(a.at || ''); });
      var sum = function (l) { return ctx.fmtBig(l.reduce(function (a, r) { return a + Sap.idr(r.nilai, r.cur); }, 0)); };
      var k = function (stt, l, cls) { var L = all.filter(function (r) { return r.state === stt; }); return '<div class="kpi kpi-click' + (cls && L.length ? ' kpi-' + cls : '') + '" data-rost="' + stt + '"><div class="k">' + l + '</div><div class="v">' + L.length + '</div><div class="s">' + esc(sum(L)) + '</div></div>'; };
      var rows = list.map(function (r, n) {
        var sap = r.doc ? (r.doc.out <= 0.5 ? '<span class="badge ok">Diterima penuh</span>' : ctx.pct(r.doc.recv) + ' diterima' + (r.doc.days != null ? '<div class="small ' + (r.doc.days < 0 ? '" style="color:var(--bad)">lewat ' + (-r.doc.days) + ' hr' : 'muted">delivery ' + ctx.fmtDate(r.doc.due)) + '</div>' : '')) : '<span class="muted">—</span>';
        return '<tr class="clickable" data-roreq="' + esc(r.id) + '"><td class="small muted">' + (n + 1) + '</td><td class="nowrap small"><b>' + ctx.fmtDate((r.at || '').slice(0, 10)) + '</b><div class="muted">' + esc(r.by || '') + '</div></td>' +
          '<td class="nowrap">' + Sap.clientBadge(r.c) + ' <a class="mono" href="#/oa/' + esc(r.c + '/' + r.oa) + '">' + esc(r.oa) + '</a><div class="small muted">' + esc(r.vendor || '') + '</div></td>' +
          '<td style="min-width:170px"><b>' + r.items.length + ' item</b><div class="small muted ell" style="max-width:260px">' + esc(r.items.map(function (i) { return i.d; }).join(', ')) + '</div></td>' +
          '<td class="small nowrap">' + esc(r.plant ? plantLabel(r.plant) : '—') + (r.need ? '<div class="muted">perlu ' + ctx.fmtDate(r.need) + '</div>' : '') + '</td>' +
          '<td class="num nowrap"><b>' + esc(ctx.fmtBig(r.nilai, r.cur)) + '</b></td><td>' + stBadge(r) + '</td>' +
          '<td class="mono small">' + esc(r.pr || '—') + '</td><td class="mono small">' + (r.roNo ? esc(r.roNo) + (r.auto ? '<div class="small muted" style="font-family:inherit">otomatis dari SAP</div>' : '') : '—') + '</td><td class="small">' + sap + '</td>' +
          (w ? '<td class="c pick-col"><button class="btn sm" data-act="ro-upd" data-id="' + esc(r.id) + '">' + ICON.edit + ' Update</button></td>' : '') + '</tr>';
      }).join('');
      box.innerHTML = '<div class="kpis" style="margin:14px 0">' + k('Menunggu PR', 'Menunggu PR', 'warn') + k('PR dibuat', 'PR dibuat · menunggu RO') + k('RO terbit', 'RO terbit · dikirim') + k('Diterima', 'Diterima', 'ok') + '</div>' +
        '<div class="card card-pad" style="margin-bottom:14px;display:flex;flex-direction:column;gap:12px"><div class="toolbar"><div class="searchbox" style="flex:1;min-width:240px">' + ICON.search.replace('<svg', '<svg style="left:12px;width:18px;height:18px"') +
        '<input id="rqq" class="input" style="height:40px;padding-left:38px;font-size:14px;border-radius:10px;box-shadow:none" placeholder="Cari OA, vendor, material, no. PR / RO…" value="' + esc(V.rq) + '"></div><a class="btn" href="#/oa">' + ICON.plus + ' Buat dari Kontrak OA</a></div>' +
        '<div class="chips"><span class="chip-toggle' + (!V.rst ? ' on' : '') + '" data-rost="">Semua<span class="chip-n">' + all.length + '</span></span>' + order.filter(function (s) { return cnt[s]; }).map(function (s) { return '<span class="chip-toggle' + (V.rst === s ? ' on' : '') + '" data-rost="' + s + '">' + s + '<span class="chip-n">' + cnt[s] + '</span></span>'; }).join('') + '</div></div>' +
        (list.length ? '<div class="table-wrap tall"><table class="grid"><thead><tr><th>No.</th><th>Diajukan</th><th>OA</th><th>Item</th><th>Field</th><th class="num">Nilai</th><th>Status</th><th>No. PR</th><th>No. RO</th><th>SAP (ME2N)</th>' + (w ? '<th class="pick-col"></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="card empty"><h3>' + (all.length ? 'Tidak ada yang cocok' : 'Belum ada permintaan RO') + '</h3><p>Buka <a href="#/oa">Kontrak OA</a>, pilih kontrak, centang item yang perlu di-RO lalu klik <b>Ajukan Permintaan RO</b>.</p></div>');
    }
    function openReq(id) {
      var r = roList().filter(function (y) { return y.id === id; })[0]; if (!r) return;
      var d = $('#drawer'), w = ctx.canWrite();
      d.innerHTML = '<div class="drawer-head"><div style="flex:1;min-width:0"><div class="toolbar" style="gap:6px">' + Sap.clientBadge(r.c) + '<span class="badge">Permintaan RO</span>' + stBadge(r) + '</div>' +
        '<h2>OA ' + esc(r.oa) + '</h2><div class="small muted">' + esc(r.vendor || '') + '</div></div><button class="icon-btn" data-act="drawer-close">' + ICON.close + '</button></div>' +
        '<div class="drawer-body"><div class="kv"><div><span>Diajukan</span>' + esc(r.by || '') + ' · ' + ctx.fmtDateTime(r.at) + '</div><div><span>Untuk field</span>' + esc(r.plant ? plantLabel(r.plant) + ' · ' + r.plant : '—') + '</div>' +
        '<div><span>Dibutuhkan</span>' + (r.need ? ctx.fmtDate(r.need) : '—') + '</div><div><span>Nilai</span><b>' + esc(ctx.fmtMoney(r.nilai, r.cur)) + '</b></div>' +
        '<div><span>No. PR</span><span class="mono">' + esc(r.pr || '—') + '</span></div><div><span>No. RO</span>' + (r.roNo ? '<a class="mono" style="cursor:pointer" data-pokey="' + esc(r.doc ? r.doc.c + '/' + r.doc.no : '') + '">' + esc(r.roNo) + '</a>' + (r.auto ? ' <span class="small muted">otomatis dari SAP</span>' : '') : '—') + '</div>' +
        '<div><span>PIC MIM</span>' + esc(r.pic || '—') + '</div><div><span>Status SAP</span>' + (r.doc ? ctx.pct(r.doc.recv) + ' diterima' + (r.doc.late ? ' · <b style="color:var(--bad)">terlambat</b>' : '') : '—') + '</div></div>' +
        (r.note ? '<div class="mk-note">' + esc(r.note).replace(/\n/g, '<br>') + '</div>' : '') +
        (w ? '<div><button class="btn primary" data-act="ro-upd" data-id="' + esc(r.id) + '">' + ICON.edit + ' Update PR / RO</button></div>' : '') +
        '<div><h3 class="section-title">Item <span class="badge">' + r.items.length + '</span></h3><div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>Material</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Nilai</th></tr></thead><tbody>' +
        r.items.map(function (i) { return '<tr><td><div class="mat-code">' + esc(i.m) + ' · item ' + esc(i.item) + '</div><div style="font-weight:600">' + esc(i.d) + '</div></td><td class="num nowrap">' + fmtQ(i.qty) + ' ' + esc(i.u) + '</td><td class="num nowrap">' + esc(ctx.fmtMoney(i.price, r.cur)) + '</td><td class="num nowrap"><b>' + esc(ctx.fmtMoney(i.qty * i.price, r.cur)) + '</b></td></tr>'; }).join('') + '</tbody></table></div></div>' +
        '<div><h3 class="section-title">Riwayat</h3><div class="mk-log">' + (r.log || []).map(function (l) { return '<div class="mk-log-row"><span>' + esc(l.msg) + '</span><span class="small muted nowrap">' + esc(l.by) + ' · ' + ctx.fmtDateTime(l.at) + '</span></div>'; }).join('') + '</div></div></div>';
      d.classList.add('open'); $('#scrim').classList.add('open'); d.setAttribute('aria-hidden', 'false');
    }
    async function update(id) {
      var r = roList().filter(function (y) { return y.id === id; })[0]; if (!r) return;
      var m = await ctx.modal('Update Permintaan RO — OA ' + r.oa,
        '<div class="small muted" style="margin-bottom:10px">' + r.items.length + ' item · ' + esc(ctx.fmtMoney(r.nilai, r.cur)) + ' · diajukan ' + esc(r.by || '') + '</div>' +
        '<div class="fleet-form">' + ctx.fld('No. PR', ctx.inp('pr', r.pr, 'placeholder="mis. 1450034567"')) + ctx.fld('No. RO', ctx.inp('ro', r.ro, 'placeholder="kosongkan — otomatis dari ME2N bila PR cocok"')) +
        ctx.fld('PIC MIM', ctx.inp('pic', r.pic || ctx.me())) + ctx.fld('Status', ctx.sel('status', [['', 'Otomatis (dari PR / RO / SAP)'], 'Selesai', 'Batal'], r.status || '')) +
        ctx.fld('Catatan', '<textarea class="input" name="note2" rows="2" placeholder="mis. PR sudah di-approve, menunggu RO"></textarea>', 'wide') + '</div>', 'Simpan');
      if (!m) return;
      var now = new Date().toISOString(), ch = [];
      if ((m.pr || '').trim() !== (r.pr || '')) ch.push('PR ' + (m.pr.trim() || '-'));
      if ((m.ro || '').trim() !== (r.ro || '')) ch.push('RO ' + (m.ro.trim() || '-'));
      if (m.status !== (r.status || '')) ch.push('status ' + (m.status || 'otomatis'));
      if ((m.pic || '').trim() !== (r.pic || '')) ch.push('PIC ' + m.pic.trim());
      var msg = (ch.join(', ') || 'Catatan') + (m.note2.trim() ? ' — ' + m.note2.trim() : '');
      var ok = await ctx.save(function (D) {
        var x = (D.roReq || []).filter(function (y) { return y.id === id; })[0];
        if (!x) throw new Error('Permintaan sudah dihapus');
        x.pr = m.pr.trim(); x.ro = m.ro.trim(); x.pic = m.pic.trim(); x.status = m.status; x.ed = { by: ctx.me(), at: now };
        x.log = [{ at: now, by: ctx.me(), msg: msg }].concat(x.log || []).slice(0, 40);
      }, 'Permintaan RO OA ' + r.oa + ': ' + msg);
      if (ok) { ctx.toast('Permintaan RO diperbarui'); ctx.closeDrawer(); ctx.render(); }
    }

    // ================= Stok & pemakaian dari Warehouse =================
    async function load() {
      var repo = null, cached = await ctx.Store.get('stok');
      try { window.MK_STOK = null; await ctx.loadScript('data/stok.js?t=' + Date.now()); if (window.MK_STOK) repo = await ctx.Vault.decrypt(S.key, window.MK_STOK); } catch (e) { /* belum ada */ }
      if (!repo && ctx.GH.hasToken()) { try { var p = ctx.Vault.payloadOf(await ctx.GH.readText('data/stok.js')); if (p) repo = await ctx.Vault.decrypt(S.key, p); } catch (e) { /* abaikan */ } }
      var D = repo;
      if (cached && cached.src && (!D || (cached.src.at || '') > ((D.src || {}).at || ''))) D = cached;
      S.stok = D || null; memo = null;
      if (D) await ctx.Store.set('stok', D);
      window.MK_STOK = null;
    }
    function stokCard() {
      var s = S.stok;
      return '<div class="card card-pad" style="margin-bottom:16px"><div class="toolbar"><div style="flex:1;min-width:240px"><h3 style="margin:0 0 4px">Stok &amp; pemakaian Zona 1 (dari Material Warehouse)</h3>' +
        '<div class="small muted">' + (s ? 'Stok ' + ctx.fmtDate(s.stockDate) + ' · pemakaian ' + ctx.fmtDate(s.useFrom + '-01') + ' – ' + ctx.fmtDate(s.useTo) + ' · ' + ctx.nf0.format(Object.keys(s.m).length) + ' material OA · diperbarui ' + esc((s.src || {}).by || '') + ' ' + ctx.fmtDateTime((s.src || {}).at) : 'Belum ada — dipakai untuk saran qty RO di detail Kontrak OA.') + '</div></div>' +
        (ctx.canWrite() ? '<button class="btn" data-act="stok-refresh">' + ICON.upload + ' Perbarui dari Warehouse</button>' : '') + '</div></div>';
    }
    async function refresh() {
      var wh = ctx.warehouseUrl();
      if (!(await ctx.ensureToken())) { ctx.toast('Akses simpan belum aktif', true); return; }
      ctx.loading('Membaca data Warehouse…');
      try {
        window.MW_MANIFEST = null;
        await ctx.loadScript(wh + 'data/manifest.js?t=' + Date.now());
        var man = window.MW_MANIFEST;
        if (!man) throw new Error('Data Warehouse tidak terbaca');
        var act = function (t) { var l = man.versions[t] || [], id = man.active && man.active[t]; return l.filter(function (v) { return v.id === id; })[0] || l[0]; };
        var vs = act('stock'), vm = act('mb51');
        if (!vs || !vm) throw new Error('Data stok / MB51 belum ada di Warehouse');
        window.MW_SNAP = window.MW_SNAP || {};
        await ctx.loadScript(wh + 'data/' + vs.id + '.js?v=' + vs.id);
        await ctx.loadScript(wh + 'data/' + vm.id + '.js?v=' + vm.id);
        var ps = window.MW_SNAP[vs.id], pm = window.MW_SNAP[vm.id];
        delete window.MW_SNAP[vs.id]; delete window.MW_SNAP[vm.id];
        ctx.loading(false);
        var key = await ctx.whKey(ps);
        if (!key) return;
        ctx.loading('Menghitung stok & pemakaian…');
        var stock = await ctx.Vault.decrypt(key, ps), mb = await ctx.Vault.decrypt(key, pm);
        var mats = {}; ['100', '180'].forEach(function (c) { ((S.sap && S.sap.oa && S.sap.oa[c]) || []).forEach(function (o) { o.items.forEach(function (i) { mats[i[1]] = 1; }); }); });
        var out = root.Stok.build(stock, mb, Object.keys(mats));
        out.src = { stock: vs.id, mb51: vm.id, at: new Date().toISOString(), by: ctx.me() };
        var next = await ctx.GH.atomic({ path: 'data/stok.js', varName: 'MK_STOK', note: 'Ringkasan stok & pemakaian Zona 1 dari Material Warehouse (material OA)', key: S.key, message: 'Perbarui stok & pemakaian dari Warehouse (' + ctx.me() + ')', mutate: function () { return out; } });
        S.stok = next; memo = null; await ctx.Store.set('stok', next);
        ctx.toast('Stok & pemakaian diperbarui (' + Object.keys(out.m).length + ' material)');
        ctx.render();
      } catch (e) { ctx.toast('Gagal: ' + e.message, true); }
      finally { ctx.loading(false); }
    }
    function exportRows() {
      return roList().map(function (r) { return { Client: r.c, 'No. OA': r.oa, Vendor: r.vendor, 'Diajukan': (r.at || '').slice(0, 10), 'Oleh': r.by, Field: r.plant, 'Dibutuhkan': r.need || '', 'Jumlah Item': r.items.length, Item: r.items.map(function (i) { return i.m + ' ' + i.d + ' × ' + i.qty + ' ' + i.u; }).join('; '), Nilai: r.nilai, Status: r.state, 'No. PR': r.pr || '', 'No. RO': r.roNo || '', 'PIC MIM': r.pic || '', Catatan: r.note || '' }; });
    }

    // ================= Event =================
    document.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-oaact]'))) { V.active = !V.active; V.n = PAGE; render(); return; }
      if ((b = t.closest('[data-rof]'))) { V.f = b.getAttribute('data-rof'); var x = curOA(); if (x) pickTable(x); return; }
      if ((b = t.closest('[data-rost]'))) { V.rst = b.getAttribute('data-rost'); var bx = $('#prBox'); if (bx) renderTab(bx); return; }
      if ((b = t.closest('[data-rosug]'))) { var x2 = curOA(), k = b.getAttribute('data-rosug'), it = x2 && x2.o.items.filter(function (y) { return y[0] === k; })[0], inf = it && itemInfo(x2.c, it); if (inf) { selFor(x2.c + ':' + x2.no).items[k] = inf.sg.sug; saveSel(); pickTable(x2); } return; }
      b = t.closest('[data-act]');
      if (b) {
        var a = b.getAttribute('data-act');
        if (a === 'oa2-more') { V.n += PAGE; cards(); }
        else if (a === 'ro-submit') submit(b.getAttribute('data-key'));
        else if (a === 'ro-clear') { sel.items = {}; saveSel(); var x3 = curOA(); if (x3) pickTable(x3); }
        else if (a === 'ro-upd') { e.stopPropagation(); update(b.getAttribute('data-id')); }
        else if (a === 'stok-refresh') refresh();
        if (/^(oa2-more|ro-submit|ro-clear|ro-upd|stok-refresh)$/.test(a)) return;
      }
      if (t.closest('a,button,input,select,textarea')) return;
      var tr = t.closest('tr[data-roreq]');
      if (tr) openReq(tr.getAttribute('data-roreq'));
    }, true);
    var tm;
    document.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'oaq2') { V.q = t.value; V.n = PAGE; clearTimeout(tm); tm = setTimeout(cards, 200); }
      else if (t.id === 'rqq') { V.rq = t.value; clearTimeout(tm); tm = setTimeout(function () { var bx = $('#prBox'); if (bx) { renderTab(bx); var i = $('#rqq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }
      else if (t.hasAttribute('data-roqty')) {
        var k = t.getAttribute('data-roqty'), v = t.value;
        if (v === '' || +v <= 0) delete sel.items[k]; else sel.items[k] = +v;
        saveSel();
        var x = curOA(); if (!x) return;
        var row = t.closest('tr'), cb = row.querySelector('[data-ropick]'); if (cb) cb.checked = sel.items[k] != null;
        row.classList.toggle('in-cart', sel.items[k] != null);
        var it = x.o.items.filter(function (y) { return y[0] === k; })[0];
        row.lastElementChild.innerHTML = sel.items[k] && it ? esc(ctx.fmtBig(sel.items[k] * it[4], x.o.cur)) : '';
        clearTimeout(tm); tm = setTimeout(function () { var bar = $('.ro-bar'), keep = document.activeElement && document.activeElement.getAttribute('data-roqty'); if (!bar) return; pickTable(x); if (keep) { var el = document.querySelector('[data-roqty="' + keep + '"]'); if (el) { el.focus(); var L = el.value.length; try { el.setSelectionRange(L, L); } catch (er) { /* type number */ } } } }, 700);
      }
    });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'oapg2') { V.pg = t.value; V.n = PAGE; render(); }
      else if (t.id === 'oasort2') { V.sort = t.value; cards(); }
      else if (t.id === 'roHome') { V.home = t.value; ctx.Store.save('roHome', V.home); memo = null; var x = curOA(); if (x) pickTable(x); }
      else if (t.hasAttribute('data-ropick')) {
        var x2 = curOA(); if (!x2) return;
        var k = t.getAttribute('data-ropick'), s = selFor(x2.c + ':' + x2.no);
        if (t.checked) { var it = x2.o.items.filter(function (y) { return y[0] === k; })[0], inf = it && itemInfo(x2.c, it); s.items[k] = inf && inf.sg.sug > 0 ? inf.sg.sug : 1; }
        else delete s.items[k];
        saveSel(); pickTable(x2);
      } else if (t.hasAttribute('data-ropickall')) {
        var x3 = curOA(); if (!x3) return;
        var s3 = selFor(x3.c + ':' + x3.no);
        Array.prototype.forEach.call(document.querySelectorAll('[data-ropick]'), function (cb) {
          var k3 = cb.getAttribute('data-ropick');
          if (t.checked) { if (s3.items[k3] == null) { var it3 = x3.o.items.filter(function (y) { return y[0] === k3; })[0], i3 = it3 && itemInfo(x3.c, it3); s3.items[k3] = i3 && i3.sg.sug > 0 ? i3.sg.sug : 1; } }
          else delete s3.items[k3];
        });
        saveSel(); pickTable(x3);
      }
    });

    return { render: render, renderDetail: renderDetail, renderTab: renderTab, openReq: openReq, roList: roList, waiting: waiting, load: load, stokCard: stokCard, exportRows: exportRows, PG_LABEL: PG_LABEL };
  }
  root.OaMod = OaMod;
})(this);

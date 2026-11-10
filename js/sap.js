/*
 * Monitoring SAP: Kontrak OA (ME3N), PO / RO (ME2N), Progres PR & PO (Pengadaan + Expediting).
 * Client 100 (Pertamina EP) & Client 180. Data terenkripsi di data/sap.js.
 */
(function (root) {
  'use strict';

  var LIBUR = ['2026-01-01', '2026-01-16', '2026-02-17', '2026-03-19', '2026-03-21', '2026-03-22', '2026-04-03', '2026-04-05', '2026-05-01', '2026-05-14', '2026-05-27', '2026-05-31',
    '2026-06-01', '2026-06-16', '2026-08-17', '2026-08-25', '2026-12-25', '2027-01-01', '2027-01-05', '2027-02-06', '2027-03-08', '2027-03-10', '2027-03-11', '2027-03-26', '2027-03-28',
    '2027-05-01', '2027-05-06', '2027-05-17', '2027-05-20', '2027-06-01', '2027-06-06', '2027-08-15', '2027-08-17', '2027-12-25', '2027-12-26'];
  var PLANTS = {
    W101: 'Rantau', W102: 'Pangkalan Susu', W802: 'Jambi', W803: 'Lirik', W105: 'Prabumulih', W106: 'Pendopo', W801: 'Limau', W809: 'Adera', W811: 'Ramba',
    JM02: 'Jambi Merang', JM03: 'Jambi Merang', OG02: 'Ogan Komering', RT02: 'Raja Tempirai'
  };
  var PAGE = 150;

  function SapMod(ctx) {
    var S = ctx.S, esc = ctx.esc, ICON = ctx.ICON, $ = function (s) { return document.querySelector(s); };
    var V = { client: ctx.Store.load('client', ''), oa: { q: '', st: 'active', pg: '', sort: 'end', n: PAGE }, po: { q: '', st: 'out', type: '', plant: '', sort: 'due', n: PAGE }, pr: { tab: 'pengadaan', q: '', st: '' } };
    var cache = null;

    // ---------- util ----------
    function today() { return ctx.Model.todayStr(); }
    function st() { return ctx.settings(); }
    function kurs() { return +st().kurs || 16000; }
    function idr(v, cur) { v = +v || 0; return !cur || cur === 'IDR' ? v : v * kurs(); }
    function clientName(c) { var n = (st().clients || {})[c]; return n || (c === '100' ? 'Pertamina EP' : c === '180' ? 'PHE' : c); }
    function clientBadge(c) { return '<span class="cl-tag cl-' + esc(c) + '" title="Client ' + esc(c) + ' · ' + esc(clientName(c)) + '">' + esc(c) + '</span>'; }
    function plantName(p) { return PLANTS[p] ? PLANTS[p] : ''; }
    function money(v, cur) { return ctx.fmtBig(v, cur); }
    function moneyIdr(v) { return ctx.fmtBig(v, 'IDR'); }
    function bar(p, cls) { return ctx.bar(p, cls); }
    function daysBadge(days, closed) {
      if (closed) return '<span class="badge ok">Selesai</span>';
      if (days == null) return '<span class="muted">—</span>';
      var s = st();
      if (days < 0) return '<span class="badge bad">Lewat ' + ctx.nf0.format(-days) + ' hari</span>';
      return '<span class="badge ' + (days <= s.crit ? 'bad' : days <= s.warn ? 'warn' : 'ok') + '">' + ctx.nf0.format(days) + ' hari lagi</span>';
    }
    function has() { return !!(S.sap && ((S.sap.oa && (S.sap.oa['100'] || S.sap.oa['180'])) || (S.sap.po && (S.sap.po['100'] || S.sap.po['180'])) || S.sap.pr)); }
    function clientOk(c) { return !V.client || V.client === c; }
    function wkClients(wk) { var w = String(wk || '').toUpperCase(), r = []; if (/PEP/.test(w)) r.push('100'); if (/PHE/.test(w)) r.push('180'); return r; }
    function wkOk(wk) { if (!V.client) return true; var c = wkClients(wk); return !c.length || c.indexOf(V.client) >= 0; }
    function noteOf(c, no) { return ((S.D && S.D.oaNotes) || {})[c + ':' + no] || null; }

    // Hari kerja (inklusif) seperti NETWORKDAYS Excel, tanpa Sabtu-Minggu & libur nasional
    function workdays(a, b) {
      if (!a || !b || b < a) return null;
      var lib = {}; ((S.sap && S.sap.pr && S.sap.pr.libur && S.sap.pr.libur.length ? S.sap.pr.libur : LIBUR)).forEach(function (d) { lib[d] = 1; });
      var d = new Date(a + 'T00:00:00Z'), end = new Date(b + 'T00:00:00Z'), n = 0;
      while (d <= end) { var w = d.getUTCDay(), s = d.toISOString().slice(0, 10); if (w !== 0 && w !== 6 && !lib[s]) n++; d.setUTCDate(d.getUTCDate() + 1); }
      return n;
    }

    // ---------- indeks (dihitung sekali per versi data) ----------
    function idx() {
      var key = (S.sap && S.sap.updatedAt) + '|' + today() + '|' + st().warn + '|' + st().crit + '|' + kurs();
      if (cache && cache.key === key) return cache;
      var t = today(), s = st(), oas = [], pos = [], poByNo = {}, roByOa = {};
      ['100', '180'].forEach(function (c) {
        ((S.sap && S.sap.po && S.sap.po[c]) || []).forEach(function (p) {
          var val = 0, out = 0, inv = 0, due = '', last = '', plants = {}, oa = {}, pr = {};
          p.items.forEach(function (i) {
            val += i[5]; out += i[7]; inv += i[8];
            if (i[9]) plants[i[9]] = 1; if (i[11]) oa[i[11]] = 1; if (i[12]) pr[i[12]] = 1;
            if (i[10]) { if (i[7] > 0 && (!due || i[10] < due)) due = i[10]; if (!last || i[10] > last) last = i[10]; }
          });
          var oaList = Object.keys(oa), type = oaList.length || /^43/.test(p.no) ? 'RO' : 'PO';
          var stt = out <= 0.5 ? (inv > 0.5 ? 'inv' : 'done') : (due && due < t ? 'late' : out < val - 0.5 ? 'partial' : 'open');
          var x = { c: c, p: p, no: p.no, type: type, val: val, out: out, inv: inv, due: due || last, late: stt === 'late', st: stt, plants: Object.keys(plants), oa: oaList, pr: Object.keys(pr),
            recv: val > 0 ? (val - out) / val * 100 : null, days: (due || last) ? ctx.Model.dayDiff(t, due || last) : null };
          pos.push(x); poByNo[p.no] = x;
          oaList.forEach(function (o) { (roByOa[c + ':' + o] = roByOa[c + ':' + o] || []).push(x); });
        });
        ((S.sap && S.sap.oa && S.sap.oa[c]) || []).forEach(function (o) {
          var days = o.ve ? ctx.Model.dayDiff(t, o.ve) : null, ros = roByOa[c + ':' + o.no] || [];
          var stt = days == null ? 'active' : days < 0 ? 'expired' : days <= s.crit ? 'crit' : days <= s.warn ? 'warn' : 'active';
          var live = o.items.filter(function (i) { return i[8] !== 'L'; });
          var dur = o.vs && o.ve ? ctx.Model.dayDiff(o.vs, o.ve) : null;
          oas.push({ c: c, o: o, no: o.no, days: days, st: stt, pct: o.tgt > 0 ? o.rel / o.tgt * 100 : null, sisa: o.tgt - o.rel, ros: ros,
            roVal: ros.reduce(function (a, r) { return a + r.val; }, 0), roOut: ros.reduce(function (a, r) { return a + r.out; }, 0),
            nItems: live.length, blocked: o.items.filter(function (i) { return i[8] === 'S'; }).length,
            timePct: dur > 0 ? Math.max(0, Math.min(100, ctx.Model.dayDiff(o.vs, t) / dur * 100)) : null,
            cat: ctx.Model.category(live.map(function (i) { return { d: i[2] }; })) });
        });
      });
      cache = { key: key, oas: oas, pos: pos, poByNo: poByNo };
      return cache;
    }
    function reset() { cache = null; }

    // ---------- komponen ----------
    function clientChips(extra) {
      var opts = [['', 'Semua client'], ['100', '100 · ' + clientName('100')], ['180', '180 · ' + clientName('180')]];
      return '<div class="cl-switch">' + opts.map(function (o) { return '<button class="cl-opt' + (V.client === o[0] ? ' on' : '') + '" data-client="' + o[0] + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>' + (extra || '');
    }
    function srcLine(keys) {
      var src = (S.sap && S.sap.src) || {};
      var parts = keys.map(function (k) { var x = src[k]; return x ? '<span>' + esc(k.toUpperCase().replace('-', ' · ')) + ': <b>' + ctx.fmtDate(x.date) + '</b></span>' : ''; }).filter(Boolean);
      return parts.length ? '<div class="src-line small muted">Data SAP: ' + parts.join(' · ') + '</div>' : '';
    }
    function noData(what) {
      return '<div class="card empty"><div class="ico">' + ICON.upload + '</div><h3>Belum ada data ' + esc(what) + '</h3><p>' +
        (ctx.canWrite() ? 'Upload file export SAP (ME3N / ME2N) atau file Progres PR/RO di halaman Upload Data.' : 'Owner / Writer belum meng-upload data.') + '</p>' +
        (ctx.canWrite() ? '<a class="btn primary" href="#/import">' + ICON.upload + ' Upload Data</a>' : '') + '</div>';
    }
    function kpi(label, v, s, cls, attrs) { return '<div class="kpi' + (cls ? ' kpi-' + cls : '') + (attrs ? ' kpi-click' : '') + '"' + (attrs || '') + '><div class="k">' + label + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }
    function sumIdr(list, f, cf) { return list.reduce(function (a, x) { return a + idr(f(x), cf(x)); }, 0); }
    function more(list, n, act) { return list.length > n ? '<div class="center" style="margin-top:12px"><button class="btn" data-act="' + act + '">Tampilkan lebih banyak (' + Math.min(PAGE, list.length - n) + ' dari ' + (list.length - n) + ' sisa)</button></div>' : ''; }
    function searchBox(id, val, ph) {
      return '<div class="searchbox" style="flex:1;min-width:240px">' + ICON.search.replace('<svg', '<svg style="left:12px;width:18px;height:18px"') +
        '<input id="' + id + '" class="input" style="height:40px;padding-left:38px;font-size:14px;border-radius:10px;box-shadow:none" placeholder="' + esc(ph) + '" value="' + esc(val) + '"></div>';
    }

    // ================= Kontrak OA (ME3N) =================
    var OA_ST = [['active', 'Masih berlaku'], ['warn', 'Segera berakhir'], ['crit', 'Kritis'], ['expired', 'Berakhir'], ['all', 'Semua']];
    function oaPass(x, s) { return s === 'all' ? true : s === 'active' ? x.st !== 'expired' : x.st === s; }
    function oaFiltered() {
      var F = V.oa, q = F.q.trim().toLowerCase(), I = idx();
      var list = I.oas.filter(function (x) {
        if (!clientOk(x.c) || !oaPass(x, F.st) || (F.pg && x.o.pg !== F.pg)) return false;
        if (q) {
          var hay = [x.no, x.o.vendor, x.o.vcode, x.cat, x.o.pg, x.o.dt].join(' ').toLowerCase();
          if (q.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0 && !x.o.items.some(function (i) { return (i[1] + ' ' + i[2]).toLowerCase().indexOf(w) >= 0; }); })) return false;
        }
        return true;
      });
      list.sort(function (a, b) {
        if (F.sort === 'val') return idr(b.o.tgt, b.o.cur) - idr(a.o.tgt, a.o.cur);
        if (F.sort === 'pct') return (b.pct || 0) - (a.pct || 0);
        if (F.sort === 'ro') return b.ros.length - a.ros.length;
        if (F.sort === 'no') return a.no.localeCompare(b.no);
        return (a.o.ve || '9999') < (b.o.ve || '9999') ? -1 : (a.o.ve || '9999') > (b.o.ve || '9999') ? 1 : 0;
      });
      return list;
    }
    function renderOA() {
      $('#pageActions').innerHTML = '<button class="btn" data-act="sap-export" data-what="oa">' + ICON.excel + ' Export Excel</button>';
      var view = $('#view');
      if (!idx().oas.length) { view.innerHTML = clientChips() + noData('kontrak OA (ME3N)'); return; }
      var F = V.oa, all = idx().oas.filter(function (x) { return clientOk(x.c); });
      var act = all.filter(function (x) { return x.st !== 'expired'; });
      var pgs = {}; all.forEach(function (x) { if (x.o.pg) pgs[x.o.pg] = (pgs[x.o.pg] || 0) + 1; });
      var tg = sumIdr(act, function (x) { return x.o.tgt; }, function (x) { return x.o.cur; }), rl = sumIdr(act, function (x) { return x.o.rel; }, function (x) { return x.o.cur; });
      var nW = all.filter(function (x) { return x.st === 'warn'; }).length, nC = all.filter(function (x) { return x.st === 'crit'; }).length;
      view.innerHTML = '<div class="toolbar" style="margin-bottom:12px">' + clientChips() + '<span class="spacer"></span>' + srcLine(['me3n-100', 'me3n-180']) + '</div>' +
        '<div class="kpis" style="margin-bottom:14px">' +
        kpi('OA masih berlaku', ctx.nf0.format(act.length), all.length + ' OA di data ME3N', '', ' data-oast="active"') +
        kpi('Segera berakhir', ctx.nf0.format(nW), '≤ ' + st().warn + ' hari', nW ? 'warn' : '', ' data-oast="warn"') +
        kpi('Kritis', ctx.nf0.format(nC), '≤ ' + st().crit + ' hari', nC ? 'bad' : '', ' data-oast="crit"') +
        kpi('Nilai target (aktif)', moneyIdr(tg), 'ekuivalen IDR · kurs USD ' + ctx.nf0.format(kurs()), '') +
        kpi('Released (terserap)', moneyIdr(rl), tg ? ctx.pct(rl / tg * 100) + ' dari nilai target' : '', '') + '</div>' +
        '<div class="card card-pad" style="margin-bottom:14px;display:flex;flex-direction:column;gap:12px"><div class="toolbar">' + searchBox('oaq', F.q, 'Cari no. OA, vendor, material / deskripsi item…') +
        '<select class="select" id="oapg"><option value="">Semua Purch. Group</option>' + Object.keys(pgs).sort().map(function (p) { return '<option' + (F.pg === p ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select>' +
        '<select class="select" id="oasort">' + [['end', 'Urut: berakhir paling cepat'], ['val', 'Urut: nilai terbesar'], ['pct', 'Urut: serapan tertinggi'], ['ro', 'Urut: RO terbanyak'], ['no', 'Urut: nomor OA']].map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="chips">' + OA_ST.map(function (o) { return '<span class="chip-toggle' + (F.st === o[0] ? ' on' : '') + '" data-oast="' + o[0] + '">' + o[1] + '<span class="chip-n">' + all.filter(function (x) { return oaPass(x, o[0]); }).length + '</span></span>'; }).join('') + '</div></div>' +
        '<div id="oaList"></div>';
      oaRows();
    }
    function oaRows() {
      var list = oaFiltered(), F = V.oa;
      var rows = list.slice(0, F.n).map(function (x) {
        var o = x.o, n = noteOf(x.c, x.no);
        return '<tr class="clickable" data-oa="' + esc(x.c + '/' + x.no) + '"><td><div class="toolbar" style="gap:6px;flex-wrap:nowrap">' + clientBadge(x.c) + '<span class="mono" style="font-weight:700;color:var(--brand)">' + esc(x.no) + '</span></div>' +
          '<div class="small muted" style="margin-top:3px">' + (o.pg ? '<span class="pg-tag">' + esc(o.pg) + '</span> ' : '') + esc(o.dt || '') + ' · ' + x.nItems + ' item</div></td>' +
          '<td class="mat-cell"><div class="mat-desc">' + esc(o.vendor || '—') + '</div><div class="small muted">' + esc(x.cat || '') + '</div>' +
          (n && n.tindak ? '<div style="margin-top:4px"><span class="badge ro">' + esc(ctx.Model.TINDAK[n.tindak] || '') + '</span></div>' : '') + '</td>' +
          '<td class="nowrap small">' + ctx.fmtDate(o.vs) + '<br><b>' + ctx.fmtDate(o.ve) + '</b></td>' +
          '<td>' + daysBadge(x.days) + '<div style="margin-top:6px;min-width:100px">' + bar(x.timePct, 'time') + '</div></td>' +
          '<td class="num nowrap"><b>' + esc(money(o.tgt, o.cur)) + '</b><div class="small muted">released ' + esc(money(o.rel, o.cur)) + '</div></td>' +
          '<td style="min-width:120px">' + bar(x.pct, x.pct >= 100 ? 'bad' : x.pct >= st().absorbWarn ? 'warn' : '') + '<div class="small muted">' + ctx.pct(x.pct) + ' terserap</div></td>' +
          '<td class="num">' + (x.ros.length ? '<b>' + x.ros.length + '</b><div class="small muted">' + esc(money(x.roVal, o.cur)) + '</div>' : '<span class="muted">—</span>') + '</td></tr>';
      }).join('');
      $('#oaList').innerHTML = list.length ? '<div class="result-meta" style="margin-bottom:10px"><b>' + list.length + '</b> OA</div><div class="table-wrap tall"><table class="grid"><thead><tr><th>No. OA</th><th>Vendor / kategori</th><th>Berlaku</th><th>Sisa waktu</th><th class="num">Nilai target</th><th>Serapan</th><th class="num">RO (ME2N)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + more(list, F.n, 'oa-more')
        : '<div class="card empty"><h3>Tidak ada OA yang cocok</h3><p>Ubah kata kunci, client, atau filter status.</p></div>';
    }

    function renderOADetail(arg) {
      var p = arg.split('/'), c = p[0], no = p[1], x = idx().oas.filter(function (y) { return y.c === c && y.no === no; })[0], view = $('#view');
      if (!x) { view.innerHTML = '<div class="card empty"><h3>OA ' + esc(no || '') + ' tidak ada di data ME3N</h3><a class="btn" href="#/oa">' + ICON.back + ' Kembali</a></div>'; return; }
      var o = x.o, n = noteOf(c, no) || {}, w = ctx.canWrite();
      $('#pageTitle').textContent = 'OA ' + no; $('#pageSub').textContent = o.vendor + ' · Client ' + c + ' ' + clientName(c);
      $('#pageActions').innerHTML = '<a class="btn" href="#/oa">' + ICON.back + ' Daftar OA</a>' + (c === '100' ? '<a class="btn" href="' + esc(ctx.warehouseUrl() + '#/kontrak/' + encodeURIComponent(no)) + '" target="_blank" rel="noopener">' + ICON.link + ' Material di Warehouse ↗</a>' : '') +
        '<button class="btn" data-act="sap-export" data-what="oa1" data-key="' + esc(arg) + '">' + ICON.excel + ' Export</button>';
      var head = '<div class="card head-card" style="margin-bottom:14px"><div><div class="toolbar" style="gap:8px">' + clientBadge(c) + '<span class="mono" style="font-weight:800;color:var(--brand);font-size:15px">' + esc(no) + '</span>' +
        (o.pg ? '<span class="pg-tag">' + esc(o.pg) + '</span>' : '') + (o.dt ? '<span class="badge">' + esc(o.dt) + '</span>' : '') + (o.porg ? '<span class="badge">Porg ' + esc(o.porg) + '</span>' : '') + daysBadge(x.days) + '</div>' +
        '<h2>' + esc(o.vendor || '—') + '</h2><div class="muted">' + (o.vcode ? 'Vendor ' + esc(o.vcode) + ' · ' : '') + esc(x.cat || '') + '</div>' +
        (x.blocked ? '<div style="margin-top:8px"><span class="badge warn">' + x.blocked + ' item diblokir (S) di SAP</span></div>' : '') + '</div>' +
        '<div class="mk-tindak"><div class="small muted" style="font-weight:700;margin-bottom:4px">Tindak lanjut</div>' +
        (w ? '<select class="select" data-oatindak="' + esc(c + ':' + no) + '">' + Object.keys(ctx.Model.TINDAK).filter(function (t) { return t !== 'terminasi'; }).map(function (t) { return '<option value="' + t + '"' + ((n.tindak || '') === t ? ' selected' : '') + '>' + ctx.Model.TINDAK[t] + '</option>'; }).join('') + '</select>' +
          '<textarea class="input" data-oanote="' + esc(c + ':' + no) + '" rows="2" placeholder="Catatan (mis. status amandemen)…" style="width:100%;margin-top:6px">' + esc(n.catatan || '') + '</textarea>' +
          '<button class="btn sm" data-act="oa-note" data-key="' + esc(c + ':' + no) + '" style="margin-top:6px">Simpan catatan</button>'
          : '<b>' + esc(ctx.Model.TINDAK[n.tindak || '']) + '</b>' + (n.catatan ? '<div class="small" style="margin-top:4px">' + esc(n.catatan) + '</div>' : '')) +
        (n.by ? '<div class="small muted" style="margin-top:6px">' + esc(n.by) + ' · ' + ctx.fmtDateTime(n.at) + '</div>' : '') + '</div></div>';
      var kpis = '<div class="kpis" style="margin-bottom:14px">' +
        kpi('Nilai target', esc(money(o.tgt, o.cur)), esc(ctx.fmtMoney(o.tgt, o.cur))) +
        kpi('Released', esc(money(o.rel, o.cur)), bar(x.pct, x.pct >= st().absorbWarn ? 'warn' : '') + '<span style="display:block;margin-top:4px">' + ctx.pct(x.pct) + ' terserap</span>') +
        kpi('Sisa nilai', esc(money(x.sisa, o.cur)), 'target − released') +
        kpi('Masa berlaku', x.days == null ? '—' : x.days < 0 ? 'Berakhir' : ctx.nf0.format(x.days) + ' hari', bar(x.timePct, 'time') + '<span style="display:block;margin-top:4px">' + ctx.fmtDate(o.vs) + ' – ' + ctx.fmtDate(o.ve) + '</span>') +
        kpi('RO dari ME2N', String(x.ros.length), x.ros.length ? esc(money(x.roVal, o.cur)) + ' · outstanding ' + esc(money(x.roOut, o.cur)) : 'belum ada RO di data ME2N') + '</div>';
      var items = o.items.map(function (i) {
        var used = i[5] > 0 ? (i[5] - i[6]) / i[5] * 100 : null;
        return '<tr' + (i[8] === 'L' ? ' class="row-off"' : '') + '><td class="mono small">' + esc(i[0]) + '</td><td><div class="mono small muted">' + esc(i[1]) + '</div><div class="mat-desc" style="font-weight:600">' + esc(i[2]) + '</div></td><td>' + esc(i[3]) + '</td>' +
          '<td class="num nowrap">' + esc(ctx.fmtMoney(i[4], o.cur)) + '</td><td class="num">' + ctx.fmtQ(i[5]) + '</td><td class="num">' + ctx.fmtQ(i[6]) + '</td>' +
          '<td class="num nowrap">' + esc(money(i[7], o.cur)) + '</td><td>' + (i[8] === 'L' ? '<span class="badge bad">Dihapus</span>' : i[8] === 'S' ? '<span class="badge warn">Diblokir</span>' : used != null ? '<span class="small muted">' + ctx.pct(used) + ' qty</span>' : '') + '</td></tr>';
      }).join('');
      var ros = x.ros.slice().sort(function (a, b) { return (b.p.dd || '').localeCompare(a.p.dd || ''); }).map(poRow).join('');
      view.innerHTML = head + kpis +
        '<div class="card card-pad" style="margin-bottom:14px"><h3 class="section-title">Release Order (RO) dari ME2N <span class="badge">' + x.ros.length + '</span></h3>' +
        (ros ? '<div class="table-wrap" style="box-shadow:none;max-height:460px"><table class="grid">' + poHead() + '<tbody>' + ros + '</tbody></table></div>' : '<p class="muted small" style="margin:0">Belum ada RO untuk OA ini di data ME2N client ' + esc(c) + '.</p>') + '</div>' +
        '<div class="card card-pad"><h3 class="section-title">Item kontrak <span class="badge">' + o.items.length + '</span></h3><div class="table-wrap" style="box-shadow:none;max-height:560px"><table class="grid"><thead><tr><th>Item</th><th>Material</th><th>UoM</th><th class="num">Harga</th><th class="num">Target qty</th><th class="num">Open qty</th><th class="num">Released</th><th></th></tr></thead><tbody>' + items + '</tbody></table></div></div>';
    }

    // ================= PO / RO (ME2N) =================
    var PO_ST = { open: ['Dalam pengiriman', 'ro'], partial: ['Diterima sebagian', 'bau'], late: ['Terlambat', 'bad'], inv: ['Diterima · belum ditagih', 'warn'], done: ['Selesai', 'ok'] };
    var PO_F = [['out', 'Outstanding'], ['late', 'Terlambat'], ['inv', 'Belum ditagih'], ['done', 'Selesai'], ['all', 'Semua']];
    function poPass(x, s) { return s === 'all' ? true : s === 'out' ? x.out > 0.5 : s === 'inv' ? x.inv > 0.5 : x.st === s; }
    function poBadge(x) { var b = PO_ST[x.st]; return '<span class="badge ' + b[1] + '">' + b[0] + '</span>'; }
    function poHead() { return '<thead><tr><th>No. PO / RO</th><th>Vendor / material</th><th>Plant</th><th>Tgl dok.</th><th>Delivery</th><th class="num">Nilai</th><th>Penerimaan</th><th>Status</th></tr></thead>'; }
    function poRow(x) {
      var p = x.p, first = p.items[0] || [];
      return '<tr class="clickable" data-po="' + esc(x.c + '/' + x.no) + '"><td><div class="toolbar" style="gap:6px;flex-wrap:nowrap">' + clientBadge(x.c) + '<span class="mono" style="font-weight:700;color:var(--brand)">' + esc(x.no) + '</span></div>' +
        '<div class="small muted" style="margin-top:3px"><span class="badge ' + (x.type === 'RO' ? 'ro' : 'bau') + '">' + x.type + '</span> ' + (x.oa.length ? 'OA ' + esc(x.oa[0]) + (x.oa.length > 1 ? ' +' + (x.oa.length - 1) : '') : esc(p.dt || '')) + '</div></td>' +
        '<td class="mat-cell"><div class="mat-desc">' + esc(p.vendor || '—') + '</div><div class="small muted">' + esc(first[2] || '') + (p.items.length > 1 ? ' <b>+' + (p.items.length - 1) + ' item</b>' : '') + '</div></td>' +
        '<td class="small">' + x.plants.map(function (pl) { return '<div><span class="mono">' + esc(pl) + '</span> ' + esc(plantName(pl)) + '</div>'; }).join('') + '</td>' +
        '<td class="nowrap small">' + ctx.fmtDate(p.dd) + '</td>' +
        '<td class="nowrap small"><b>' + ctx.fmtDate(x.due) + '</b>' + (x.out > 0.5 && x.days != null ? '<div>' + (x.days < 0 ? '<span class="badge bad">lewat ' + ctx.nf0.format(-x.days) + ' hr</span>' : '<span class="small muted">' + ctx.nf0.format(x.days) + ' hari lagi</span>') + '</div>' : '') + '</td>' +
        '<td class="num nowrap"><b>' + esc(money(x.val, p.cur)) + '</b>' + (x.out > 0.5 ? '<div class="small muted">sisa ' + esc(money(x.out, p.cur)) + '</div>' : '') + '</td>' +
        '<td style="min-width:110px">' + bar(x.recv, x.late ? 'bad' : '') + '<div class="small muted">' + ctx.pct(x.recv) + ' diterima</div></td>' +
        '<td>' + poBadge(x) + (x.inv > 0.5 && x.st !== 'inv' ? '<div class="small muted" style="margin-top:3px">blm ditagih ' + esc(money(x.inv, p.cur)) + '</div>' : '') + '</td></tr>';
    }
    function poFiltered() {
      var F = V.po, q = F.q.trim().toLowerCase();
      var list = idx().pos.filter(function (x) {
        if (!clientOk(x.c) || !poPass(x, F.st) || (F.type && x.type !== F.type) || (F.plant && x.plants.indexOf(F.plant) < 0)) return false;
        if (q) {
          var hay = [x.no, x.p.vendor, x.p.vcode, x.oa.join(' '), x.pr.join(' '), x.p.pg, x.plants.join(' ')].join(' ').toLowerCase();
          if (q.split(/\s+/).some(function (w) { return hay.indexOf(w) < 0 && !x.p.items.some(function (i) { return (i[1] + ' ' + i[2]).toLowerCase().indexOf(w) >= 0; }); })) return false;
        }
        return true;
      });
      list.sort(function (a, b) {
        if (F.sort === 'val') return idr(b.out || b.val, b.p.cur) - idr(a.out || a.val, a.p.cur);
        if (F.sort === 'new') return (b.p.dd || '').localeCompare(a.p.dd || '');
        if (F.sort === 'no') return a.no.localeCompare(b.no);
        return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0;
      });
      return list;
    }
    function renderPO() {
      $('#pageActions').innerHTML = '<button class="btn" data-act="sap-export" data-what="po">' + ICON.excel + ' Export Excel</button>';
      var view = $('#view');
      if (!idx().pos.length) { view.innerHTML = clientChips() + noData('PO / RO (ME2N)'); return; }
      var F = V.po, all = idx().pos.filter(function (x) { return clientOk(x.c); });
      var out = all.filter(function (x) { return x.out > 0.5; }), late = all.filter(function (x) { return x.late; }), inv = all.filter(function (x) { return x.inv > 0.5; });
      var plants = {}; all.forEach(function (x) { x.plants.forEach(function (p) { plants[p] = 1; }); });
      // outstanding per plant
      var byPl = {};
      out.forEach(function (x) { x.p.items.forEach(function (i) { if (i[7] > 0) { var k = i[9] || '-'; byPl[k] = byPl[k] || { v: 0, docs: {}, late: {} }; byPl[k].v += idr(i[7], x.p.cur); byPl[k].docs[x.no] = 1; if (x.late) byPl[k].late[x.no] = 1; } }); });
      var plRows = Object.keys(byPl).sort(function (a, b) { return byPl[b].v - byPl[a].v; }).map(function (k) {
        var y = byPl[k], nl = Object.keys(y.late).length;
        return '<button class="pl-chip' + (F.plant === k ? ' on' : '') + '" data-plant="' + esc(k) + '"><b>' + esc(k) + '</b> ' + esc(plantName(k)) + '<span>' + Object.keys(y.docs).length + ' dok · ' + esc(moneyIdr(y.v)) + (nl ? ' · <i>' + nl + ' terlambat</i>' : '') + '</span></button>';
      }).join('');
      view.innerHTML = '<div class="toolbar" style="margin-bottom:12px">' + clientChips() + '<span class="spacer"></span>' + srcLine(['me2n-100', 'me2n-180']) + '</div>' +
        '<div class="kpis" style="margin-bottom:14px">' +
        kpi('Total PO / RO', ctx.nf0.format(all.length), esc(moneyIdr(sumIdr(all, function (x) { return x.val; }, function (x) { return x.p.cur; }))) + ' · ' + all.filter(function (x) { return x.type === 'RO'; }).length + ' RO, ' + all.filter(function (x) { return x.type === 'PO'; }).length + ' PO', '', ' data-post="all"') +
        kpi('Outstanding', ctx.nf0.format(out.length), 'sisa kirim ' + esc(moneyIdr(sumIdr(out, function (x) { return x.out; }, function (x) { return x.p.cur; }))), out.length ? 'warn' : '', ' data-post="out"') +
        kpi('Terlambat', ctx.nf0.format(late.length), esc(moneyIdr(sumIdr(late, function (x) { return x.out; }, function (x) { return x.p.cur; }))) + ' lewat delivery date', late.length ? 'bad' : '', ' data-post="late"') +
        kpi('Belum ditagih', ctx.nf0.format(inv.length), esc(moneyIdr(sumIdr(inv, function (x) { return x.inv; }, function (x) { return x.p.cur; }))) + ' still to be invoiced', '', ' data-post="inv"') + '</div>' +
        (plRows ? '<div class="card card-pad" style="margin-bottom:14px"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">Outstanding per plant</h3><span class="small muted">klik untuk filter</span>' + (F.plant ? '<button class="btn sm" data-plant="">Semua plant</button>' : '') + '</div><div class="pl-grid">' + plRows + '</div></div>' : '') +
        '<div class="card card-pad" style="margin-bottom:14px;display:flex;flex-direction:column;gap:12px"><div class="toolbar">' + searchBox('poq', F.q, 'Cari no. PO/RO, vendor, material, OA, PR…') +
        '<select class="select" id="potype"><option value="">PO & RO</option><option value="RO"' + (F.type === 'RO' ? ' selected' : '') + '>RO saja (call-off OA)</option><option value="PO"' + (F.type === 'PO' ? ' selected' : '') + '>PO saja</option></select>' +
        '<select class="select" id="poplant"><option value="">Semua plant</option>' + Object.keys(plants).sort().map(function (p) { return '<option value="' + esc(p) + '"' + (F.plant === p ? ' selected' : '') + '>' + esc(p + (plantName(p) ? ' · ' + plantName(p) : '')) + '</option>'; }).join('') + '</select>' +
        '<select class="select" id="posort">' + [['due', 'Urut: delivery paling dekat'], ['val', 'Urut: nilai outstanding'], ['new', 'Urut: dokumen terbaru'], ['no', 'Urut: nomor']].map(function (o) { return '<option value="' + o[0] + '"' + (F.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="chips">' + PO_F.map(function (o) { return '<span class="chip-toggle' + (F.st === o[0] ? ' on' : '') + '" data-post="' + o[0] + '">' + o[1] + '<span class="chip-n">' + all.filter(function (x) { return poPass(x, o[0]); }).length + '</span></span>'; }).join('') + '</div></div>' +
        '<div id="poList"></div>';
      poRows();
    }
    function poRows() {
      var list = poFiltered(), F = V.po;
      var tot = sumIdr(list, function (x) { return F.st === 'all' || F.st === 'done' ? x.val : F.st === 'inv' ? x.inv : x.out; }, function (x) { return x.p.cur; });
      $('#poList').innerHTML = list.length ? '<div class="result-meta" style="margin-bottom:10px"><b>' + list.length + '</b> dokumen · ' + (F.st === 'inv' ? 'belum ditagih' : F.st === 'all' || F.st === 'done' ? 'nilai' : 'sisa kirim') + ' <b>' + esc(moneyIdr(tot)) + '</b></div>' +
        '<div class="table-wrap tall"><table class="grid">' + poHead() + '<tbody>' + list.slice(0, F.n).map(poRow).join('') + '</tbody></table></div>' + more(list, F.n, 'po-more')
        : '<div class="card empty"><h3>Tidak ada PO / RO yang cocok</h3><p>Ubah kata kunci, client, atau filter status.</p></div>';
    }
    function openPO(key) {
      var p = key.split('/'), x = idx().pos.filter(function (y) { return y.c === p[0] && y.no === p[1]; })[0];
      if (!x) return;
      var d = $('#drawer'), q = x.p;
      var items = q.items.map(function (i) {
        return '<tr><td class="mono small">' + esc(i[0]) + '</td><td><div class="mono small muted">' + esc(i[1]) + '</div><div style="font-weight:600">' + esc(i[2]) + '</div><div class="small muted">' + esc(i[9]) + ' · delivery ' + ctx.fmtDate(i[10]) + (i[12] ? ' · PR ' + esc(i[12]) : '') + '</div></td>' +
          '<td class="num nowrap">' + ctx.fmtQ(i[3]) + ' ' + esc(i[4]) + '</td><td class="num nowrap">' + esc(money(i[5], q.cur)) + '</td><td class="num nowrap">' + (i[6] > 0 ? '<b style="color:var(--warn)">' + ctx.fmtQ(i[6]) + '</b>' : '<span class="badge ok">✓</span>') + '</td></tr>';
      }).join('');
      d.innerHTML = '<div class="drawer-head"><div style="flex:1;min-width:0"><div class="toolbar" style="gap:6px">' + clientBadge(x.c) + '<span class="mono" style="font-weight:800;color:var(--brand)">' + esc(x.no) + '</span><span class="badge ' + (x.type === 'RO' ? 'ro' : 'bau') + '">' + x.type + '</span>' + poBadge(x) + '</div>' +
        '<h2>' + esc(q.vendor || '—') + '</h2><div class="small muted">' + (q.vcode ? 'Vendor ' + esc(q.vcode) + ' · ' : '') + 'PG ' + esc(q.pg || '-') + (q.dt ? ' · ' + esc(q.dt) : '') + '</div></div><button class="icon-btn" data-act="drawer-close">' + ICON.close + '</button></div>' +
        '<div class="drawer-body"><div class="kv">' +
        '<div><span>Tanggal dokumen</span>' + ctx.fmtDate(q.dd) + '</div><div><span>Delivery (terdekat)</span><b>' + ctx.fmtDate(x.due) + '</b> ' + (x.out > 0.5 ? daysBadge(x.days) : '') + '</div>' +
        '<div><span>Nilai PO/RO</span><b>' + esc(ctx.fmtMoney(x.val, q.cur)) + '</b></div><div><span>Sisa kirim (still to be delivered)</span><b>' + esc(ctx.fmtMoney(x.out, q.cur)) + '</b></div>' +
        '<div><span>Belum ditagih (still to be invoiced)</span>' + esc(ctx.fmtMoney(x.inv, q.cur)) + '</div><div><span>Penerimaan</span>' + ctx.pct(x.recv) + '</div>' +
        '<div><span>Outline Agreement</span>' + (x.oa.length ? x.oa.map(function (o) { return '<a class="mono" href="#/oa/' + esc(x.c + '/' + o) + '">' + esc(o) + '</a>'; }).join(', ') : '—') + '</div>' +
        '<div><span>Purchase Requisition</span><span class="mono small">' + esc(x.pr.slice(0, 6).join(', ') || '—') + (x.pr.length > 6 ? ' …' : '') + '</span></div></div>' +
        '<div><h3 class="section-title">Item <span class="badge">' + q.items.length + '</span></h3><div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>Item</th><th>Material</th><th class="num">Qty</th><th class="num">Nilai</th><th class="num">Sisa kirim</th></tr></thead><tbody>' + items + '</tbody></table></div></div></div>';
      d.classList.add('open'); $('#scrim').classList.add('open'); d.setAttribute('aria-hidden', 'false');
    }

    // ================= Progres PR & PO =================
    var PR_ST = { 'On Progress': 'ro', 'On Planning': 'warn', 'On Review': 'bau', 'Need Confirmation': 'bad' };
    function prRows() {
      var P = (S.sap && S.sap.pr) || { pengadaan: [], expediting: [] }, t = today();
      return P.pengadaan.map(function (r) {
        var cancelled = /cancel|batal/i.test(r.note || '');
        var stt = cancelled ? 'Batal' : r.st || (r.pr ? 'Belum ada status' : 'Pipeline / belum PR');
        var wd = r.tgl ? workdays(r.tgl, t) : null;
        return Object.assign({}, r, { stt: stt, lt: wd == null ? null : Math.max(0, wd - 1), clients: wkClients(r.wk) });
      });
    }
    function exRows() {
      var P = (S.sap && S.sap.pr) || { expediting: [] }, I = idx(), t = today();
      return P.expediting.map(function (r) {
        var sap = r.po ? I.poByNo[r.po] : null;
        var got = sap && sap.out <= 0.5 && !/routing|approval/i.test(r.st);
        var late = !got && (/late/i.test(r.st) || (/deliver/i.test(r.st) && r.deliv && r.deliv < t));
        var stt = got ? 'Sudah diterima (SAP)' : /late/i.test(r.st) ? 'Outstanding (late)' : /routing|approval/i.test(r.st) ? 'Routing Approval' : /deliver/i.test(r.st) ? (r.deliv && r.deliv < t ? 'Lewat delivery date' : 'PO/RO on delivery') : (r.st || '—');
        return Object.assign({}, r, { sap: sap, late: late, stt: stt, days: r.deliv ? ctx.Model.dayDiff(t, r.deliv) : null, clients: wkClients(r.wk) });
      });
    }
    function bucket(lt) { return lt == null ? 'Tanggal belum diisi' : lt <= 30 ? '0–30 HK' : lt <= 60 ? '31–60 HK' : lt <= 90 ? '61–90 HK' : '> 90 HK'; }
    function renderProgres() {
      var view = $('#view'), P = S.sap && S.sap.pr;
      $('#pageActions').innerHTML = P ? '<button class="btn" data-act="sap-export" data-what="pr">' + ICON.excel + ' Export Excel</button>' : '';
      if (!P) { view.innerHTML = clientChips() + noData('Progres PR & PO'); return; }
      var tab = V.pr.tab;
      var src = S.sap.src && S.sap.src.progres;
      view.innerHTML = '<div class="toolbar" style="margin-bottom:12px">' + clientChips() + '<span class="spacer"></span>' + (src ? '<div class="src-line small muted">File: <b>' + esc(src.file || '') + '</b> · update ' + ctx.fmtDate(src.date) + '</div>' : '') + '</div>' +
        '<div class="mk-tabs"><button class="mk-tab' + (tab === 'pengadaan' ? ' on' : '') + '" data-prtab="pengadaan">Pengadaan (PR) <span class="chip-n">' + prRows().filter(function (r) { return wkOk(r.wk); }).length + '</span></button>' +
        '<button class="mk-tab' + (tab === 'expediting' ? ' on' : '') + '" data-prtab="expediting">Expediting (PO / RO) <span class="chip-n">' + exRows().filter(function (r) { return wkOk(r.wk); }).length + '</span></button></div>' +
        '<div id="prBox"></div>';
      if (tab === 'pengadaan') renderPengadaan(); else renderExpediting();
    }
    function sumCur(list) {
      var t = {}; list.forEach(function (r) { if (r.nilai) t[r.cur || 'IDR'] = (t[r.cur || 'IDR'] || 0) + r.nilai; });
      return Object.keys(t).map(function (c) { return money(t[c], c); }).join(' + ') || '—';
    }
    function renderPengadaan() {
      var all = prRows().filter(function (r) { return wkOk(r.wk); }), F = V.pr, q = F.q.trim().toLowerCase();
      var stOrder = ['On Progress', 'On Review', 'Need Confirmation', 'On Planning', 'Belum ada status', 'Pipeline / belum PR', 'Batal'];
      var cnt = {}; all.forEach(function (r) { cnt[r.stt] = (cnt[r.stt] || 0) + 1; });
      var sts = stOrder.filter(function (s) { return cnt[s]; }).concat(Object.keys(cnt).filter(function (s) { return stOrder.indexOf(s) < 0; }));
      var list = all.filter(function (r) { return (!F.st || r.stt === F.st) && (!q || [r.desc, r.pr, r.prq, r.wk, r.pic, r.note].join(' ').toLowerCase().indexOf(q) >= 0); });
      var prog = all.filter(function (r) { return r.stt === 'On Progress'; }), plan = all.filter(function (r) { return r.stt === 'On Planning'; }), pipe = all.filter(function (r) { return /Pipeline|Belum ada/.test(r.stt); });
      var act = all.filter(function (r) { return r.stt !== 'Batal' && r.tgl; }), bk = {};
      act.forEach(function (r) { var b = bucket(r.lt); bk[b] = (bk[b] || 0) + 1; });
      var bmax = Math.max.apply(null, [1].concat(Object.keys(bk).map(function (k) { return bk[k]; })));
      var buckets = ['0–30 HK', '31–60 HK', '61–90 HK', '> 90 HK'].map(function (b, i) {
        return '<div class="lt-row"><span>' + b + '</span><div class="mk-bar ' + (i === 3 ? 'bad' : i === 2 ? 'warn' : '') + '"><i style="width:' + ((bk[b] || 0) / bmax * 100) + '%"></i></div><b>' + (bk[b] || 0) + '</b></div>';
      }).join('');
      // status / tahapan (Status/Note)
      var stage = {}; all.forEach(function (r) { if (r.stt === 'On Progress' || r.stt === 'On Planning') { var k = r.note || '—'; stage[k] = (stage[k] || 0) + 1; } });
      var rows = list.map(function (r) {
        return '<tr><td class="small muted">' + esc(r.no || '') + '</td><td class="nowrap small">' + (r.tgl ? ctx.fmtDate(r.tgl) : '—') + (r.prq ? '<div class="mono small muted">PRq ' + esc(r.prq) + '</div>' : '') + '</td>' +
          '<td class="mono small">' + esc(r.pr || '—') + '</td><td><div class="mat-desc">' + esc(r.desc) + '</div><div class="small muted">' + esc(r.wk || '') + ' ' + r.clients.map(clientBadge).join(' ') + '</div></td>' +
          '<td class="num nowrap">' + (r.nilai != null ? '<b>' + esc(money(r.nilai, r.cur)) + '</b>' : '<span class="muted">—</span>') + '</td><td class="small">' + esc(r.pic || '—') + '</td>' +
          '<td class="num">' + (r.lt != null ? '<span class="badge ' + (r.lt > 90 ? 'bad' : r.lt > 60 ? 'warn' : '') + '">' + r.lt + ' HK</span>' : '<span class="muted">—</span>') + '</td>' +
          '<td><span class="badge ' + (PR_ST[r.stt] || (r.stt === 'Batal' ? '' : 'out')) + '">' + esc(r.stt) + '</span>' + (r.note ? '<div class="small" style="margin-top:4px">' + esc(r.note) + '</div>' : '') + '</td></tr>';
      }).join('');
      $('#prBox').innerHTML = '<div class="kpis" style="margin:14px 0">' +
        kpi('Rencana pengadaan', String(all.filter(function (r) { return r.stt !== 'Batal'; }).length), esc(sumCur(all.filter(function (r) { return r.stt !== 'Batal'; })))) +
        kpi('On Progress', String(prog.length), esc(sumCur(prog)), prog.length ? '' : '', ' data-prst="On Progress"') +
        kpi('On Planning', String(plan.length), esc(sumCur(plan)), plan.length ? 'warn' : '', ' data-prst="On Planning"') +
        kpi('Pipeline / belum PR', String(pipe.length), 'RFI, drafting, mapping item', '', ' data-prst="Pipeline / belum PR"') +
        kpi('Lead time > 90 HK', String(bk['> 90 HK'] || 0), 'sejak project request (hari kerja)', bk['> 90 HK'] ? 'bad' : '') + '</div>' +
        '<div class="mk-dash" style="margin-bottom:14px"><div class="card card-pad"><h3 class="section-title">Tahapan pengadaan berjalan (Status/Note)</h3><div class="chips">' +
        Object.keys(stage).sort(function (a, b) { return stage[b] - stage[a]; }).map(function (k) { return '<span class="stage-chip">' + esc(k) + ' <b>' + stage[k] + '</b></span>'; }).join('') + '</div></div>' +
        '<div class="card card-pad"><h3 class="section-title">Lead time sejak project request</h3>' + buckets + '<div class="small muted" style="margin-top:8px">Hari kerja (tanpa Sabtu, Minggu & libur nasional) dihitung otomatis s/d hari ini.</div></div></div>' +
        '<div class="card card-pad" style="margin-bottom:14px;display:flex;flex-direction:column;gap:12px"><div class="toolbar">' + searchBox('prq', F.q, 'Cari deskripsi, no. PR, WK/Field, PIC buyer…') + '</div>' +
        '<div class="chips"><span class="chip-toggle' + (!F.st ? ' on' : '') + '" data-prst="">Semua<span class="chip-n">' + all.length + '</span></span>' + sts.map(function (s) { return '<span class="chip-toggle' + (F.st === s ? ' on' : '') + '" data-prst="' + esc(s) + '">' + esc(s) + '<span class="chip-n">' + cnt[s] + '</span></span>'; }).join('') + '</div></div>' +
        (list.length ? '<div class="table-wrap tall"><table class="grid"><thead><tr><th>No.</th><th>Tgl project req</th><th>No. PR</th><th>Deskripsi / WK</th><th class="num">Nilai</th><th>PIC buyer</th><th class="num">Lead time</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="card empty"><h3>Tidak ada data yang cocok</h3></div>');
    }
    function renderExpediting() {
      var all = exRows().filter(function (r) { return wkOk(r.wk); }), F = V.pr, q = F.q.trim().toLowerCase();
      var cnt = {}; all.forEach(function (r) { cnt[r.stt] = (cnt[r.stt] || 0) + 1; });
      var list = all.filter(function (r) { return (!F.st || r.stt === F.st) && (!q || [r.desc, r.pr, r.po, r.wk, r.vendor, r.note].join(' ').toLowerCase().indexOf(q) >= 0); });
      list.sort(function (a, b) { return (b.late - a.late) || ((a.deliv || '9999') < (b.deliv || '9999') ? -1 : 1); });
      var onDel = all.filter(function (r) { return /on delivery|Lewat delivery/i.test(r.stt); }), late = all.filter(function (r) { return r.late; }), rout = all.filter(function (r) { return /Routing/.test(r.stt); });
      var sapDone = all.filter(function (r) { return r.stt === 'Sudah diterima (SAP)'; });
      // per WK/Field
      var wk = {};
      all.forEach(function (r) { var k = r.wk || '—', w = wk[k] = wk[k] || { d: 0, l: 0, a: 0, r: 0, n: 0 }; w.n++; if (r.late) w.l++; else if (/Routing/.test(r.stt)) w.a++; else if (/SAP/.test(r.stt)) w.r++; else w.d++; });
      var wkRows = Object.keys(wk).sort().map(function (k) { var w = wk[k]; return '<tr><td><b>' + esc(k) + '</b></td><td class="num">' + w.d + '</td><td class="num">' + (w.l ? '<span class="badge bad">' + w.l + '</span>' : 0) + '</td><td class="num">' + w.a + '</td><td class="num">' + (w.r ? '<span class="badge ok">' + w.r + '</span>' : 0) + '</td><td class="num"><b>' + w.n + '</b></td></tr>'; }).join('');
      var rows = list.map(function (r) {
        var s = r.sap, sapTxt = '';
        if (s && /SAP/.test(r.stt)) sapTxt = '<div class="small muted" style="margin-top:4px">GR penuh di ME2N</div>';
        else if (s) sapTxt = '<div class="small" style="margin-top:4px">' + (s.out <= 0.5 ? '<span class="badge ok">SAP: diterima penuh</span>' : '<span class="small muted">SAP: ' + ctx.pct(s.recv) + ' diterima · sisa ' + esc(money(s.out, s.p.cur)) + '</span>') + '</div>';
        else if (r.po) sapTxt = '<div class="small muted" style="margin-top:4px">tidak ada di data ME2N</div>';
        return '<tr' + (s ? ' class="clickable" data-po="' + esc(s.c + '/' + s.no) + '"' : '') + '><td><div class="mono" style="font-weight:700;color:var(--brand)">' + esc(r.po || '—') + '</div><div class="mono small muted">PR ' + esc(r.pr || '—') + '</div></td>' +
          '<td><div class="mat-desc">' + esc(r.desc) + '</div><div class="small muted">' + esc(r.vendor || '') + '</div></td><td class="small">' + esc(r.wk) + ' ' + r.clients.map(clientBadge).join(' ') + '</td>' +
          '<td class="num nowrap"><b>' + (r.nilai != null ? esc(money(r.nilai, r.cur)) : '—') + '</b></td>' +
          '<td class="nowrap small"><b>' + (r.deliv ? ctx.fmtDate(r.deliv) : '—') + '</b>' + (r.days != null && !(s && s.out <= 0.5) ? '<div>' + (r.days < 0 ? '<span class="badge bad">lewat ' + (-r.days) + ' hr</span>' : '<span class="small muted">' + r.days + ' hari lagi</span>') + '</div>' : '') + '</td>' +
          '<td><span class="badge ' + (r.late ? 'bad' : /Routing/.test(r.stt) ? 'warn' : /SAP/.test(r.stt) ? 'ok' : 'ro') + '">' + esc(r.stt) + '</span>' + (r.note ? '<div class="small" style="margin-top:4px">' + esc(r.note) + '</div>' : '') + sapTxt + '</td></tr>';
      }).join('');
      $('#prBox').innerHTML = '<div class="kpis" style="margin:14px 0">' +
        kpi('Total PO / RO', String(all.length), esc(sumCur(all)), '', ' data-prst=""') +
        kpi('On delivery', String(onDel.length), esc(sumCur(onDel)), '', ' data-prst="PO/RO on delivery"') +
        kpi('Terlambat', String(late.length), esc(sumCur(late)) + ' · late + lewat delivery date', late.length ? 'bad' : '') +
        kpi('Routing approval', String(rout.length), esc(sumCur(rout)), rout.length ? 'warn' : '', ' data-prst="Routing Approval"') +
        kpi('Sudah diterima (SAP)', String(sapDone.length), 'GR penuh di ME2N — perbarui status di file progres', sapDone.length ? 'ok' : '', ' data-prst="Sudah diterima (SAP)"') + '</div>' +
        '<div class="mk-dash" style="margin-bottom:14px"><div class="card card-pad" style="display:flex;flex-direction:column;gap:12px"><div class="toolbar">' + searchBox('prq', F.q, 'Cari deskripsi, no. PO/RO, PR, vendor…') + '</div>' +
        '<div class="chips"><span class="chip-toggle' + (!F.st ? ' on' : '') + '" data-prst="">Semua<span class="chip-n">' + all.length + '</span></span>' + Object.keys(cnt).sort().map(function (s) { return '<span class="chip-toggle' + (F.st === s ? ' on' : '') + '" data-prst="' + esc(s) + '">' + esc(s) + '<span class="chip-n">' + cnt[s] + '</span></span>'; }).join('') + '</div>' +
        '<div class="small muted">Kolom status SAP diambil otomatis dari data ME2N (penerimaan barang & sisa kirim). Klik baris untuk melihat item PO/RO.</div></div>' +
        '<div class="card card-pad"><h3 class="section-title">Status PO/RO per WK/Field</h3><div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>WK/Field</th><th class="num" title="PO/RO on delivery">Kirim</th><th class="num">Late</th><th class="num" title="Routing approval">Appr.</th><th class="num" title="Sudah diterima penuh di SAP">GR</th><th class="num">Total</th></tr></thead><tbody>' + wkRows + '</tbody></table></div></div></div>' +
        (list.length ? '<div class="table-wrap tall"><table class="grid"><thead><tr><th>No. PO/RO · PR</th><th>Deskripsi / vendor</th><th>WK/Field</th><th class="num">Nilai</th><th>Deliv date</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="card empty"><h3>Tidak ada data yang cocok</h3></div>');
    }

    // ================= Dashboard (ringkasan SAP) =================
    function dashboard() {
      if (!has()) return '';
      var I = idx(), s = st(), t = today();
      var oas = I.oas.filter(function (x) { return clientOk(x.c); }), act = oas.filter(function (x) { return x.st !== 'expired'; });
      var soon = oas.filter(function (x) { return x.st === 'warn' || x.st === 'crit'; }).sort(function (a, b) { return a.days - b.days; });
      var pos = I.pos.filter(function (x) { return clientOk(x.c); }), out = pos.filter(function (x) { return x.out > 0.5; }), late = pos.filter(function (x) { return x.late; }).sort(function (a, b) { return idr(b.out, b.p.cur) - idr(a.out, a.p.cur); });
      var pr = prRows().filter(function (r) { return wkOk(r.wk) && r.stt !== 'Batal'; }), ex = exRows().filter(function (r) { return wkOk(r.wk); });
      var tg = sumIdr(act, function (x) { return x.o.tgt; }, function (x) { return x.o.cur; }), rl = sumIdr(act, function (x) { return x.o.rel; }, function (x) { return x.o.cur; });
      var link = function (href, inner, cls) { return '<a class="kpi kpi-click' + (cls ? ' kpi-' + cls : '') + '" href="' + href + '">' + inner + '</a>'; };
      var k = function (l, v, sub) { return '<div class="k">' + l + '</div><div class="v">' + v + '</div><div class="s">' + sub + '</div>'; };
      var html = '<div class="toolbar" style="margin-bottom:12px">' + clientChips() + '<span class="spacer"></span><span class="small muted">Kurs USD ' + ctx.nf0.format(kurs()) + ' untuk total ekuivalen IDR</span></div>';
      if (I.oas.length) html += '<div class="sec-h"><h3>Kontrak OA · ME3N</h3><a href="#/oa" class="small">Lihat semua →</a></div><div class="kpis" style="margin-bottom:16px">' +
        link('#/oa', k('OA masih berlaku', ctx.nf0.format(act.length), 'Client ' + (V.client || '100 & 180'))) +
        link('#/oa', k('Segera berakhir', ctx.nf0.format(soon.length), '≤ ' + s.warn + ' hari · ' + soon.filter(function (x) { return x.st === 'crit'; }).length + ' kritis'), soon.length ? 'warn' : '') +
        link('#/oa', k('Nilai target aktif', esc(moneyIdr(tg)), 'ekuivalen IDR')) +
        link('#/oa', k('Serapan (released)', tg ? ctx.pct(rl / tg * 100) : '—', esc(moneyIdr(rl)) + ' terpakai')) + '</div>';
      if (I.pos.length) html += '<div class="sec-h"><h3>PO / RO · ME2N</h3><a href="#/po" class="small">Lihat semua →</a></div><div class="kpis" style="margin-bottom:16px">' +
        link('#/po', k('PO / RO outstanding', ctx.nf0.format(out.length), 'sisa kirim ' + esc(moneyIdr(sumIdr(out, function (x) { return x.out; }, function (x) { return x.p.cur; })))), out.length ? 'warn' : '') +
        link('#/po', k('Terlambat', ctx.nf0.format(late.length), esc(moneyIdr(sumIdr(late, function (x) { return x.out; }, function (x) { return x.p.cur; }))) + ' belum diterima'), late.length ? 'bad' : '') +
        link('#/po', k('Belum ditagih', ctx.nf0.format(pos.filter(function (x) { return x.inv > 0.5; }).length), esc(moneyIdr(sumIdr(pos, function (x) { return x.inv; }, function (x) { return x.p.cur; }))))) +
        link('#/po', k('Total PO / RO', ctx.nf0.format(pos.length), esc(moneyIdr(sumIdr(pos, function (x) { return x.val; }, function (x) { return x.p.cur; }))))) + '</div>';
      if (S.sap.pr) html += '<div class="sec-h"><h3>Progres PR &amp; PO</h3><a href="#/progres" class="small">Lihat detail →</a></div><div class="kpis" style="margin-bottom:16px">' +
        link('#/progres', k('PR on progress', String(pr.filter(function (r) { return r.stt === 'On Progress'; }).length), esc(sumCur(pr.filter(function (r) { return r.stt === 'On Progress'; }))))) +
        link('#/progres', k('PR on planning', String(pr.filter(function (r) { return r.stt === 'On Planning'; }).length), esc(sumCur(pr.filter(function (r) { return r.stt === 'On Planning'; })))), 'warn') +
        link('#/progres', k('Expediting on delivery', String(ex.filter(function (r) { return /on delivery|Lewat delivery/i.test(r.stt) && !r.late; }).length), esc(sumCur(ex.filter(function (r) { return /on delivery|Lewat delivery/i.test(r.stt) && !r.late; }))))) +
        link('#/progres', k('Expediting terlambat', String(ex.filter(function (r) { return r.late; }).length), esc(sumCur(ex.filter(function (r) { return r.late; })))), ex.some(function (r) { return r.late; }) ? 'bad' : '') + '</div>';
      // tabel: OA segera berakhir & PO terlambat
      var oaT = soon.slice(0, 8).map(function (x) {
        var n = noteOf(x.c, x.no);
        return '<tr class="clickable" data-oa="' + esc(x.c + '/' + x.no) + '"><td>' + clientBadge(x.c) + ' <span class="mono">' + esc(x.no) + '</span></td><td><div class="mat-desc">' + esc(x.o.vendor) + '</div><div class="small muted">' + esc(x.cat) + '</div></td><td class="nowrap">' + ctx.fmtDate(x.o.ve) + '<div>' + daysBadge(x.days) + '</div></td><td>' + (n && n.tindak ? '<span class="badge ro">' + esc(ctx.Model.TINDAK[n.tindak]) + '</span>' : '<span class="badge warn">Belum ada rencana</span>') + '</td></tr>';
      }).join('');
      var poT = late.slice(0, 8).map(function (x) {
        return '<tr class="clickable" data-po="' + esc(x.c + '/' + x.no) + '"><td>' + clientBadge(x.c) + ' <span class="mono">' + esc(x.no) + '</span></td><td><div class="mat-desc">' + esc(x.p.vendor) + '</div><div class="small muted">' + esc((x.p.items[0] || [])[2] || '') + '</div></td><td class="nowrap">' + ctx.fmtDate(x.due) + '<div><span class="badge bad">lewat ' + ctx.nf0.format(-x.days) + ' hr</span></div></td><td class="num nowrap"><b>' + esc(money(x.out, x.p.cur)) + '</b></td></tr>';
      }).join('');
      if (oaT || poT) html += '<div class="mk-dash2" style="margin-bottom:16px">' +
        '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">OA segera berakhir</h3><span class="badge ' + (soon.length ? 'warn' : 'ok') + '">' + soon.length + '</span><span class="spacer"></span><a class="small" href="#/jatuh-tempo">Jatuh tempo →</a></div>' +
        (oaT ? '<div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>No. OA</th><th>Vendor</th><th>Berakhir</th><th>Tindak lanjut</th></tr></thead><tbody>' + oaT + '</tbody></table></div>' : '<p class="muted small" style="margin:0">Tidak ada OA yang berakhir ≤ ' + s.warn + ' hari.</p>') + '</div>' +
        '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">PO / RO terlambat (nilai terbesar)</h3><span class="badge ' + (late.length ? 'bad' : 'ok') + '">' + late.length + '</span><span class="spacer"></span><a class="small" href="#/po" data-post-go="late">Semua →</a></div>' +
        (poT ? '<div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>No. PO/RO</th><th>Vendor / material</th><th>Delivery</th><th class="num">Sisa kirim</th></tr></thead><tbody>' + poT + '</tbody></table></div>' : '<p class="muted small" style="margin:0">Tidak ada PO/RO terlambat.</p>') + '</div></div>';
      return '<div class="sap-dash">' + html + '</div>';
    }
    // OA yang berakhir (untuk halaman Jatuh Tempo)
    function dueList() {
      return idx().oas.filter(function (x) { return clientOk(x.c); }).map(function (x) {
        var n = noteOf(x.c, x.no) || {};
        return { sap: true, c: x.c, no: x.no, end: x.o.ve, days: x.days, x: x, tindak: n.tindak || '', closed: n.tindak === 'selesai' };
      });
    }
    function oaTindakSelect(c, no, val) {
      return '<select class="select sm" data-oatindak="' + esc(c + ':' + no) + '">' + Object.keys(ctx.Model.TINDAK).filter(function (t) { return t !== 'terminasi'; }).map(function (t) { return '<option value="' + t + '"' + ((val || '') === t ? ' selected' : '') + '>' + ctx.Model.TINDAK[t] + '</option>'; }).join('') + '</select>';
    }

    // ================= Upload =================
    function uploadCard() {
      var src = (S.sap && S.sap.src) || {};
      var keys = [['me3n-100', 'ME3N · Client 100'], ['me3n-180', 'ME3N · Client 180'], ['me2n-100', 'ME2N · Client 100'], ['me2n-180', 'ME2N · Client 180'], ['progres', 'Progres PR & PO']];
      return '<div class="card card-pad" style="margin-bottom:16px"><div class="toolbar" style="align-items:flex-start"><div style="flex:1;min-width:260px"><h3 style="margin:0 0 6px">' + ICON.upload.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"') + ' Upload data Monitoring SAP</h3>' +
        '<p class="small muted" style="margin:0;line-height:1.6">Pilih beberapa file sekaligus: export <b>ME3N</b> (kontrak OA), <b>ME2N</b> (PO/RO) client 100 & 180, dan file <b>Progres PR/RO</b> (sheet Pengadaan & Expediting). ' +
        'Jenis file & client dideteksi otomatis (nama file berisi <span class="mono">_100_</span> / <span class="mono">_180_</span>). Upload ulang = data jenis itu diganti yang terbaru.</p></div>' +
        (ctx.canWrite() ? '<label class="btn primary">' + ICON.upload + ' Pilih file Excel<input type="file" id="sapFiles" accept=".xlsx,.xls,.xlsm" multiple hidden></label>' : '') + '</div>' +
        '<div class="src-grid">' + keys.map(function (k) {
          var x = src[k[0]];
          return '<div class="src-item' + (x ? ' on' : '') + '"><b>' + k[1] + '</b><span>' + (x ? 'data ' + ctx.fmtDate(x.date) + ' · ' + esc(x.n || '') : 'belum ada') + '</span>' + (x ? '<span class="small muted">' + esc(x.by || '') + ' · ' + ctx.fmtDateTime(x.at) + '</span>' : '') + '</div>';
        }).join('') + '</div>' + (S.sapPending ? pendingHtml() : '') + '</div>';
    }
    function pendingHtml() {
      var P = S.sapPending;
      var rows = P.map(function (f, i) {
        var lbl = f.err ? '<span class="badge bad">Gagal</span>' : '<span class="badge ro">' + f.res.kind.toUpperCase() + '</span>';
        var cl = f.err || f.res.kind === 'progres' ? '' : '<select class="select sm" data-sapcl="' + i + '"><option value="">— pilih client —</option><option value="100"' + (f.res.client === '100' ? ' selected' : '') + '>100 · ' + esc(clientName('100')) + '</option><option value="180"' + (f.res.client === '180' ? ' selected' : '') + '>180 · ' + esc(clientName('180')) + '</option></select>';
        var info = f.err ? esc(f.err) : Object.keys(f.res.info).map(function (k) { return k + ' ' + ctx.nf0.format(f.res.info[k]); }).join(' · ');
        return '<tr><td><b>' + esc(f.name) + '</b></td><td>' + lbl + '</td><td>' + cl + '</td><td class="small">' + (f.res ? ctx.fmtDate(f.res.date) : '') + '</td><td class="small muted">' + info + '</td></tr>';
      }).join('');
      var ok = P.some(function (f) { return !f.err; });
      return '<div style="margin-top:14px"><div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>File</th><th>Jenis</th><th>Client</th><th>Tgl data</th><th>Isi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="toolbar" style="margin-top:10px;justify-content:flex-end"><button class="btn" data-act="sap-cancel">Batal</button><button class="btn primary" data-act="sap-save"' + (ok ? '' : ' disabled') + '>Simpan &amp; publikasikan</button></div></div>';
    }
    function parseFile(file) {
      return file.arrayBuffer().then(function (buf) {
        return new Promise(function (resolve, reject) {
          var w;
          try { w = new Worker('js/sapworker.js?v=' + ctx.APP_VERSION); } catch (e) { return reject(e); }
          w.onmessage = function (e) { w.terminate(); if (e.data.ok) resolve(e.data.res); else reject(new Error(e.data.error)); };
          w.onerror = function (e) { e.preventDefault(); w.terminate(); reject(new Error('Gagal membaca file')); };
          w.postMessage({ buf: buf, name: file.name, lastModified: file.lastModified, today: today() }, [buf]);
        });
      });
    }
    async function handleFiles(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      var out = [];
      for (var i = 0; i < files.length; i++) {
        ctx.loading('Membaca ' + files[i].name + ' (' + (i + 1) + '/' + files.length + ')… file besar bisa ±10 detik');
        try { out.push({ name: files[i].name, res: await parseFile(files[i]) }); }
        catch (e) { out.push({ name: files[i].name, err: e.message }); }
      }
      ctx.loading(false);
      S.sapPending = out;
      ctx.render();
    }
    async function savePending() {
      var P = (S.sapPending || []).filter(function (f) { return !f.err; });
      if (P.some(function (f) { return f.res.kind !== 'progres' && !f.res.client; })) { ctx.toast('Pilih client (100 / 180) untuk semua file ME3N / ME2N', true); return; }
      if (!(await ctx.ensureToken())) { ctx.toast('Akses simpan belum aktif — hubungkan GitHub di Pengaturan', true); return; }
      ctx.loading('Mengenkripsi & menyimpan data SAP…');
      try {
        var now = new Date().toISOString();
        var next = await ctx.GH.atomic({
          path: 'data/sap.js', varName: 'MK_SAP', note: 'Data Monitoring SAP (ME3N, ME2N, Progres PR/PO)', key: S.key,
          message: 'Upload data SAP: ' + P.map(function (f) { return f.res.kind.toUpperCase() + (f.res.client ? ' ' + f.res.client : '') + ' ' + f.res.date; }).join(', ') + ' (' + ctx.me() + ')',
          mutate: function (cur) {
            var D = cur || { v: 1, src: {}, oa: {}, po: {}, pr: null };
            D.src = D.src || {}; D.oa = D.oa || {}; D.po = D.po || {};
            P.forEach(function (f) {
              var r = f.res, key = r.kind + (r.client ? '-' + r.client : '');
              if (r.kind === 'me3n') D.oa[r.client] = r.data;
              else if (r.kind === 'me2n') D.po[r.client] = r.data;
              else D.pr = r.data;
              D.src[key] = { file: f.name, date: r.date, at: now, by: ctx.me(), n: Object.keys(r.info).map(function (k) { return ctx.nf0.format(r.info[k]) + ' ' + k; }).join(', ') };
            });
            D.updatedAt = now; D.updatedBy = ctx.me();
            return D;
          }
        });
        S.sap = next; S.sapPending = null; reset();
        await ctx.Store.set('sap', next);
        ctx.toast('Data SAP tersimpan. Pengguna lain melihatnya ±1 menit lagi.');
        location.hash = '#/dashboard';
      } catch (e) { ctx.toast('Gagal menyimpan: ' + e.message, true); }
      finally { ctx.loading(false); }
    }
    async function load() {
      var repo = null, cached = await ctx.Store.get('sap');
      try {
        window.MK_SAP = null;
        await ctx.loadScript('data/sap.js?t=' + Date.now());
        if (window.MK_SAP) repo = await ctx.Vault.decrypt(S.key, window.MK_SAP);
      } catch (e) { /* belum ada data */ }
      if (ctx.GH.hasToken() && (!repo || !cached || true)) {
        try { var p = ctx.Vault.payloadOf(await ctx.GH.readText('data/sap.js')); if (p) repo = await ctx.Vault.decrypt(S.key, p); } catch (e) { /* abaikan */ }
      }
      var D = repo;
      if (cached && cached.updatedAt && (!D || cached.updatedAt > D.updatedAt)) D = cached;
      S.sap = D || null;
      if (D) await ctx.Store.set('sap', D);
      reset();
      window.MK_SAP = null;
    }

    // ================= Export =================
    async function exportX(what, key) {
      ctx.loading('Menyiapkan Excel…');
      try {
        await ctx.loadXLSX();
        var wb = XLSX.utils.book_new(), add = function (rows, name) { var ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '-': 'tidak ada data' }]); ws['!cols'] = Object.keys(rows[0] || { a: 1 }).map(function (h) { return { wch: Math.min(45, Math.max(10, h.length + 2)) }; }); XLSX.utils.book_append_sheet(wb, ws, name); };
        var fname;
        if (what === 'oa') {
          add(oaFiltered().map(function (x) { var o = x.o, n = noteOf(x.c, x.no) || {}; return { Client: x.c, 'No. OA': x.no, 'Purch. Org': o.porg, PG: o.pg, 'Doc Type': o.dt, Vendor: o.vendor, 'Kode Vendor': o.vcode, Kategori: x.cat, 'Berlaku Mulai': o.vs, 'Berlaku s/d': o.ve, 'Sisa Hari': x.days, Mata: o.cur, 'Nilai Target': o.tgt, Released: o.rel, 'Serapan %': x.pct == null ? '' : Math.round(x.pct * 10) / 10, 'Sisa Nilai': x.sisa, 'Jumlah Item': x.nItems, 'Jumlah RO': x.ros.length, 'Nilai RO': x.roVal, 'Outstanding RO': x.roOut, 'Tindak Lanjut': ctx.Model.TINDAK[n.tindak || ''], Catatan: n.catatan || '' }; }), 'OA');
          fname = 'Monitoring-OA-ME3N';
        } else if (what === 'oa1') {
          var p = key.split('/'), x = idx().oas.filter(function (y) { return y.c === p[0] && y.no === p[1]; })[0];
          add(x.o.items.map(function (i) { return { Item: i[0], Material: i[1], Deskripsi: i[2], UoM: i[3], Harga: i[4], 'Target Qty': i[5], 'Open Qty': i[6], Released: i[7], Status: i[8] === 'L' ? 'Dihapus' : i[8] === 'S' ? 'Diblokir' : '' }; }), 'Item');
          add(x.ros.map(poRowX), 'RO');
          fname = 'OA-' + x.no;
        } else if (what === 'po') {
          var L = poFiltered();
          add(L.map(poRowX), 'PO-RO');
          var it = []; L.slice(0, 3000).forEach(function (x) { x.p.items.forEach(function (i) { it.push({ Client: x.c, 'No. PO/RO': x.no, Item: i[0], Material: i[1], Deskripsi: i[2], Qty: i[3], UoM: i[4], Nilai: i[5], 'Sisa Kirim Qty': i[6], 'Sisa Kirim Nilai': i[7], 'Belum Ditagih': i[8], Plant: i[9], 'Delivery Date': i[10], OA: i[11], PR: i[12] }); }); });
          add(it, 'Item');
          fname = 'Monitoring-PO-RO-ME2N';
        } else {
          add(prRows().filter(function (r) { return wkOk(r.wk); }).map(function (r) { return { No: r.no, 'Tgl Project Req': r.tgl, 'Project Request No': r.prq, 'No PR': r.pr, 'WK/Field': r.wk, Deskripsi: r.desc, Nilai: r.nilai, CR: r.cur, 'PIC Buyer': r.pic, 'Lead Time (HK)': r.lt, 'Status/Note': r.note, Status: r.stt }; }), 'Pengadaan');
          add(exRows().filter(function (r) { return wkOk(r.wk); }).map(function (r) { return { 'No PR': r.pr, 'No PO/RO': r.po, 'WK/Field': r.wk, Deskripsi: r.desc, Nilai: r.nilai, CR: r.cur, 'Deliv Date': r.deliv, Status: r.stt, Note: r.note, Vendor: r.vendor, 'SAP Diterima %': r.sap && r.sap.recv != null ? Math.round(r.sap.recv) : '', 'SAP Sisa Kirim': r.sap ? r.sap.out : '' }; }), 'Expediting');
          fname = 'Progres-PR-PO';
        }
        XLSX.writeFile(wb, fname + (V.client ? '-' + V.client : '') + '-' + today() + '.xlsx');
      } catch (e) { ctx.toast('Gagal export: ' + e.message, true); }
      finally { ctx.loading(false); }
    }
    function poRowX(x) {
      return { Client: x.c, 'No. PO/RO': x.no, Jenis: x.type, 'Doc Type': x.p.dt, PG: x.p.pg, Vendor: x.p.vendor, 'Kode Vendor': x.p.vcode, Plant: x.plants.join(', '), OA: x.oa.join(', '), 'Tgl Dokumen': x.p.dd, 'Delivery Date': x.due, 'Sisa Hari': x.days, Mata: x.p.cur, Nilai: x.val, 'Sisa Kirim': x.out, 'Belum Ditagih': x.inv, 'Diterima %': x.recv == null ? '' : Math.round(x.recv), Status: PO_ST[x.st][0], 'Jumlah Item': x.p.items.length };
    }

    // ================= Event =================
    document.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-client]'))) { V.client = b.getAttribute('data-client'); ctx.Store.save('client', V.client); V.oa.n = PAGE; V.po.n = PAGE; ctx.render(); return; }
      if ((b = t.closest('[data-oast]'))) { V.oa.st = b.getAttribute('data-oast'); V.oa.n = PAGE; renderOA(); return; }
      if ((b = t.closest('[data-post]'))) { V.po.st = b.getAttribute('data-post'); V.po.n = PAGE; renderPO(); return; }
      if ((b = t.closest('[data-post-go]'))) { V.po.st = b.getAttribute('data-post-go'); return; }
      if ((b = t.closest('[data-plant]'))) { var pl = b.getAttribute('data-plant'); V.po.plant = V.po.plant === pl ? '' : pl; V.po.n = PAGE; renderPO(); return; }
      if ((b = t.closest('[data-prtab]'))) { V.pr.tab = b.getAttribute('data-prtab'); V.pr.st = ''; V.pr.q = ''; renderProgres(); return; }
      if ((b = t.closest('[data-prst]'))) { V.pr.st = b.getAttribute('data-prst'); if (V.pr.tab === 'pengadaan') renderPengadaan(); else renderExpediting(); return; }
      if (t.closest('a,button,select,input,textarea')) {
        b = t.closest('[data-act]');
        if (!b) return;
        var a = b.getAttribute('data-act');
        if (a === 'oa-more') { V.oa.n += PAGE; oaRows(); }
        else if (a === 'po-more') { V.po.n += PAGE; poRows(); }
        else if (a === 'sap-export') exportX(b.getAttribute('data-what'), b.getAttribute('data-key'));
        else if (a === 'sap-save') savePending();
        else if (a === 'sap-cancel') { S.sapPending = null; ctx.render(); }
        else if (a === 'oa-note') saveNote(b.getAttribute('data-key'));
        else if (a === 'drawer-close') ctx.closeDrawer();
        return;
      }
      var tr = t.closest('tr[data-oa]');
      if (tr) { location.hash = '#/oa/' + tr.getAttribute('data-oa'); return; }
      tr = t.closest('tr[data-po]');
      if (tr) openPO(tr.getAttribute('data-po'));
    });
    var tm;
    document.addEventListener('input', function (e) {
      var t = e.target;
      var keep = function (id) { var i = document.getElementById(id); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
      if (t.id === 'oaq') { V.oa.q = t.value; V.oa.n = PAGE; clearTimeout(tm); tm = setTimeout(oaRows, 200); }
      else if (t.id === 'poq') { V.po.q = t.value; V.po.n = PAGE; clearTimeout(tm); tm = setTimeout(poRows, 200); }
      else if (t.id === 'prq') { V.pr.q = t.value; clearTimeout(tm); tm = setTimeout(function () { if (V.pr.tab === 'pengadaan') renderPengadaan(); else renderExpediting(); keep('prq'); }, 250); }
    });
    document.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'oapg') { V.oa.pg = t.value; V.oa.n = PAGE; oaRows(); }
      else if (t.id === 'oasort') { V.oa.sort = t.value; oaRows(); }
      else if (t.id === 'potype') { V.po.type = t.value; V.po.n = PAGE; poRows(); }
      else if (t.id === 'poplant') { V.po.plant = t.value; V.po.n = PAGE; renderPO(); }
      else if (t.id === 'posort') { V.po.sort = t.value; poRows(); }
      else if (t.id === 'sapFiles') { handleFiles(t.files); t.value = ''; }
      else if (t.hasAttribute('data-sapcl')) { S.sapPending[+t.getAttribute('data-sapcl')].res.client = t.value || null; }
      else if (t.hasAttribute('data-oatindak')) saveNote(t.getAttribute('data-oatindak'), t.value);
    });
    function saveNote(key, tindak) {
      var cur = ((S.D && S.D.oaNotes) || {})[key] || {};
      var ta = document.querySelector('[data-oanote="' + key + '"]');
      var rec = { tindak: tindak != null ? tindak : (cur.tindak || ''), catatan: ta ? ta.value.trim() : (cur.catatan || ''), by: ctx.me(), at: new Date().toISOString() };
      ctx.save(function (D) { D.oaNotes = D.oaNotes || {}; D.oaNotes[key] = rec; }, 'Tindak lanjut OA ' + key.replace(':', ' ') + ': ' + ctx.Model.TINDAK[rec.tindak]).then(function (ok) {
        if (ok) { ctx.toast('Tindak lanjut OA disimpan'); ctx.render(); }
      });
    }

    return {
      load: load, reset: reset, has: has, idx: idx, renderOA: renderOA, renderOADetail: renderOADetail, renderPO: renderPO, renderProgres: renderProgres,
      dashboard: dashboard, dueList: dueList, clientChips: function () { return clientChips(); }, oaTindakSelect: oaTindakSelect, clientBadge: clientBadge, uploadCard: uploadCard, clientName: clientName,
      lateCount: function () { return has() ? idx().pos.filter(function (x) { return x.late; }).length : 0; },
      workdays: workdays, V: V
    };
  }
  root.SapMod = SapMod;
})(this);

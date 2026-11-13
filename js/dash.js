/*
 * Dashboard — Analisa MIM: sorotan yang perlu tindakan, kontrak material (OA, PO/RO, progres),
 * serta kontrak Warehouse & GS.
 */
(function (root) {
  'use strict';
  // Warna status (tetap): biru = berjalan, teal = sebagian/aman, amber = perlu perhatian, merah = terlambat/kritis, abu = selesai
  var C = { blue: '#1d6fd6', teal: '#0f8a7a', amber: '#d97706', red: '#c81e1e', gray: '#a3b0c2' };
  var IC = {
    oa: '<path d="M9 12h6M9 16h6"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M14 3v5h5"/>',
    truck: '<path d="M2 16V7a1 1 0 0 1 1-1h11v10"/><path d="M14 9h4l4 4v3h-2"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M8.5 17.5h7M2 16h2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v5M12 17.5v.5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + IC[k] + '</svg>'; }

  function escH(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nfV = new Intl.NumberFormat('id-ID');
  // batang bertumpuk: [{label, n, color}] — celah 2px antar segmen, legenda berlabel + angka
  function stack(parts, unit) {
    var tot = parts.reduce(function (a, p) { return a + p.n; }, 0);
    if (!tot) return '<div class="muted small">Belum ada data</div>';
    return '<div class="st-bar">' + parts.filter(function (p) { return p.n; }).map(function (p) {
      return '<i style="flex:' + p.n + ';background:' + p.color + '" title="' + escH(p.label + ': ' + nfV.format(p.n) + ' ' + (unit || '') + ' (' + Math.round(p.n / tot * 100) + '%)') + '"></i>';
    }).join('') + '</div><div class="st-leg">' + parts.map(function (p) {
      return '<span' + (p.attr ? ' class="click' + (p.on ? ' on' : '') + '"' + p.attr : '') + '><i style="background:' + p.color + '"></i>' + escH(p.label) + ' <b>' + nfV.format(p.n) + '</b></span>';
    }).join('') + '</div>';
  }
  // batang mendatar: [{label(html), v, text, title, attr}]
  function hbars(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="hb">' + rows.map(function (r) {
      return '<div class="hb-row' + (r.attr ? ' click' : '') + '"' + (r.attr || '') + ' title="' + escH(r.title || '') + '"><span class="hb-l">' + r.label + '</span><div class="hb-t"><i style="width:' + Math.max(1.5, r.v / max * 100).toFixed(1) + '%' + (r.color ? ';background:' + r.color : '') + '"></i></div><span class="hb-v">' + escH(r.text) + '</span></div>';
    }).join('') + '</div>';
  }
  root.Viz = { stack: stack, hbars: hbars, C: C, svg: svg };

  function DashMod(ctx) {
    var S = ctx.S, esc = ctx.esc, Sap = ctx.Sap, Wh = ctx.Wh, nf0 = ctx.nf0;
    function big(v) { return ctx.fmtBig(v, 'IDR'); }
    var stack = root.Viz.stack, hbars = root.Viz.hbars;
    function attn(cls, icon, n, label, sub, href, go) {
      return '<a class="at at-' + cls + '" href="' + href + '"' + (go ? ' data-post-go="' + go + '"' : '') + '><span class="at-ic">' + svg(icon) + '</span><div><div class="at-n">' + n + '</div><div class="at-l">' + label + '</div><div class="at-s">' + sub + '</div></div><span class="at-go">→</span></a>';
    }
    function greet() { var h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }

    function render(view) {
      var st = ctx.settings(), t = ctx.Model.todayStr(), has = Sap.has(), I = has ? Sap.idx() : { oas: [], pos: [] };
      var notes = (S.D && S.D.oaNotes) || {};
      var oas = I.oas.filter(function (x) { return Sap.clientOk(x.c); }), pos = I.pos.filter(function (x) { return Sap.clientOk(x.c); });
      var oaAct = oas.filter(function (x) { return x.st !== 'expired'; });
      var oaSoon = oas.filter(function (x) { return x.st === 'warn' || x.st === 'crit'; }).sort(function (a, b) { return a.days - b.days; });
      var oaCritNo = oas.filter(function (x) { return x.st === 'crit' && !(notes[x.c + ':' + x.no] || {}).tindak; });
      var out = pos.filter(function (x) { return x.out > 0.5; }), late = pos.filter(function (x) { return x.late; });
      var lateNo = late.filter(function (x) { return !Sap.poNote(x.c, x.no); });
      var sum = function (l, f) { return l.reduce(function (a, x) { return a + Sap.idr(f(x), (x.p || x.o).cur); }, 0); };
      var wh = Wh.allRows().filter(function (x) { return !x.i.closed; }), pm = Wh.prevMonth();
      var whMiss = wh.filter(function (x) { return x.b.missing.length; }), whSoon = wh.filter(function (x) { return x.i.days != null && x.i.days <= st.warn; });
      var whVal = wh.reduce(function (a, x) { return a + x.i.value; }, 0), whReal = wh.reduce(function (a, x) { return a + x.i.real; }, 0);
      var src = (S.sap && S.sap.src) || {}, d1 = (src['me2n-100'] || src['me3n-100'] || src['me2n-180'] || {}).date, d2 = (src.progres || {}).date;
      var now = new Date(), HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

      // ---------- hero ----------
      var hs = function (n, l, s, href) { return '<a class="dh-stat" href="' + href + '"><b>' + n + '</b><span>' + l + '</span><small>' + s + '</small></a>'; };
      var hero = '<div class="dh"><div class="dh-l"><div class="dh-hi">' + greet() + ', ' + esc(String(ctx.me()).split('.')[0]) + '</div>' +
        '<div class="dh-sub">' + HARI[now.getDay()] + ', ' + now.getDate() + ' ' + ctx.BULAN[now.getMonth()] + ' ' + now.getFullYear() +
        (d1 ? ' · Data SAP ' + ctx.fmtDate(d1) : '') + (d2 ? ' · Progres ' + ctx.fmtDate(d2) : '') + '</div>' + (has ? Sap.clientChips() : '') + '</div>' +
        '<div class="dh-stats">' +
        hs(nf0.format(oaAct.length), 'OA berlaku', oaSoon.length + ' segera berakhir', '#/oa') +
        hs(nf0.format(out.length), 'PO/RO outstanding', 'sisa kirim ' + esc(big(sum(out, function (x) { return x.out; }))), '#/po') +
        hs(nf0.format(late.length), 'PO/RO terlambat', esc(big(sum(late, function (x) { return x.out; }))), '#/po') +
        hs(nf0.format(wh.length), 'Kontrak WH & GS', whVal ? ctx.pct(whReal / whVal * 100) + ' terserap' : 'berjalan', '#/wh') + '</div></div>';

      // ---------- perlu perhatian ----------
      var at = [];
      var nRo = ctx.Oa ? ctx.Oa.roList().filter(function (r) { return Sap.clientOk(r.c) && r.state === 'Menunggu approval MIM'; }) : [];
      if (nRo.length) at.push(attn('warn', 'oa', nRo.length, 'Permintaan RO menunggu approval MIM', esc(big(nRo.reduce(function (a, r) { return a + Sap.idr(r.nilai, r.cur); }, 0))) + ' · diproses MIM', '#/progres" data-prtab="ro'));
      if (oaCritNo.length) at.push(attn('bad', 'clock', oaCritNo.length, 'OA kritis tanpa rencana', 'berakhir ≤ ' + st.crit + ' hari, belum ada tindak lanjut', '#/jatuh-tempo'));
      if (lateNo.length) at.push(attn('bad', 'chat', lateNo.length, 'PO/RO terlambat belum di-update', 'belum ada status dari MIM', '#/po', 'noupd'));
      if (late.length) at.push(attn('warn', 'truck', late.length, 'PO/RO lewat delivery date', esc(big(sum(late, function (x) { return x.out; }))) + ' belum diterima', '#/po', 'late'));
      if (whMiss.length) at.push(attn('bad', 'bill', whMiss.length, 'Kontrak WH/GS tagihan tertinggal', 'tagihan s/d ' + Wh.ymLabel(pm, true) + ' belum lengkap', '#/' + (whMiss[0].k.kat === 'GS' && !whMiss.some(function (x) { return x.k.kat === 'Warehouse'; }) ? 'gs' : 'wh')));
      if (whSoon.length) at.push(attn('warn', 'alert', whSoon.length, 'Kontrak WH/GS segera berakhir', '≤ ' + st.warn + ' hari atau sudah lewat', '#/jatuh-tempo'));
      var attnHtml = '<div class="sec-h"><h3>Perlu perhatian</h3></div>' + (at.length ? '<div class="at-grid">' + at.join('') + '</div>'
        : '<div class="card card-pad at-ok"><span class="at-ic">' + svg('check') + '</span><div><b>Semua terkendali</b><div class="small muted">Tidak ada OA kritis tanpa rencana, PO/RO terlambat, atau tagihan yang tertinggal.</div></div></div>');

      // ---------- kontrak material ----------
      var mat = '';
      if (has) {
        var tg = sum(oaAct, function (x) { return x.o.tgt; }), rl = sum(oaAct, function (x) { return x.o.rel; });
        var months = [];
        for (var m = 0; m < 12; m++) { var d = new Date(now.getFullYear(), now.getMonth() + m, 1); months.push(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)); }
        var cnt = months.map(function (ym) { return oas.filter(function (x) { return x.o.ve && x.o.ve.slice(0, 7) === ym && x.days >= 0; }); });
        var mx = Math.max.apply(null, cnt.map(function (c) { return c.length; }).concat([1]));
        var cols = '<div class="bars dh-bars">' + cnt.map(function (c, i) {
          return '<a class="b' + (i < 3 ? ' soon' : '') + '" href="#/jatuh-tempo" style="height:' + Math.max(2, c.length / mx * 100) + '%" title="' + esc(ctx.BULAN[+months[i].slice(5) - 1] + ' ' + months[i].slice(0, 4) + ': ' + c.length + ' OA berakhir') + '">' + (c.length ? '<span class="t">' + c.length + '</span>' : '') + '</a>';
        }).join('') + '</div><div class="bar-labels">' + months.map(function (ym) { return '<span>' + ctx.BLN[+ym.slice(5) - 1] + '<br>' + ym.slice(2, 4) + '</span>'; }).join('') + '</div>';
        var oaCard = '<div class="card card-pad dc"><div class="dc-h"><span class="dc-ic">' + svg('oa') + '</span><div><b>Kontrak OA</b><div class="small muted">ME3N · ' + nf0.format(oas.length) + ' kontrak</div></div><a class="small" href="#/oa">Detail →</a></div>' +
          '<div class="dc-sub">Masa berlaku</div>' + stack([
            { label: 'Aman (> ' + st.warn + ' hr)', n: oas.filter(function (x) { return x.st === 'active'; }).length, color: C.blue },
            { label: 'Segera berakhir', n: oas.filter(function (x) { return x.st === 'warn'; }).length, color: C.amber },
            { label: 'Kritis (≤ ' + st.crit + ' hr)', n: oas.filter(function (x) { return x.st === 'crit'; }).length, color: C.red },
            { label: 'Berakhir', n: oas.filter(function (x) { return x.st === 'expired'; }).length, color: C.gray }], 'OA') +
          '<div class="dc-sub">Serapan nilai (released) <b>' + (tg ? ctx.pct(rl / tg * 100) : '—') + '</b></div>' + ctx.bar(tg ? rl / tg * 100 : null) +
          '<div class="small muted" style="margin-top:4px">' + esc(big(rl)) + ' dari target ' + esc(big(tg)) + ' (ekuivalen IDR)</div>' +
          '<div class="dc-sub">OA berakhir per bulan — 12 bulan ke depan</div>' + cols + '</div>';

        var byPl = {};
        out.forEach(function (x) { x.p.items.forEach(function (i) { if (i[7] > 0) { var k = i[9] || '-', y = byPl[k] = byPl[k] || { v: 0, d: {}, l: {} }; y.v += Sap.idr(i[7], x.p.cur); y.d[x.no] = 1; if (x.late) y.l[x.no] = 1; } }); });
        var pl = Object.keys(byPl).sort(function (a, b) { return byPl[b].v - byPl[a].v; }).slice(0, 6).map(function (k) {
          var y = byPl[k], nl = Object.keys(y.l).length;
          return { label: '<b>' + esc(k) + '</b> ' + esc(Sap.plantName(k)), v: y.v, text: big(y.v), title: Object.keys(y.d).length + ' dokumen' + (nl ? ', ' + nl + ' terlambat' : '') };
        });
        var n = function (s2) { return pos.filter(function (x) { return x.st === s2; }).length; };
        var poCard = '<div class="card card-pad dc"><div class="dc-h"><span class="dc-ic">' + svg('truck') + '</span><div><b>PO / RO</b><div class="small muted">ME2N · ' + nf0.format(pos.length) + ' dokumen · ' + esc(big(sum(pos, function (x) { return x.val; }))) + '</div></div><a class="small" href="#/po">Detail →</a></div>' +
          '<div class="dc-sub">Status pengiriman</div>' + stack([
            { label: 'Dalam pengiriman', n: n('open'), color: C.blue }, { label: 'Diterima sebagian', n: n('partial'), color: C.teal },
            { label: 'Terlambat', n: n('late'), color: C.red }, { label: 'Diterima · belum ditagih', n: n('inv'), color: C.amber }, { label: 'Selesai', n: n('done'), color: C.gray }], 'dokumen') +
          '<div class="dc-sub">Sisa kirim per plant (terbesar)</div>' + (pl.length ? hbars(pl) : '<div class="muted small">Tidak ada outstanding</div>') + '</div>';

        var pr = S.sap.pr ? Sap.prRows().filter(function (r) { return Sap.wkOk(r.wk) && r.stt !== 'Batal'; }) : [], ex = S.sap.pr ? Sap.exRows().filter(function (r) { return Sap.wkOk(r.wk); }) : [];
        var c2 = function (l, f) { return l.filter(f).length; };
        var prCard = S.sap.pr ? '<div class="card card-pad dc"><div class="dc-h"><span class="dc-ic">' + svg('clock') + '</span><div><b>Progres PR &amp; PO</b><div class="small muted">' + pr.length + ' rencana pengadaan · ' + ex.length + ' PO/RO di-expedite</div></div><a class="small" href="#/progres">Detail →</a></div>' +
          '<div class="dc-sub">Pengadaan (PR)</div>' + stack([
            { label: 'On Progress', n: c2(pr, function (r) { return r.stt === 'On Progress'; }), color: C.blue }, { label: 'On Planning', n: c2(pr, function (r) { return r.stt === 'On Planning'; }), color: C.amber },
            { label: 'Pipeline / belum PR', n: c2(pr, function (r) { return /Pipeline|Belum ada/.test(r.stt); }), color: C.gray }], 'paket') +
          '<div class="dc-sub">Expediting (PO / RO)</div>' + stack([
            { label: 'On delivery', n: c2(ex, function (r) { return /on delivery/i.test(r.stt); }), color: C.blue }, { label: 'Sudah diterima (SAP)', n: c2(ex, function (r) { return /SAP/.test(r.stt); }), color: C.teal },
            { label: 'Terlambat', n: c2(ex, function (r) { return r.late; }), color: C.red }, { label: 'Routing approval', n: c2(ex, function (r) { return /Routing/.test(r.stt); }), color: C.amber }], 'PO/RO') +
          '<div class="dc-sub">Lead time PR terlama</div>' + hbars(pr.filter(function (r) { return r.lt != null; }).sort(function (a, b) { return b.lt - a.lt; }).slice(0, 4).map(function (r) { return { label: esc(r.desc), v: r.lt, text: r.lt + ' HK', title: (r.note || '') + ' · ' + (r.pic || '') }; })) + '</div>' : '';
        mat = '<div class="sec-h"><h3>Kontrak Material</h3><span class="small muted">Kurs USD ' + nf0.format(Sap.kurs()) + '</span></div><div class="dc-grid">' + oaCard + poCard + prCard + '</div>';

        // tabel
        var oaT = oaSoon.slice(0, 7).map(function (x) {
          var nt = notes[x.c + ':' + x.no];
          return '<tr class="clickable" data-oa="' + esc(x.c + '/' + x.no) + '"><td>' + Sap.clientBadge(x.c) + ' <span class="mono">' + esc(x.no) + '</span></td><td><div class="mat-desc">' + esc(x.o.vendor) + '</div><div class="small muted">' + esc(x.cat) + '</div></td><td class="nowrap">' + ctx.fmtDate(x.o.ve) + '<div>' + Sap.daysBadge(x.days) + '</div></td><td>' + (nt && nt.tindak ? '<span class="badge ro">' + esc(ctx.Model.TINDAK[nt.tindak]) + '</span>' : '<span class="badge warn">Belum ada rencana</span>') + '</td></tr>';
        }).join('');
        var poT = late.slice().sort(function (a, b) { return Sap.idr(b.out, b.p.cur) - Sap.idr(a.out, a.p.cur); }).slice(0, 7).map(function (x) {
          var nt = Sap.poNote(x.c, x.no);
          return '<tr class="clickable" data-po="' + esc(x.c + '/' + x.no) + '"><td>' + Sap.clientBadge(x.c) + ' <span class="mono">' + esc(x.no) + '</span></td><td><div class="mat-desc">' + esc(x.p.vendor) + '</div><div class="small muted">' + esc((x.p.items[0] || [])[2] || '') + '</div></td><td class="nowrap"><b>' + esc(ctx.fmtBig(x.out, x.p.cur)) + '</b><div><span class="badge bad">lewat ' + nf0.format(-x.days) + ' hr</span></div></td><td>' + (nt ? '<span class="badge ro">' + esc(nt.st || 'Ada catatan') + '</span>' + (nt.eta ? '<div class="small muted">ETA ' + ctx.fmtDate(nt.eta) + '</div>' : '') : '<span class="badge warn">Belum di-update</span>') + '</td></tr>';
        }).join('');
        mat += '<div class="mk-dash2" style="margin:16px 0">' +
          '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">OA segera berakhir</h3><span class="badge ' + (oaSoon.length ? 'warn' : 'ok') + '">' + oaSoon.length + '</span><span class="spacer"></span><a class="small" href="#/jatuh-tempo">Semua →</a></div>' +
          (oaT ? '<div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>No. OA</th><th>Vendor</th><th>Berakhir</th><th>Tindak lanjut</th></tr></thead><tbody>' + oaT + '</tbody></table></div>' : '<p class="muted small" style="margin:0">Tidak ada OA yang berakhir ≤ ' + st.warn + ' hari.</p>') + '</div>' +
          '<div class="card card-pad"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">PO / RO terlambat — nilai terbesar</h3><span class="badge ' + (late.length ? 'bad' : 'ok') + '">' + late.length + '</span><span class="spacer"></span><a class="small" href="#/po" data-post-go="late">Semua →</a></div>' +
          (poT ? '<div class="table-wrap" style="box-shadow:none"><table class="grid"><thead><tr><th>No. PO/RO</th><th>Vendor / material</th><th>Sisa kirim</th><th>Update MIM</th></tr></thead><tbody>' + poT + '</tbody></table></div>' : '<p class="muted small" style="margin:0">Tidak ada PO/RO terlambat.</p>') + '</div></div>';
      } else {
        mat = '<div class="card card-pad" style="margin:16px 0"><b>Kontrak Material belum ada data.</b> ' + (ctx.canWrite() ? 'Upload export SAP ME3N & ME2N serta file Progres PR/RO di <a href="#/import">Upload Data</a>.' : '') + '</div>';
      }

      // ---------- warehouse & GS ----------
      var whHtml = '<div class="sec-h"><h3>Kontrak Warehouse &amp; GS</h3><a class="small" href="#/wh">Warehouse →</a><a class="small" href="#/gs">GS →</a></div>';
      if (wh.length) {
        var rowsH = wh.slice().sort(function (a, b) { return (b.b.missing.length - a.b.missing.length) || ((a.i.days == null ? 1e9 : a.i.days) - (b.i.days == null ? 1e9 : b.i.days)); }).map(function (x) {
          var i = x.i, k = x.k;
          return '<tr class="clickable" data-open="' + esc(k.id) + '"><td><div class="wh-mini"><span class="wh-ico sm">' + Wh.iconFor(k) + '</span><div><b>' + esc(Wh.title(k)) + '</b><div class="small muted">' + esc(k.kat) + (k.field ? ' · ' + esc(k.field) : '') + ' · ' + esc(k.vendor || '') + '</div></div></div></td>' +
            '<td class="num nowrap"><b>' + esc(ctx.fmtBig(i.value, k.cur)) + '</b><div class="small muted">sisa ' + esc(ctx.fmtBig(i.sisa, k.cur)) + '</div></td>' +
            '<td style="min-width:130px">' + ctx.bar(i.realPct, ctx.absorbCls(i.realPct)) + '<div class="small muted">' + ctx.pct(i.realPct) + ' terserap</div></td>' +
            '<td class="nowrap">' + Wh.dB(i) + '<div class="small muted">' + ctx.fmtDate(i.end) + '</div></td>' +
            '<td>' + (x.b.missing.length ? '<span class="badge bad">' + x.b.missing.length + ' bln belum ditagih</span>' : x.b.last ? '<span class="badge ok">s/d ' + Wh.ymLabel(x.b.last) + '</span>' : '<span class="muted small">—</span>') + '</td></tr>';
        }).join('');
        whHtml += '<div class="card card-pad"><div class="table-wrap" style="box-shadow:none;max-height:520px"><table class="grid"><thead><tr><th>Kontrak</th><th class="num">Nilai</th><th>Serapan</th><th>Masa berlaku</th><th>Tagihan</th></tr></thead><tbody>' + rowsH + '</tbody></table></div></div>';
      } else {
        whHtml += '<div class="card card-pad small muted">Belum ada kontrak Warehouse / GS. ' + (ctx.canWrite() ? '<a href="#/baru/Warehouse">Tambah kontrak</a>.' : '') + '</div>';
      }
      view.innerHTML = '<div class="sap-dash">' + hero + attnHtml + mat + whHtml + '</div>';
    }

    document.addEventListener('click', function (e) {
      var b = e.target.closest('.st-leg [data-go]');
      if (b) location.hash = b.getAttribute('data-go');
    });
    return { render: render };
  }
  root.DashMod = DashMod;
})(this);

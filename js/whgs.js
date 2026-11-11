/*
 * Kontrak Warehouse & GS (per Field): ringkasan, kartu kontrak, matriks tagihan bulanan.
 * Datanya = daftar kontrak (data/kontrak.js) dengan k.kat = 'Warehouse' | 'GS' dan k.field.
 * Realisasi dicatat per bulan (periode YYYY-MM) + PR / RO / SA / invoice.
 */
(function (root) {
  'use strict';
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var ICONS = {
    crane: '<path d="M4 20h16M7 20V6l10-2v4M7 9l10-1M17 8v5"/><path d="M15.5 13h3v3h-3z"/>',
    truck: '<path d="M2 16V7a1 1 0 0 1 1-1h11v10"/><path d="M14 9h4l4 4v3h-2"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M8.5 17.5h7M2 16h2.5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v2H3z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/><path d="M5 11h14"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10M10 20v-6h4v6"/>',
    bolt: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>',
    leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 14"/><path d="M5 19c3-5 6-8 10-10"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'
  };
  function iconFor(k) {
    var t = ((k.short || '') + ' ' + (k.judul || '')).toUpperCase();
    var key = /CRANE/.test(t) ? 'crane' : /VACUUM|TRAILER|TRAILLER|TRONTON|TRUCK|HTE|PICKER/.test(t) ? 'truck' : /ISSUING|RECEIVING|GUDANG/.test(t) ? 'box'
      : /KRP|KENDARAAN|MOTOR|VEHICLE|VTS/.test(t) ? 'car' : /LISTRIK|AC |REFRIGERATOR/.test(t) ? 'bolt' : /RUMPUT|PEMBABATAN|SAMPAH|CLEANING/.test(t) ? 'leaf' : /SIPIL|GENERAL SERVICE|PELAYANAN/.test(t) ? 'home' : 'doc';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[key] + '</svg>';
  }

  function WhMod(ctx) {
    var S = ctx.S, esc = ctx.esc, ICON = ctx.ICON, $ = function (s) { return document.querySelector(s); };
    var W = { field: ctx.Store.load('whField', ''), q: '', st: 'open' };

    function ymAdd(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); }
    function prevMonth() { return ymAdd(ctx.Model.todayStr().slice(0, 7), -1); }
    function ymLabel(ym, long) { return ym ? (long ? ctx.BULAN[+ym.slice(5, 7) - 1] : BLN[+ym.slice(5, 7) - 1]) + ' ' + (long ? ym.slice(0, 4) : ym.slice(2, 4)) : '—'; }
    function title(k) { return k.short || k.judul || k.no; }
    function isKat(k, kat) { return kat === 'other' ? !k.kat : k.kat === kat; }

    // Status tagihan bulanan satu kontrak
    function billing(i) {
      var k = i.k, list = k.realisasi || [], per = {}, last = '', hasPer = false;
      list.forEach(function (r) { if (r.periode) { hasPer = true; per[r.periode] = (per[r.periode] || 0) + (+r.nilai || 0); if (r.periode > last) last = r.periode; } });
      var missing = [];
      if (!i.closed && (hasPer || !list.length) && k.mulai && i.end) {
        var to = prevMonth(), endM = i.end.slice(0, 7);
        if (endM < to) to = endM;
        var from = last ? ymAdd(last, 1) : k.mulai.slice(0, 7);
        // bulan pertama yang hanya beberapa hari (mulai ≥ tgl 25) tidak dihitung
        if (!last && +k.mulai.slice(8, 10) >= 25) from = ymAdd(from, 1);
        for (var m = from, n = 0; m <= to && n < 60; m = ymAdd(m, 1), n++) missing.push(m);
      }
      return { per: per, last: last, lastVal: last ? per[last] : null, missing: missing, known: hasPer || !list.length };
    }
    function rows(kat) {
      return ctx.infos().filter(function (i) { return isKat(i.k, kat); }).map(function (i) { return { i: i, k: i.k, b: billing(i) }; });
    }
    function allRows() { return ctx.infos().filter(function (i) { return i.k.kat === 'Warehouse' || i.k.kat === 'GS'; }).map(function (i) { return { i: i, k: i.k, b: billing(i) }; }); }
    function fields(list) { var f = {}; list.forEach(function (x) { if (x.k.field) f[x.k.field] = 1; }); return Object.keys(f).sort(); }
    function missText(b) {
      if (!b.missing.length) return '';
      var a = b.missing[0], z = b.missing[b.missing.length - 1];
      return b.missing.length + ' bulan belum ditagih (' + (a === z ? ymLabel(a) : ymLabel(a) + ' – ' + ymLabel(z)) + ')';
    }
    function dB(i) {
      var s = ctx.settings();
      if (i.closed) return '<span class="badge">' + esc(ctx.Model.TINDAK[i.k.tindak] || 'Ditutup') + '</span>';
      if (i.days == null) return '';
      if (i.days < 0) return '<span class="badge bad">Berakhir ' + ctx.nf0.format(-i.days) + ' hr lalu</span>';
      return '<span class="badge ' + (i.days <= s.crit ? 'bad' : i.days <= s.warn ? 'warn' : 'ok') + '">' + ctx.nf0.format(i.days) + ' hari lagi</span>';
    }
    function short(n) {
      var a = Math.abs(n);
      return a >= 1e9 ? ctx.nf2.format(n / 1e9) + ' M' : a >= 1e6 ? ctx.nf0.format(n / 1e6) + ' jt' : ctx.nf0.format(n);
    }

    function lastEdit(k) {
      var at = k.editedAt || k.createdAt || '', by = k.editedBy || k.createdBy || '';
      (k.realisasi || []).forEach(function (r) { if (r.at && r.at > at) { at = r.at; by = r.by; } });
      return at ? 'Diubah ' + esc(by || '') + ' · ' + ctx.fmtDate(at.slice(0, 10)) : '';
    }
    function card(x) {
      var i = x.i, k = x.k, b = x.b, w = ctx.canWrite(), cls = ctx.absorbCls(i.realPct);
      return '<div class="wh-card' + (b.missing.length ? ' miss' : '') + '" data-k="' + esc(k.id) + '">' +
        '<div class="wh-top"><span class="wh-ico">' + iconFor(k) + '</span><div style="min-width:0;flex:1"><b class="wh-title">' + esc(title(k)) + '</b><div class="small muted"><span class="mono">' + esc(k.no) + '</span>' + (k.field ? ' · Field ' + esc(k.field) : '') + '</div></div>' + dB(i) + '</div>' +
        '<div class="small muted wh-vendor" title="' + esc(k.judul || '') + '">' + esc(k.vendor || '—') + '</div>' +
        '<div class="wh-nums"><div><span>Nilai kontrak</span><b>' + esc(ctx.fmtBig(i.value, k.cur)) + '</b></div><div><span>Realisasi</span><b>' + esc(ctx.fmtBig(i.real, k.cur)) + '</b></div><div><span>Sisa</span><b' + (i.sisa < 0 ? ' style="color:var(--bad)"' : '') + '>' + esc(ctx.fmtBig(i.sisa, k.cur)) + '</b></div></div>' +
        ctx.bar(i.realPct, cls, 'Terserap ' + ctx.pct(i.realPct)) + '<div class="wh-meta small muted"><span>' + ctx.pct(i.realPct) + ' nilai terserap</span><span>' + ctx.pct(i.timePct) + ' waktu berjalan</span></div>' +
        '<div class="wh-foot"><div class="small">' + (b.last ? 'Tagihan terakhir <b>' + ymLabel(b.last, true) + '</b> · ' + esc(ctx.fmtBig(b.lastVal, k.cur)) : (k.realisasi || []).length ? (k.realisasi.length + ' tagihan tercatat') : 'Belum ada tagihan') +
        (b.missing.length ? '<div><span class="badge bad">' + esc(missText(b)) + '</span></div>' : b.known && !i.closed && i.days >= 0 ? '<div><span class="badge ok">Tagihan s/d ' + ymLabel(prevMonth()) + ' lengkap</span></div>' : '') +
        '<div class="small muted" style="margin-top:4px">' + lastEdit(k) + '</div></div>' +
        (w && !i.closed ? '<button class="btn sm primary" data-act="add-real" data-id="' + esc(k.id) + '">' + ICON.plus + ' Input tagihan</button>' : '') + '</div></div>';
    }

    function matrix(list) {
      var end = prevMonth(), months = [];
      for (var n = 11; n >= 0; n--) months.push(ymAdd(end, -n));
      var tot = months.map(function () { return 0; });
      var body = list.map(function (x) {
        var k = x.k, i = x.i, a = (k.mulai || '').slice(0, 7), z = (i.end || '').slice(0, 7);
        return '<tr class="clickable" data-open="' + esc(k.id) + '"><td class="mx-name"><b>' + esc(title(k)) + '</b><div class="small muted">' + esc(k.vendor || '') + '</div></td>' + months.map(function (m, j) {
          var v = x.b.per[m];
          if (v) { tot[j] += (k.cur || 'IDR') === 'IDR' ? v : 0; return '<td class="num mx" title="' + esc(ymLabel(m, true) + ': ' + ctx.fmtMoney(v, k.cur)) + '">' + short(v) + '</td>'; }
          if (!x.b.known || i.closed || !a || m < a || (z && m > z)) return '<td class="num mx off">·</td>';
          return '<td class="num mx miss" title="Tagihan ' + esc(ymLabel(m, true)) + ' belum diinput">belum</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<div class="card card-pad" style="margin-top:16px"><div class="toolbar" style="margin-bottom:10px"><h3 class="section-title" style="margin:0">Tagihan per bulan — 12 bulan terakhir</h3><span class="spacer"></span><span class="small muted">nilai tanpa PPN · <span class="mx-leg">belum</span> = tagihan belum diinput</span></div>' +
        '<div class="table-wrap" style="box-shadow:none"><table class="grid mx-table"><thead><tr><th>Kontrak</th>' + months.map(function (m) { return '<th class="num">' + ymLabel(m) + '</th>'; }).join('') + '</tr></thead><tbody>' + body +
        '<tr class="total"><td>Total (IDR)</td>' + tot.map(function (v) { return '<td class="num mx">' + (v ? short(v) : '—') + '</td>'; }).join('') + '</tr></tbody></table></div></div>';
    }

    function renderPage(kat) {
      var view = $('#view'), w = ctx.canWrite(), all = rows(kat), label = kat === 'GS' ? 'GS' : kat === 'Warehouse' ? 'Warehouse' : 'lainnya';
      $('#pageActions').innerHTML = '<button class="btn" data-act="wh-export" data-kat="' + kat + '">' + ICON.excel + ' Export Excel</button>' + (w ? '<a class="btn primary" href="#/baru/' + (kat === 'other' ? '' : kat) + '">' + ICON.plus + ' Tambah Kontrak</a>' : '');
      if (!all.length) {
        view.innerHTML = '<div class="card empty"><div class="ico">' + ICON.doc + '</div><h3>Belum ada kontrak ' + esc(label) + '</h3><p>' + (w ? 'Tambahkan kontrak, lalu catat tagihan tiap bulan di halaman detailnya.' : 'Owner / Writer belum memasukkan data.') + '</p>' + (w ? '<a class="btn primary" href="#/baru/' + kat + '">' + ICON.plus + ' Tambah Kontrak</a>' : '') + '</div>';
        return;
      }
      var fl = fields(all);
      if (W.field && fl.indexOf(W.field) < 0) W.field = '';
      var q = W.q.trim().toLowerCase();
      var list = all.filter(function (x) {
        if (W.field && x.k.field !== W.field) return false;
        if (W.st === 'open' && x.i.closed) return false;
        if (q && [x.k.no, x.k.judul, x.k.short, x.k.vendor].join(' ').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      list.sort(function (a, b) { return (b.b.missing.length - a.b.missing.length) || ((a.i.days == null ? 1e9 : a.i.days) - (b.i.days == null ? 1e9 : b.i.days)); });
      var run = list.filter(function (x) { return !x.i.closed && !(x.i.days < 0); });
      var idr = list.filter(function (x) { return (x.k.cur || 'IDR') === 'IDR' && !x.i.closed; });
      var val = idr.reduce(function (a, x) { return a + x.i.value; }, 0), real = idr.reduce(function (a, x) { return a + x.i.real; }, 0);
      var miss = list.filter(function (x) { return x.b.missing.length; }), pm = prevMonth();
      var missPm = list.filter(function (x) { return x.b.missing.indexOf(pm) >= 0; });
      var soon = list.filter(function (x) { return !x.i.closed && x.i.days != null && x.i.days <= ctx.settings().warn; });
      function kpi(l, v, s, cls) { return '<div class="kpi' + (cls ? ' kpi-' + cls : '') + '"><div class="k">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + '</div></div>'; }
      view.innerHTML =
        '<div class="toolbar" style="margin-bottom:12px"><div class="cl-switch"><button class="cl-opt' + (!W.field ? ' on' : '') + '" data-whfield="">Semua field</button>' + fl.map(function (f) { return '<button class="cl-opt' + (W.field === f ? ' on' : '') + '" data-whfield="' + esc(f) + '">Field ' + esc(f) + '</button>'; }).join('') + '</div>' +
        '<span class="spacer"></span><input class="input" id="whq" placeholder="Cari kontrak / vendor…" value="' + esc(W.q) + '" style="min-width:200px">' +
        '<span class="chip-toggle' + (W.st === 'all' ? ' on' : '') + '" data-whst>Tampilkan yang sudah ditutup</span></div>' +
        (missPm.length ? '<div class="card card-pad wh-alert"><div><b>Tagihan ' + ymLabel(pm, true) + ' belum diinput untuk ' + missPm.length + ' kontrak</b><div class="small muted">' + missPm.map(function (x) { return esc(title(x.k)); }).join(' · ') + '</div></div></div>' : '') +
        '<div class="kpis" style="margin-bottom:14px">' +
        kpi('Kontrak berjalan', String(run.length), list.length + ' kontrak ' + esc(label) + (W.field ? ' · Field ' + esc(W.field) : '')) +
        kpi('Nilai kontrak', esc(ctx.fmtBig(val)), 'setelah amandemen') +
        kpi('Realisasi', esc(ctx.fmtBig(real)), ctx.bar(val ? real / val * 100 : null) + '<span style="display:block;margin-top:4px">' + (val ? ctx.pct(real / val * 100) : '—') + ' terserap · sisa ' + esc(ctx.fmtBig(val - real)) + '</span>') +
        kpi('Tagihan tertinggal', String(miss.length), miss.length ? 'kontrak dengan bulan belum ditagih' : 'semua tagihan lengkap', miss.length ? 'bad' : 'ok') +
        kpi('Segera berakhir', String(soon.length), '≤ ' + ctx.settings().warn + ' hari / sudah lewat', soon.length ? 'warn' : '') + '</div>' +
        (list.length ? '<div class="wh-grid">' + list.map(card).join('') + '</div>' + matrix(list) : '<div class="card empty"><h3>Tidak ada kontrak yang cocok</h3></div>');
    }

    async function exportX(kat) {
      ctx.loading('Menyiapkan Excel…');
      try {
        await ctx.loadXLSX();
        var list = rows(kat).filter(function (x) { return !W.field || x.k.field === W.field; });
        var a = list.map(function (x) {
          var k = x.k, i = x.i;
          return { Kategori: k.kat || '', Field: k.field || '', 'No. Kontrak': k.no, Nama: title(k), 'Judul Pekerjaan': k.judul || '', Vendor: k.vendor || '', Mulai: k.mulai || '', 'Berakhir (efektif)': i.end || '', 'Sisa Hari': i.days,
            'Nilai Kontrak': i.value, Realisasi: i.real, 'Serapan %': i.realPct == null ? '' : Math.round(i.realPct * 10) / 10, 'Sisa Nilai': i.sisa, 'Tagihan Terakhir': x.b.last || '', 'Bulan Belum Ditagih': x.b.missing.join(', '), 'Tindak Lanjut': ctx.Model.TINDAK[k.tindak || ''] };
        });
        var t = [];
        list.forEach(function (x) {
          var cum = 0;
          (x.k.realisasi || []).slice().sort(function (p, q) { return (p.periode || p.tgl || '').localeCompare(q.periode || q.tgl || ''); }).forEach(function (r) {
            cum += +r.nilai || 0;
            t.push({ 'No. Kontrak': x.k.no, Nama: title(x.k), Periode: r.periode || '', 'Pelaksanaan Mulai': r.mulai || '', 'Pelaksanaan Selesai': r.selesai || '', PR: r.pr || '', RO: r.ro || '', SA: r.sa || '', 'No. Invoice': r.ref || '', 'Tgl Invoice': r.invTgl || '',
              'Nilai (tanpa PPN)': +r.nilai || 0, Kumulatif: cum, 'Kumulatif %': x.i.value ? Math.round(cum / x.i.value * 1000) / 10 : '', Keterangan: r.uraian || '', 'Diinput oleh': r.by || '' });
          });
        });
        var wb = XLSX.utils.book_new(), add = function (rws, name) { var ws = XLSX.utils.json_to_sheet(rws.length ? rws : [{ '-': 'tidak ada data' }]); ws['!cols'] = Object.keys(rws[0] || { a: 1 }).map(function (h) { return { wch: Math.min(40, Math.max(11, h.length + 2)) }; }); XLSX.utils.book_append_sheet(wb, ws, name); };
        add(a, 'Kontrak'); add(t, 'Tagihan');
        XLSX.writeFile(wb, 'Kontrak-' + (kat === 'other' ? 'Lainnya' : kat) + (W.field ? '-' + W.field : '') + '-' + ctx.Model.todayStr() + '.xlsx');
      } catch (e) { ctx.toast('Gagal export: ' + e.message, true); }
      finally { ctx.loading(false); }
    }

    document.addEventListener('click', function (e) {
      var t = e.target, b;
      if ((b = t.closest('[data-whfield]'))) { W.field = b.getAttribute('data-whfield'); ctx.Store.save('whField', W.field); ctx.render(); return; }
      if ((b = t.closest('[data-whst]'))) { W.st = W.st === 'all' ? 'open' : 'all'; ctx.render(); return; }
      if ((b = t.closest('[data-act="wh-export"]'))) { exportX(b.getAttribute('data-kat')); return; }
      if ((b = t.closest('.wh-card')) && !t.closest('button,a')) location.hash = '#/kontrak/' + b.getAttribute('data-k');
    });
    var tm;
    document.addEventListener('input', function (e) {
      if (e.target.id !== 'whq') return;
      W.q = e.target.value; clearTimeout(tm);
      tm = setTimeout(function () { ctx.render(); var i = document.getElementById('whq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300);
    });

    return { renderPage: renderPage, rows: rows, allRows: allRows, billing: billing, prevMonth: prevMonth, ymLabel: ymLabel, title: title, iconFor: iconFor, missText: missText, dB: dB };
  }
  root.WhMod = WhMod;
})(this);

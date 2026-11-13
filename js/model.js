/*
 * Model kontrak: status, sisa waktu, serapan nilai, peringatan & agregasi ME3N.
 */
(function (root) {
  'use strict';

  var JENIS = ['OA (Outline Agreement)', 'Kontrak Jasa', 'Kontrak Barang', 'Kontrak Sewa', 'PO / RO', 'SPK', 'Lainnya'];
  var FUNGSI = ['SCM - Warehouse & Distribution', 'SCM - Procurement', 'Operation', 'Workover / Well Service', 'Production Engineering', 'RAM', 'HSSE', 'Finance', 'Lainnya'];
  var TINDAK = {
    '': 'Belum ditentukan',
    amandemen: 'Proses amandemen / perpanjangan',
    tender: 'Proses pengadaan ulang (kontrak baru)',
    tidak: 'Tidak diperpanjang',
    selesai: 'Selesai / ditutup',
    terminasi: 'Terminasi'
  };
  var FIELD = ['Rantau', 'Pangkalan Susu', 'Lirik', 'Jambi'];
  var DEFAULT_SETTINGS = { warn: 90, crit: 30, absorbWarn: 90, jenis: JENIS, fungsi: FUNGSI, field: FIELD, warehouseUrl: '', kurs: 16000, cover: 3, lead: 1, clients: { '100': 'Pertamina EP', '180': 'PHE' } };

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dayDiff(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000); }
  function num(v) { var n = +v; return isFinite(n) ? n : 0; }

  function emptyData() {
    return { v: 1, list: [], audit: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), updatedAt: new Date().toISOString(), updatedBy: '' };
  }
  function settingsOf(D) {
    var s = Object.assign({}, DEFAULT_SETTINGS, (D && D.settings) || {});
    if (!s.jenis || !s.jenis.length) s.jenis = JENIS;
    if (!s.fungsi || !s.fungsi.length) s.fungsi = FUNGSI;
    if (!s.field || !s.field.length) s.field = FIELD;
    return s;
  }

  // Nilai & tanggal efektif setelah amandemen
  function effective(k) {
    var end = k.akhir || '', val = num(k.nilai), am = (k.amandemen || []).slice().sort(function (a, b) { return (a.tgl || '').localeCompare(b.tgl || ''); });
    am.forEach(function (a) {
      if (a.akhir && a.akhir > end) end = a.akhir;
      if (a.nilai != null && a.nilai !== '' && num(a.nilai) > 0) val = num(a.nilai);
    });
    return { end: end, value: val };
  }
  function realisasi(k) {
    var list = k.realisasi || [];
    if (list.length) return { total: list.reduce(function (a, r) { return a + num(r.nilai); }, 0), src: 'manual' };
    if (k.sap && k.sap.rel != null) return { total: num(k.sap.rel), src: 'sap' };
    return { total: 0, src: 'none' };
  }

  var ST = {
    closed: { label: 'Ditutup', cls: '' },
    soon: { label: 'Belum mulai', cls: 'ro' },
    expired: { label: 'Berakhir', cls: 'bad' },
    crit: { label: 'Kritis', cls: 'bad' },
    warn: { label: 'Segera berakhir', cls: 'warn' },
    active: { label: 'Aktif', cls: 'ok' }
  };

  // Ringkasan lengkap 1 kontrak (dipakai di semua halaman)
  function info(k, settings, today) {
    today = today || todayStr();
    settings = settings || DEFAULT_SETTINGS;
    var ef = effective(k), re = realisasi(k);
    var days = ef.end ? dayDiff(today, ef.end) : null;
    var dur = k.mulai && ef.end ? dayDiff(k.mulai, ef.end) : null;
    var timePct = dur > 0 ? Math.max(0, Math.min(100, dayDiff(k.mulai, today) / dur * 100)) : null;
    var realPct = ef.value > 0 ? re.total / ef.value * 100 : null;
    var closed = k.tindak === 'selesai' || k.tindak === 'terminasi';
    var st = closed ? 'closed'
      : k.mulai && today < k.mulai ? 'soon'
      : days == null ? 'active'
      : days < 0 ? 'expired'
      : days <= settings.crit ? 'crit'
      : days <= settings.warn ? 'warn' : 'active';
    var flags = [];
    if (!closed) {
      if ((st === 'crit' || st === 'warn' || st === 'expired') && !k.tindak) flags.push({ cls: 'bad', t: 'Belum ada rencana tindak lanjut' });
      if (st === 'expired') flags.push({ cls: 'bad', t: 'Masa berlaku sudah lewat — tutup atau amandemen' });
      if (realPct != null && realPct >= settings.absorbWarn) flags.push({ cls: realPct >= 100 ? 'bad' : 'warn', t: 'Nilai terserap ' + Math.round(realPct) + '%' });
      if (realPct != null && timePct != null && timePct >= 50 && timePct - realPct >= 40) flags.push({ cls: 'warn', t: 'Serapan rendah (' + Math.round(realPct) + '% nilai vs ' + Math.round(timePct) + '% waktu)' });
      var j = k.jaminan || {};
      if (j.akhir) {
        if (j.akhir < today) flags.push({ cls: 'bad', t: 'Jaminan pelaksanaan sudah berakhir' });
        else if (ef.end && j.akhir < ef.end) flags.push({ cls: 'warn', t: 'Jaminan berakhir sebelum kontrak (' + j.akhir + ')' });
      }
    }
    return {
      k: k, end: ef.end, value: ef.value, real: re.total, realSrc: re.src, sisa: ef.value - re.total,
      days: days, timePct: timePct, realPct: realPct, st: st, stLabel: ST[st].label, stCls: ST[st].cls,
      closed: closed, flags: flags, amCount: (k.amandemen || []).length
    };
  }

  // Kata dominan deskripsi material -> judul OA dari ME3N, mis. "VALVE & FLANGE"
  function category(lines) {
    var cnt = {};
    lines.forEach(function (l) {
      var w = String(l.d || '').toUpperCase().split(/[\s,:;]+/)[0];
      if (w && w.length > 2) cnt[w] = (cnt[w] || 0) + 1;
    });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 3).join(', ');
  }

  // Baris ME3N (parser / data Warehouse) -> satu entri per nomor OA
  function aggregateME3N(rows) {
    var map = {};
    (rows || []).forEach(function (l) {
      if (!l.po) return;
      var h = map[l.po];
      if (!h) h = map[l.po] = { no: l.po, vendor: l.vendor || '', vendorCode: l.vendorCode || '', pg: l.pg || '', vs: l.vs || '', ve: l.ve || '', cur: l.cur || 'IDR', tgtHdr: l.tgtHdr, totalOpen: l.totalOpen, docDate: l.docDate || '', lines: [] };
      if (l.vs && (!h.vs || l.vs < h.vs)) h.vs = l.vs;
      if (l.ve && (!h.ve || l.ve > h.ve)) h.ve = l.ve;
      if (h.tgtHdr == null && l.tgtHdr != null) h.tgtHdr = l.tgtHdr;
      if (h.totalOpen == null && l.totalOpen != null) h.totalOpen = l.totalOpen;
      h.lines.push(l);
    });
    return Object.keys(map).map(function (po) {
      var h = map[po];
      var rel = h.tgtHdr != null && h.totalOpen != null ? Math.max(0, h.tgtHdr - h.totalOpen) : null;
      return { no: h.no, vendor: h.vendor, vendorCode: h.vendorCode, pg: h.pg, mulai: h.vs || h.docDate, akhir: h.ve, cur: h.cur,
        nilai: h.tgtHdr, open: h.totalOpen, rel: rel, items: h.lines.length, cat: category(h.lines) };
    });
  }

  root.Model = {
    JENIS: JENIS, FUNGSI: FUNGSI, TINDAK: TINDAK, ST: ST, DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    todayStr: todayStr, dayDiff: dayDiff, emptyData: emptyData, settingsOf: settingsOf,
    effective: effective, realisasi: realisasi, info: info, aggregateME3N: aggregateME3N, category: category
  };
})(this);

/*
 * Parser data SAP & progres pengadaan untuk halaman Monitoring SAP.
 * - ME3N (Outline Agreement / kontrak)    -> daftar OA per client + item
 * - ME2N (PO / RO)                         -> daftar PO/RO per client + item
 * - Progres PR/RO (sheet Pengadaan & Expediting)
 * Jenis file & client (100 / 180) dideteksi otomatis dari judul kolom & nama file.
 * Dipakai di browser maupun Node (untuk tes).
 */
(function (root) {
  'use strict';

  var ME3N = {
    no: ['purchasing document'], item: ['item'], vs: ['validity per. start', 'validity period start'], ve: ['validity period end', 'validity per. end'],
    mat: ['material'], text: ['short text'], uom: ['order unit'], price: ['net price'], tgt: ['target val. (header)', 'target value (header)'],
    cur: ['currency'], rel: ['released value'], open: ['open value'], openQty: ['open target quantity'], tgtQty: ['target quantity'],
    pg: ['purchasing group'], dd: ['document date'], vendor: ['vendor/supplying plant', 'vendor', 'supplier'], vname: ['name of vendor'],
    porg: ['purch. organization', 'purchasing organization'], topen: ['total open value'], del: ['deletion indicator'], dtype: ['purchasing doc. type'],
    plant: ['plant']
  };
  var ME2N = {
    no: ['purchasing document'], item: ['item'], plant: ['plant'], pg: ['purchasing group'], deliv: ['delivery date'], dd: ['document date'],
    vendor: ['vendor/supplying plant', 'vendor', 'supplier'], mat: ['material'], text: ['short text'], qty: ['order quantity'], uom: ['order unit'],
    price: ['net price'], val: ['net order value'], cur: ['currency'], sdq: ['still to be delivered (qty)'], sdv: ['still to be delivered (value)'],
    siv: ['still to be invoiced (val.)', 'still to be invoiced (value)'], del: ['deletion indicator'], pr: ['purchase requisition'],
    oa: ['outline agreement'], dtype: ['purchasing doc. type'], porg: ['purch. organization', 'purchasing organization'], qrec: ['quantity received']
  };
  var STATUS_WORDS = /^(on progress|on review|on planning|need confirmation|total|po\/ro on delivery|outstanding \(late\)|routing approval)$/i;

  function norm(h) { return String(h == null ? '' : h).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function str(v) {
    if (v == null) return '';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
    return String(v).trim();
  }
  function docNo(v) { if (v == null || v === '') return ''; if (typeof v === 'number') return String(Math.round(v)); return String(v).trim(); }
  function num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    var n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function xlDate(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number') { if (v < 1000) return ''; return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10); }
    if (v instanceof Date) return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    if ((m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/))) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    return '';
  }
  function vendorSplit(v) {
    var s = str(v), m = s.match(/^(\S+)\s{2,}(.*)$/) || s.match(/^(\d+)\s+(.*)$/);
    return m ? { code: m[1], name: m[2].trim() } : { code: '', name: s };
  }
  function colMap(heads, spec) {
    var map = {};
    Object.keys(spec).forEach(function (k) {
      for (var i = 0; i < heads.length; i++) if (spec[k].indexOf(heads[i]) >= 0) { map[k] = i; break; }
    });
    return map;
  }
  function rowsOf(XLSX, ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }); }

  // Client dari nama file ("..._100_..." / "..._180_...") atau Purch. Organization
  function clientOf(name, porgs) {
    var m = String(name || '').match(/(?:^|[^0-9])(100|180)(?:[^0-9]|$)/);
    if (m) return m[1];
    var p = (porgs || []).join(' ');
    if (/\b2021\b/.test(p)) return '100';
    if (/PHE1|\b70\d\d\b/.test(p)) return '180';
    return null;
  }
  // Tanggal data dari nama file: 110826 -> 2026-11-08 (MMDDYY) atau 2026-08-11 (DDMMYY); dipilih yang terbaru <= hari ini
  function dateOf(name, fallback, today) {
    today = today || new Date().toISOString().slice(0, 10);
    var base = String(name || '').replace(/\.[a-z]+$/i, ''), m, c = [];
    if ((m = base.match(/(?:^|[^0-9])(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/))) {
      var a = +m[1], b = +m[2], y = 2000 + +m[3];
      if (a >= 1 && a <= 12 && b >= 1 && b <= 31) c.push(y + '-' + pad(a) + '-' + pad(b));
      if (b >= 1 && b <= 12 && a >= 1 && a <= 31) c.push(y + '-' + pad(b) + '-' + pad(a));
    }
    if ((m = base.match(/(?:^|[^0-9])(\d{2})(\d{2})(\d{4})(?:[^0-9]|$)/))) {
      var a2 = +m[1], b2 = +m[2], y2 = +m[3];
      if (a2 <= 12 && b2 <= 31) c.push(y2 + '-' + pad(a2) + '-' + pad(b2));
      if (b2 <= 12 && a2 <= 31) c.push(y2 + '-' + pad(b2) + '-' + pad(a2));
    }
    c = c.filter(function (d) { return d <= today; }).sort();
    return c.length ? c[c.length - 1] : (fallback || today);
  }

  function findHeader(rows, need) {
    for (var r = 0; r < Math.min(rows.length, 15); r++) {
      var heads = (rows[r] || []).map(norm);
      if (need.every(function (n) { return heads.indexOf(n) >= 0; })) return { r: r, heads: heads };
    }
    return null;
  }

  // ---------- ME3N ----------
  function parseME3N(rows, h) {
    var c = colMap(h.heads, ME3N), map = {}, order = [], porgs = {}, nDel = 0;
    for (var i = h.r + 1; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      var no = docNo(r[c.no]); if (!no) continue;
      var del = c.del != null ? str(r[c.del]) : '';
      var oa = map[no];
      if (!oa) {
        var v = vendorSplit(r[c.vendor]);
        oa = map[no] = { no: no, porg: str(r[c.porg]), pg: str(r[c.pg]), dt: c.dtype != null ? str(r[c.dtype]) : '', vendor: v.name || str(r[c.vname]), vcode: v.code,
          vs: xlDate(r[c.vs]), ve: xlDate(r[c.ve]), dd: xlDate(r[c.dd]), cur: str(r[c.cur]) || 'IDR', tgt: num(r[c.tgt]), topen: num(r[c.topen]), rel: 0, items: [] };
        order.push(no);
        if (oa.porg) porgs[oa.porg] = 1;
      }
      var vs = xlDate(r[c.vs]), ve = xlDate(r[c.ve]);
      if (vs && (!oa.vs || vs < oa.vs)) oa.vs = vs;
      if (ve && (!oa.ve || ve > oa.ve)) oa.ve = ve;
      if (!oa.tgt && num(r[c.tgt])) oa.tgt = num(r[c.tgt]);
      var rel = num(r[c.rel]);
      oa.rel += rel;
      if (del === 'L') nDel++;
      // [item, material, deskripsi, uom, harga, target qty, open target qty, released value, indikator hapus/blokir]
      oa.items.push([str(r[c.item]), str(r[c.mat]), str(r[c.text]), str(r[c.uom]), num(r[c.price]), num(r[c.tgtQty]), num(r[c.openQty]), rel, del]);
    }
    return { list: order.map(function (k) { return map[k]; }), porgs: Object.keys(porgs), info: { oa: order.length, items: order.reduce(function (a, k) { return a + map[k].items.length; }, 0), deleted: nDel } };
  }

  // ---------- ME2N ----------
  function parseME2N(rows, h) {
    var c = colMap(h.heads, ME2N), map = {}, order = [], porgs = {}, nDel = 0, nRows = 0;
    for (var i = h.r + 1; i < rows.length; i++) {
      var r = rows[i]; if (!r) continue;
      var no = docNo(r[c.no]); if (!no) continue;
      nRows++;
      if (c.del != null && str(r[c.del]) === 'L') { nDel++; continue; } // item dihapus di SAP
      var po = map[no];
      if (!po) {
        var v = vendorSplit(r[c.vendor]);
        po = map[no] = { no: no, porg: c.porg != null ? str(r[c.porg]) : '', pg: str(r[c.pg]), dt: c.dtype != null ? str(r[c.dtype]) : '', vendor: v.name, vcode: v.code,
          dd: xlDate(r[c.dd]), cur: str(r[c.cur]) || 'IDR', items: [] };
        order.push(no);
        if (po.porg) porgs[po.porg] = 1;
      }
      // [item, material, deskripsi, qty, uom, net value, still to deliver qty, still to deliver value, still to invoice value, plant, delivery date, OA, PR]
      po.items.push([str(r[c.item]), str(r[c.mat]), str(r[c.text]), num(r[c.qty]), str(r[c.uom]), num(r[c.val]), num(r[c.sdq]), num(r[c.sdv]), num(r[c.siv]),
        str(r[c.plant]), xlDate(r[c.deliv]), docNo(r[c.oa]), docNo(r[c.pr])]);
    }
    return { list: order.map(function (k) { return map[k]; }), porgs: Object.keys(porgs), info: { po: order.length, rows: nRows, deleted: nDel } };
  }

  // ---------- Progres PR/RO ----------
  function parseProgres(XLSX, wb) {
    var out = { pengadaan: [], expediting: [], libur: [], tanggal: '' };
    var ws = wb.Sheets.Pengadaan;
    if (ws) {
      var rows = rowsOf(XLSX, ws), h = findHeader(rows, ['no pr', 'description']);
      if (h) {
        var c = colMap(h.heads, { no: ['no.'], tgl: ['tanggal project req'], prq: ['project request number'], pr: ['no pr'], wk: ['wk/field'], desc: ['description'],
          nilai: ['nilai'], cur: ['cr'], pic: ['pic buyer'], lt: ['lead time (hk)'], note: ['status/note'], st: ['status'], vendor: ['vendor'] });
        for (var i = h.r + 1; i < rows.length; i++) {
          var r = rows[i] || [], desc = r[c.desc], wk = str(r[c.wk]);
          if (typeof desc !== 'string' || !desc.trim()) continue;
          if (STATUS_WORDS.test(wk) && typeof r[c.desc] !== 'string') continue;
          out.pengadaan.push({ no: str(r[c.no]), tgl: xlDate(r[c.tgl]), prq: docNo(r[c.prq]), pr: docNo(r[c.pr]), wk: wk, desc: desc.trim(),
            nilai: typeof r[c.nilai] === 'number' ? r[c.nilai] : null, cur: str(r[c.cur]) || 'IDR', pic: str(r[c.pic]), lt: typeof r[c.lt] === 'number' ? r[c.lt] : null,
            note: str(r[c.note]), st: str(r[c.st]), vendor: str(r[c.vendor]) });
        }
      }
      // daftar libur nasional & tanggal update (blok kalender di sisi kanan sheet)
      rows.forEach(function (r, ri) {
        (r || []).forEach(function (v, ci) {
          if (norm(v) === 'tanggal :' && rows[ri + 1]) out.tanggal = xlDate(rows[ri + 1][ci]) || out.tanggal;
          if (norm(v) === 'tanggal libur') {
            for (var k = ri + 1; k < rows.length; k++) { var d = xlDate((rows[k] || [])[ci]); if (!d) break; out.libur.push(d); }
          }
        });
      });
    }
    ws = wb.Sheets.Expediting;
    if (ws) {
      var rows2 = rowsOf(XLSX, ws), h2 = findHeader(rows2, ['no. po/ro', 'description']);
      if (h2) {
        var c2 = colMap(h2.heads, { pr: ['no.pr', 'no. pr', 'no pr'], po: ['no. po/ro', 'no po/ro'], wk: ['wk/field'], desc: ['description'], nilai: ['nilai'], cur: ['cr'],
          deliv: ['deliv date', 'delivery date'], st: ['status'], note: ['note'], vendor: ['vendor'] });
        for (var j = h2.r + 1; j < rows2.length; j++) {
          var x = rows2[j] || [], po = docNo(x[c2.po]), wk2 = str(x[c2.wk]), d2 = x[c2.desc];
          if (!po && !wk2) continue;
          if (typeof d2 !== 'string' && !po) continue;
          out.expediting.push({ pr: docNo(x[c2.pr]), po: po, wk: wk2, desc: str(d2), nilai: typeof x[c2.nilai] === 'number' ? x[c2.nilai] : null, cur: str(x[c2.cur]) || 'IDR',
            deliv: xlDate(x[c2.deliv]), st: str(x[c2.st]), note: str(x[c2.note]), vendor: str(x[c2.vendor]) });
        }
      }
    }
    return out;
  }

  /*
   * Baca satu workbook. Hasil: { kind: 'me3n'|'me2n'|'progres', client, date, data, info }
   */
  function parseWorkbook(XLSX, wb, name, lastModified, today) {
    var fb = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : null;
    if (wb.Sheets.Pengadaan || wb.Sheets.Expediting) {
      var p = parseProgres(XLSX, wb);
      if (!p.pengadaan.length && !p.expediting.length) throw new Error('Sheet Pengadaan / Expediting tidak berisi data yang dikenali');
      return { kind: 'progres', client: null, date: p.tanggal || fb || today, data: p, info: { pengadaan: p.pengadaan.length, expediting: p.expediting.length } };
    }
    for (var s = 0; s < wb.SheetNames.length; s++) {
      var rows = rowsOf(XLSX, wb.Sheets[wb.SheetNames[s]]);
      var h3 = findHeader(rows, ['purchasing document', 'target val. (header)']);
      if (h3) {
        var a = parseME3N(rows, h3);
        return { kind: 'me3n', client: clientOf(name, a.porgs), date: dateOf(name, fb, today), data: a.list, info: a.info };
      }
      var h2 = findHeader(rows, ['purchasing document', 'still to be delivered (value)']);
      if (h2) {
        var b = parseME2N(rows, h2);
        return { kind: 'me2n', client: clientOf(name, b.porgs), date: dateOf(name, fb, today), data: b.list, info: b.info };
      }
    }
    throw new Error('Format tidak dikenali — gunakan export ME3N, ME2N, atau file Progres PR/RO (sheet Pengadaan & Expediting)');
  }

  root.SapParse = { parseWorkbook: parseWorkbook, dateOf: dateOf, clientOf: clientOf, xlDate: xlDate };
})(typeof self !== 'undefined' ? self : this);

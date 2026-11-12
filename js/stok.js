/*
 * Ringkasan stok & pemakaian material dari data website Material Warehouse
 * (ZMB52 + MB51), hanya untuk material yang ada di kontrak OA.
 * Dipakai untuk saran qty RO di detail OA. Berlaku di browser & Node.
 */
(function (root) {
  'use strict';
  var PLANTS = ['W101', 'W803', 'W802', 'W102']; // Zona 1: Rantau, Lirik, Jambi, Pangkalan Susu
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymAdd(ym, n) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); }

  // stock: data ZMB52 Warehouse ({plants:{W101:{date, rows:[[plant, mat, desc, sloc, batch, qty, uom, ...]]}}})
  // mb51: data MB51 Warehouse ({agg:{mat:{d,u,p:{plant:{'YYYY-MM-DD':qty}}}}, max})
  // mats: daftar KIMAP yang perlu diringkas
  function build(stock, mb51, mats) {
    var want = {}; (mats || []).forEach(function (m) { if (m) want[m] = 1; });
    var out = {}, stDate = '';
    PLANTS.forEach(function (pl, pi) {
      var P = stock && stock.plants && stock.plants[pl];
      if (!P) return;
      if (P.date > stDate) stDate = P.date;
      P.rows.forEach(function (r) {
        var m = r[1]; if (!want[m]) return;
        var o = out[m] || (out[m] = { s: [0, 0, 0, 0] });
        o.s[pi] += +r[5] || 0;
      });
    });
    var maxYm = mb51 && mb51.max ? mb51.max.slice(0, 7) : null, months = [];
    if (maxYm) for (var i = 11; i >= 0; i--) months.push(ymAdd(maxYm, -i));
    if (mb51 && mb51.agg) Object.keys(mb51.agg).forEach(function (m) {
      if (!want[m]) return;
      var a = mb51.agg[m], o = out[m] || (out[m] = { s: [0, 0, 0, 0] }), last = '';
      PLANTS.forEach(function (pl) {
        var p = a.p && a.p[pl]; if (!p) return;
        var by = {}; Object.keys(p).forEach(function (d) { by[d.slice(0, 7)] = (by[d.slice(0, 7)] || 0) + p[d]; if (p[d] > 0 && d > last) last = d; });
        var arr = months.map(function (ym) { return Math.round((by[ym] || 0) * 100) / 100; });
        if (arr.some(function (v) { return v; })) { o.u = o.u || {}; o.u[pl] = arr; }
      });
      if (last) o.l = last;
    });
    Object.keys(out).forEach(function (m) { var o = out[m]; if (!o.u && !o.l && !o.s.some(function (v) { return v; })) delete out[m]; });
    return { v: 1, plants: PLANTS, stockDate: stDate, useTo: mb51 && mb51.max || '', useFrom: months[0] || '', months: months, m: out };
  }

  // Saran qty RO (sama dengan Material Warehouse): pemakaian/bulan × (cover + lead time) − stok
  // pemakaian/bulan = 60% rata-rata 3 bulan terakhir + 40% rata-rata 12 bulan
  function suggest(o, plant, cover, lead) {
    var pi = PLANTS.indexOf(plant), arr = (o && o.u && o.u[plant]) || [], stock = o && pi >= 0 ? o.s[pi] : 0;
    var m12 = arr.reduce(function (a, v) { return a + v; }, 0) / 12;
    var m3 = arr.length >= 3 ? (arr[arr.length - 1] + arr[arr.length - 2] + arr[arr.length - 3]) / 3 : m12;
    var rate = m12 > 0 || m3 > 0 ? 0.6 * m3 + 0.4 * m12 : 0;
    var target = rate * (cover + lead);
    return { sug: Math.max(0, Math.ceil(target - stock)), rate: rate, stock: stock, use12: arr.reduce(function (a, v) { return a + v; }, 0), months: rate > 0 ? stock / rate : null, cover: cover, lead: lead };
  }

  root.Stok = { PLANTS: PLANTS, build: build, suggest: suggest };
})(typeof self !== 'undefined' ? self : this);

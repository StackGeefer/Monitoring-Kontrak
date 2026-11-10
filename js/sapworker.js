/* Web Worker: membaca file Excel SAP / Progres di background supaya tampilan tidak macet */
importScripts('../vendor/xlsx.full.min.js', 'sapparse.js' + (self.location.search || ''));

self.onmessage = function (e) {
  try {
    var wb = self.XLSX.read(new Uint8Array(e.data.buf), { type: 'array' });
    var res = self.SapParse.parseWorkbook(self.XLSX, wb, e.data.name, e.data.lastModified, e.data.today);
    self.postMessage({ ok: true, res: res });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};

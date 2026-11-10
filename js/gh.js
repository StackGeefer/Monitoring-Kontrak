/*
 * GitHub: simpan data langsung ke repo (GitHub Pages ikut ter-update ±1 menit).
 * - commit(): satu commit berisi banyak file (tambah/ubah/hapus)
 * - atomic(): baca versi TERBARU file terenkripsi dari repo -> ubah -> commit.
 *   Bila ada pengguna lain menyimpan bersamaan, diulang otomatis (tidak saling timpa).
 */
(function (root) {
  'use strict';
  var BRANCH = 'main';
  var cfg = { repo: null, token: null };

  function b64text(b64) {
    var s = atob(String(b64).replace(/\s/g, '')), u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return new TextDecoder().decode(u8);
  }

  async function req(method, path, body, token) {
    var tok = token || cfg.token;
    if (!tok) throw new Error('Akses simpan belum aktif');
    var res = await fetch('https://api.github.com/repos/' + cfg.repo + path, {
      method: method, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = res.status === 204 ? null : await res.json().catch(function () { return null; });
    if (!res.ok) {
      var e = new Error((data && data.message) || ('HTTP ' + res.status));
      e.status = res.status;
      throw e;
    }
    return data;
  }

  async function head() {
    var ref = await req('GET', '/git/ref/heads/' + BRANCH);
    var cm = await req('GET', '/git/commits/' + ref.object.sha);
    return { sha: ref.object.sha, tree: cm.tree.sha };
  }
  async function treeMap(treeSha) {
    var t = await req('GET', '/git/trees/' + treeSha + '?recursive=1'), map = {};
    t.tree.forEach(function (e) { if (e.type === 'blob') map[e.path] = e; });
    return map;
  }
  async function readBlob(sha) { var b = await req('GET', '/git/blobs/' + sha); return b64text(b.content); }

  // files: { path: string | {content (base64), encoding:'base64'} }, deletes: [path]
  async function buildCommit(h, files, deletes, message, exists) {
    var entries = [];
    for (var path in files) {
      var f = files[path];
      var blob = await req('POST', '/git/blobs', typeof f === 'string' ? { content: f, encoding: 'utf-8' } : f);
      entries.push({ path: path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    (deletes || []).forEach(function (p) { if (!exists || exists[p]) entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
    var nt = await req('POST', '/git/trees', { base_tree: h.tree, tree: entries });
    var nc = await req('POST', '/git/commits', { message: message, tree: nt.sha, parents: [h.sha] });
    await req('PATCH', '/git/refs/heads/' + BRANCH, { sha: nc.sha });
    return nc.sha;
  }
  function isConflict(e) { return e && (e.status === 422 || e.status === 409 || /fast forward|conflict/i.test(e.message)); }

  async function commit(files, deletes, message) {
    for (var attempt = 0; attempt < 4; attempt++) {
      var h = await head(), exists = deletes && deletes.length ? await treeMap(h.tree) : null;
      try { return await buildCommit(h, files, deletes, message, exists); }
      catch (e) { if (isConflict(e) && attempt < 3) continue; throw e; }
    }
  }

  /*
   * opt: { path, varName, note, key (kunci data), mutate(cur) -> next, message, files?, deletes? }
   * mutate menerima data terbaru dari repo (null bila belum ada) dan mengembalikan data baru.
   */
  async function atomic(opt) {
    for (var attempt = 0; attempt < 4; attempt++) {
      var h = await head(), map = await treeMap(h.tree), cur = null;
      var ent = map[opt.path];
      if (ent) {
        var p = root.Vault.payloadOf(await readBlob(ent.sha));
        cur = p ? await root.Vault.decrypt(opt.key, p) : null;
      }
      var next = opt.mutate(cur ? JSON.parse(JSON.stringify(cur)) : null);
      var files = Object.assign({}, opt.files || {});
      files[opt.path] = root.Vault.encFile(opt.varName, await root.Vault.encrypt(opt.key, next), opt.note);
      try { await buildCommit(h, files, opt.deletes, opt.message, map); return next; }
      catch (e) { if (isConflict(e) && attempt < 3) continue; throw e; }
    }
    throw new Error('Gagal menyimpan, coba lagi');
  }

  // Baca file teks terbaru langsung dari repo (tanpa menunggu GitHub Pages)
  async function readText(path) {
    var h = await head(), map = await treeMap(h.tree);
    return map[path] ? readBlob(map[path].sha) : null;
  }

  async function testToken(token) {
    var r = await req('GET', '', null, token);
    if (!r.permissions || !r.permissions.push) throw new Error('Token tidak punya izin tulis (Contents: Read and write) ke ' + cfg.repo);
    return r;
  }

  root.GH = {
    BRANCH: BRANCH,
    config: function (c) { Object.assign(cfg, c); },
    repo: function () { return cfg.repo; },
    hasToken: function () { return !!cfg.token; },
    req: req, commit: commit, atomic: atomic, readText: readText, testToken: testToken
  };
})(this);

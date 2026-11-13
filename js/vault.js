/*
 * Vault: login & enkripsi data (sama dengan Material Warehouse).
 *
 * - Data kontrak dienkripsi AES-256-GCM dengan satu "kunci data" acak.
 * - Kunci data dibungkus (wrapped) untuk tiap pengguna memakai password-nya
 *   (PBKDF2-SHA256, 250.000 iterasi). Login berhasil = kunci data terbuka.
 * - File data/*.js aman walau repo publik: tanpa login yang benar isinya tidak terbaca.
 * - Peran: owner (Owner Utama), writer (Writer / kontributor), viewer.
 *   Token GitHub Owner disimpan terenkripsi dengan "kunci admin" yang hanya
 *   terbungkus untuk Owner & Writer -> Writer bisa menyimpan tanpa pernah melihat token.
 * - Fungsi login() juga dipakai untuk membuka data Material Warehouse
 *   (prefix username "mw:"), sehingga kedua website bisa terhubung.
 */
(function (root) {
  'use strict';
  var ITER = 250000;
  var C = root.crypto || globalThis.crypto;
  var PREFIX = 'mk:';

  function toB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function fromB64(b64) {
    var s = atob(b64), u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function streamBytes(u8, stream) {
    return new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  // ---------- Pengguna ----------
  function normUser(u) { return String(u || '').trim().toLowerCase(); }
  function hashUser(u, prefix) {
    return C.subtle.digest('SHA-256', new TextEncoder().encode((prefix || PREFIX) + normUser(u))).then(hex);
  }
  function kek(password, salt) {
    return C.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return C.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function newKey() { return C.getRandomValues(new Uint8Array(32)); }

  function canWrite(role) { return role === 'owner' || role === 'writer' || role === 'mim'; }
  function hasAdminKey(role) { return canWrite(role); }

  function makeUser(username, password, role, dataKey, displayName, adminKey) {
    var salt = C.getRandomValues(new Uint8Array(16)), iv = C.getRandomValues(new Uint8Array(12)), aiv = C.getRandomValues(new Uint8Array(12));
    role = role || 'viewer';
    return Promise.all([hashUser(username), kek(password, salt)]).then(function (r) {
      return Promise.all([
        C.subtle.encrypt({ name: 'AES-GCM', iv: iv }, r[1], dataKey),
        adminKey && hasAdminKey(role) ? C.subtle.encrypt({ name: 'AES-GCM', iv: aiv }, r[1], adminKey) : null
      ]).then(function (w) {
        var u = { id: r[0], name: displayName || String(username).trim(), role: role, salt: toB64(salt), iv: toB64(iv), wk: toB64(new Uint8Array(w[0])) };
        if (w[1]) { u.aiv = toB64(aiv); u.ak = toB64(new Uint8Array(w[1])); }
        return u;
      });
    });
  }

  // Login: cari pengguna & buka kunci data (+ kunci admin bila ada). Gagal => Error
  function login(users, username, password, prefix) {
    return hashUser(username, prefix).then(function (h) {
      var u = (users || []).filter(function (x) { return x.id === h; })[0];
      if (!u) throw new Error('Username atau password salah');
      return kek(password, fromB64(u.salt)).then(function (k) {
        return C.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(u.iv) }, k, fromB64(u.wk)).then(function (raw) {
          if (!u.ak) return [raw, null];
          return C.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(u.aiv) }, k, fromB64(u.ak)).then(function (ak) { return [raw, ak]; }, function () { return [raw, null]; });
        });
      }).then(function (r) {
        return { user: { id: u.id, name: u.name, role: u.role }, key: new Uint8Array(r[0]), adminKey: r[1] ? new Uint8Array(r[1]) : null };
      }, function () { throw new Error('Username atau password salah'); });
    });
  }

  // ---------- Enkripsi data ----------
  function aesKey(raw) { return C.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  function encrypt(raw, obj) {
    var iv = C.getRandomValues(new Uint8Array(12));
    return streamBytes(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('gzip')).then(function (gz) {
      return aesKey(raw).then(function (k) { return C.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, gz); });
    }).then(function (ct) {
      var c = new Uint8Array(ct), out = new Uint8Array(12 + c.length);
      out.set(iv, 0); out.set(c, 12);
      return 'MWK1.' + toB64(out);
    });
  }
  function decrypt(raw, str) {
    if (String(str).slice(0, 5) !== 'MWK1.') return Promise.reject(new Error('Format data tidak dikenal'));
    var u8 = fromB64(str.slice(5));
    return aesKey(raw).then(function (k) {
      return C.subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(0, 12) }, k, u8.subarray(12));
    }).then(function (gz) {
      return streamBytes(new Uint8Array(gz), new DecompressionStream('gzip'));
    }).then(function (json) { return JSON.parse(new TextDecoder().decode(json)); });
  }
  // File biner (PDF) — tanpa gzip
  function encryptBytes(raw, u8) {
    var iv = C.getRandomValues(new Uint8Array(12));
    return aesKey(raw).then(function (k) { return C.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, u8); }).then(function (ct) {
      var c = new Uint8Array(ct), out = new Uint8Array(12 + c.length);
      out.set(iv, 0); out.set(c, 12);
      return 'MWB1.' + toB64(out);
    });
  }
  function decryptBytes(raw, str) {
    if (String(str).slice(0, 5) !== 'MWB1.') return Promise.reject(new Error('Format file tidak dikenal'));
    var u8 = fromB64(str.slice(5));
    return aesKey(raw).then(function (k) {
      return C.subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(0, 12) }, k, u8.subarray(12));
    }).then(function (b) { return new Uint8Array(b); });
  }

  // ---------- Isi file data/*.js ----------
  function usersFile(users) {
    return '/* Pengguna Monitoring Kontrak. Hanya hash username & kunci terenkripsi — tidak ada password. */\n' +
      'window.MK_USERS = ' + JSON.stringify(users, null, 1) + ';\n';
  }
  function encFile(varName, payload, note) {
    return '/* ' + note + ' — TERENKRIPSI */\nwindow.' + varName + ' = ' + JSON.stringify(payload) + ';\n';
  }
  // Ambil payload string dari isi file data/*.js
  function payloadOf(text) {
    var m = /=\s*("(?:[^"\\]|\\.)*")\s*;?\s*$/.exec(String(text || '').trim());
    return m ? JSON.parse(m[1]) : null;
  }
  function filePath(id) { return 'data/files/' + id + '.js'; }
  function fileFile(id, payload) {
    return '/* Dokumen kontrak terenkripsi — ' + id + ' */\nwindow.MK_FILE = window.MK_FILE || {};\nwindow.MK_FILE[' + JSON.stringify(id) + '] = ' + JSON.stringify(payload) + ';\n';
  }

  root.Vault = {
    newKey: newKey, makeUser: makeUser, login: login, hashUser: hashUser, canWrite: canWrite, hasAdminKey: hasAdminKey,
    encrypt: encrypt, decrypt: decrypt, encryptBytes: encryptBytes, decryptBytes: decryptBytes, toB64: toB64, fromB64: fromB64,
    usersFile: usersFile, encFile: encFile, payloadOf: payloadOf, filePath: filePath, fileFile: fileFile
  };
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));

/* Essai « téléphone du patient, sans serveur » : hors de l'appli KINÉ, patients fictifs.
   Ce fichier sert aux deux pages (kine-essai.html sur le Mac, lecteur.html sur le téléphone) :
   1. QR : fabrique un QR code (mode octets, correction L ou M, versions 1 à 40). Écrit pour l'essai, d'après la norme
      ISO 18004 et la méthode publique de Project Nayuki ; aucune bibliothèque, aucun appel réseau.
   2. Codec : le lien d'aller (après le « # ») et le code de retour (« KINE1.… »), compressés et chiffrés quand
      le navigateur le permet. */
var QR = (function () {
  'use strict';
  var ECC = {
    L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
  };
  var NB = {
    L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
  };
  var FMT = {L: 1, M: 0};
  function rawModules(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
  function dataCodewords(v, l) { return Math.floor(rawModules(v) / 8) - ECC[l][v] * NB[l][v]; }
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDiv(deg) { var r = [], i, j; for (i = 0; i < deg; i++) r.push(0); r[deg - 1] = 1; var root = 1;
    for (i = 0; i < deg; i++) { for (j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
  function rsRem(data, div) { var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= mul(c, f); }); }); return r; }
  function utf8(s) { var e = unescape(encodeURIComponent(String(s))), o = []; for (var i = 0; i < e.length; i++) o.push(e.charCodeAt(i)); return o; }
  function capacite(v, l) { return Math.floor((dataCodewords(v, l) * 8 - 4 - (v < 10 ? 8 : 16)) / 8); }

  function codewords(texte, l) {
    var bytes = utf8(texte), v = 1;
    while (v <= 40 && bytes.length > capacite(v, l)) v++;
    if (v > 40) throw new Error('Texte trop long pour un QR code (' + bytes.length + ' octets)');
    var bits = [], put = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(v, l) * 8;
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [], i, j;
    for (i = 0; i < bits.length; i += 8) { var o = 0; for (j = 0; j < 8; j++) o = (o << 1) | bits[i + j]; data.push(o); }
    var nb = NB[l][v], bl = ECC[l][v], raw = Math.floor(rawModules(v) / 8), ncourt = nb - raw % nb, lcourt = Math.floor(raw / nb);
    var blocs = [], div = rsDiv(bl), k = 0;
    for (i = 0; i < nb; i++) { var dat = data.slice(k, k + lcourt - bl + (i < ncourt ? 0 : 1)); k += dat.length; var ecc = rsRem(dat, div); if (i < ncourt) dat.push(0); blocs.push(dat.concat(ecc)); }
    var out = [];
    for (i = 0; i < blocs[0].length; i++) blocs.forEach(function (b, n) { if (i !== lcourt - bl || n >= ncourt) out.push(b[i]); });
    return {v: v, data: data, tout: out};
  }

  function matrice(texte, l) {
    l = l === 'L' ? 'L' : 'M';
    var cw = codewords(texte, l), v = cw.v, n = v * 4 + 17, m = [], fn = [], x, y, i, j;
    for (y = 0; y < n; y++) { m.push([]); fn.push([]); for (x = 0; x < n; x++) { m[y].push(false); fn[y].push(false); } }
    var set = function (x, y, d) { m[y][x] = !!d; fn[y][x] = true; };
    for (i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var repere = function (cx, cy) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy; if (xx >= 0 && xx < n && yy >= 0 && yy < n) set(xx, yy, d !== 2 && d !== 4); } };
    repere(3, 3); repere(n - 4, 3); repere(3, n - 4);
    var pos = [];
    if (v > 1) { var na = Math.floor(v / 7) + 2, pas = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2; pos = [6]; for (var p = n - 7; pos.length < na; p -= pas) pos.splice(1, 0, p); }
    pos.forEach(function (ax, a) { pos.forEach(function (ay, b) { var der = pos.length - 1;
      if ((a === 0 && b === 0) || (a === 0 && b === der) || (a === der && b === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }); });
    var format = function (masque) { var d = (FMT[l] << 3) | masque, rem = d, i; for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((d << 10) | rem) ^ 0x5412, bit = function (i) { return ((bits >>> i) & 1) !== 0; };
      for (i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
      for (i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
      set(8, n - 8, true); };
    format(0);
    if (v >= 7) { var rem = v; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); var vb = (v << 12) | rem;
      for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) !== 0, a = n - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bt); set(b, a, bt); } }
    var k = 0, tout = cw.tout;
    for (var droite = n - 1; droite >= 1; droite -= 2) { if (droite === 6) droite = 5;
      for (var vert = 0; vert < n; vert++) for (j = 0; j < 2; j++) { x = droite - j; var haut = ((droite + 1) & 2) === 0; y = haut ? n - 1 - vert : vert;
        if (!fn[y][x] && k < tout.length * 8) { m[y][x] = ((tout[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; } } }
    var MASQUES = [function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x, y) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; }, function (x, y) { return x * y % 2 + x * y % 3 === 0; },
      function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; }, function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }];
    var appliquer = function (q) { for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (!fn[y][x] && MASQUES[q](x, y)) m[y][x] = !m[y][x]; };
    var penalite = function () { var s = 0, x, y, noir = 0, lignes = [];
      for (y = 0; y < n; y++) { var a = '', b = ''; for (x = 0; x < n; x++) { a += m[y][x] ? '1' : '0'; b += m[x][y] ? '1' : '0'; if (m[y][x]) noir++; } lignes.push(a, b); }
      lignes.forEach(function (t) { var r = t.match(/0{5,}|1{5,}/g); if (r) r.forEach(function (u) { s += u.length - 2; });
        var c = t.split('10111010000').length - 1 + t.split('00001011101').length - 1; s += c * 40; });
      for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { var c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3; }
      s += Math.floor(Math.abs(noir * 20 - n * n * 10) / (n * n)) * 10; return s; };
    var meilleur = 0, min = Infinity;
    for (var q = 0; q < 8; q++) { appliquer(q); format(q); var pe = penalite(); if (pe < min) { min = pe; meilleur = q; } appliquer(q); }
    appliquer(meilleur); format(meilleur);
    return {version: v, taille: n, m: m, niveau: l, octets: utf8(texte).length};
  }

  /* un dessin SVG net à toute taille : une marge blanche de 4 cases, comme la norme le demande */
  function svg(texte, l, attrs) { var q = matrice(texte, l), n = q.taille, d = '', x, y, marge = 4;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (q.m[y][x]) { var x0 = x; while (x + 1 < n && q.m[y][x + 1]) x++; d += 'M' + (x0 + marge) + ' ' + (y + marge) + 'h' + (x - x0 + 1) + 'v1h-' + (x - x0 + 1) + 'z'; }
    var c = n + 2 * marge;
    return {q: q, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + c + ' ' + c + '" shape-rendering="crispEdges" ' + (attrs || '') + '><rect width="' + c + '" height="' + c + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>'}; }

  return {matrice: matrice, svg: svg, codewords: codewords, capacite: capacite, utf8: utf8, _rs: function (d, n) { return rsRem(d, rsDiv(n)); }, _dc: dataCodewords};
})();

var Codec = (function () {
  'use strict';
  var ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64u(u8) { var s = '', i; for (i = 0; i < u8.length; i += 3) { var a = u8[i], b = u8[i + 1], c = u8[i + 2], n = (a << 16) | ((b || 0) << 8) | (c || 0);
      s += ABC[n >>> 18] + ABC[(n >>> 12) & 63] + (i + 1 < u8.length ? ABC[(n >>> 6) & 63] : '') + (i + 2 < u8.length ? ABC[n & 63] : ''); } return s; }
  function unb64u(s) { s = String(s).replace(/[^A-Za-z0-9_-]/g, ''); var o = [], i; for (i = 0; i < s.length; i += 4) { var v = [0, 1, 2, 3].map(function (k) { var c = s[i + k]; return c === undefined ? -1 : ABC.indexOf(c); });
      var n = (v[0] << 18) | ((v[1] < 0 ? 0 : v[1]) << 12) | ((v[2] < 0 ? 0 : v[2]) << 6) | (v[3] < 0 ? 0 : v[3]); o.push(n >>> 16); if (v[2] >= 0) o.push((n >>> 8) & 255); if (v[3] >= 0) o.push(n & 255); } return new Uint8Array(o); }
  function versOctets(s) { return new Uint8Array(QR.utf8(s)); }
  function versTexte(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return decodeURIComponent(escape(s)); }
  function flux(u8, T) { return new Response(new Blob([u8]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function peutCompresser() { try { return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && !!new CompressionStream('deflate-raw'); } catch (e) { return false; } }
  function peutChiffrer() { try { return !!(window.crypto && crypto.subtle && crypto.getRandomValues); } catch (e) { return false; } }
  function alea(n) { var u = new Uint8Array(n); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(u); else for (var i = 0; i < n; i++) u[i] = Math.floor(Math.random() * 256); return u; }
  function cle(k) { return crypto.subtle.importKey('raw', unb64u(k), 'AES-GCM', false, ['encrypt', 'decrypt']); }

  /* l'aller : ce qui suit le « # ». « z » compressé, « j » tel quel (ancien téléphone). */
  function aller(objet, simple) { var u8 = versOctets(JSON.stringify(objet));
    if (simple || !peutCompresser()) return Promise.resolve('j' + b64u(u8));
    return flux(u8, CompressionStream).then(function (z) { return 'z' + b64u(z); }); }
  function lireAller(h) { h = String(h || '').replace(/^#/, ''); if (!h) return Promise.resolve(null);
    var mode = h[0], u8 = unb64u(h.slice(1));
    if (mode === 'j') return Promise.resolve(JSON.parse(versTexte(u8)));
    if (mode === 'z') { if (!peutCompresser()) return Promise.reject(new Error('ancien')); return flux(u8, DecompressionStream).then(function (b) { return JSON.parse(versTexte(b)); }); }
    return Promise.reject(new Error('lien')); }

  /* le retour : « KINE1.<envoi>.<mode><données> ». « c » chiffré (AES-GCM, la clé venue par l'aller), « p » en clair. */
  function retour(id, k, objet) { var u8 = versOctets(JSON.stringify(objet));
    if (!k || !peutChiffrer()) return Promise.resolve({code: 'KINE1.' + id + '.p' + b64u(u8) + '.FIN', chiffre: false});
    var iv = alea(12);
    return cle(k).then(function (c) { return crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, c, u8); }).then(function (b) { var c = new Uint8Array(b), o = new Uint8Array(12 + c.length); o.set(iv); o.set(c, 12);
      return {code: 'KINE1.' + id + '.c' + b64u(o) + '.FIN', chiffre: true}; }); }
  var MOTIF = /KINE1\.([A-Za-z0-9]{4,12})\.([cp])([A-Za-z0-9_-]{8,})/;
  /* avec « .FIN », le code supporte d'être coupé par un mail (retours à la ligne, espaces, « > » d'une citation, « = » de fin de ligne) */
  var MOTIF_FIN = /KINE1\.([A-Za-z0-9]{4,12})\.([cp])([A-Za-z0-9_\-\s>=]{8,}?)\.FIN/;
  function trouverRetour(texte) { texte = String(texte || ''); var m = MOTIF_FIN.exec(texte);
    if (m) { var d = m[3].replace(/[\s>=]/g, ''); return {id: m[1], mode: m[2], donnees: d, code: 'KINE1.' + m[1] + '.' + m[2] + d + '.FIN'}; }
    m = MOTIF.exec(texte); return m ? {id: m[1], mode: m[2], donnees: m[3], code: m[0]} : null; }
  /* tous les codes d'un texte, sans doublon : plusieurs mails collés d'un coup */
  function trouverTous(texte) { var l = [], vus = {}, r, reste = String(texte || ''), i;
    while ((r = trouverRetour(reste))) { if (!vus[r.code]) { vus[r.code] = 1; l.push(r); } i = reste.indexOf('KINE1.' + r.id + '.'); reste = reste.slice(i + 6); if (l.length > 200) break; }
    return l; }
  function lireRetour(r, k) { var u8 = unb64u(r.donnees);
    if (r.mode === 'p') return Promise.resolve(JSON.parse(versTexte(u8)));
    if (!k || !peutChiffrer()) return Promise.reject(new Error('cle'));
    return cle(k).then(function (c) { return crypto.subtle.decrypt({name: 'AES-GCM', iv: u8.slice(0, 12)}, c, u8.slice(12)); }).then(function (b) { return JSON.parse(versTexte(new Uint8Array(b))); }); }

  return {b64u: b64u, unb64u: unb64u, aller: aller, lireAller: lireAller, retour: retour, trouverRetour: trouverRetour, trouverTous: trouverTous, lireRetour: lireRetour,
    alea: alea, peutCompresser: peutCompresser, peutChiffrer: peutChiffrer};
})();

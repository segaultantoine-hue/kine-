/* KINÉ · praticien, version 2 (2.5, lot H, RET-632 : la réévaluation rapide, plus bas) ; version 1 (2.3.3, lot F, RET-557, piste B « l'examen d'abord »). Le script de praticien.html.
   Le billet (après le « # », lu par Codec.lireAller de commun.js) :
     {v:1, id, k, e, z:1, mel?, t:'x', pv:1, pa:{i:'J. E.', a:25}, rg:'genou D', bl:'Bilan initial', h:'14:02',
      T:[{n, c:'GD'|'A'|'N', u:'' ou une unité, g:groupe}], A:[{n, x:1 (une seule valeur), u:'°'|'cm'|'', r:'140' (valeur attendue)}]}
   Le retour (Codec.retour, chiffré avec la clé k du billet, « KINE1.<envoi>.… .FIN ») :
     {e, t:'x', pv:1, d:'2026-11-23', h:<ms>, T:[[i, {G:'pos', D:'neg'}, {G:'12'}]], A:[[i, {g, d, v}, {g:1}]] (le second objet : mesuré au téléphone),
      n:'la note', c:[secondes, …] (les chronos libres)}
   Rien n'est envoyé à un serveur. La saisie en cours est gardée sur ce téléphone (localStorage, « kine-praticien ») pour survivre à un rechargement,
   jusqu'à « Effacer de ce téléphone », qui vide tout. */
(function () {
'use strict';
var VERSION_PRATICIEN = 2, CLE = 'kine-praticien', MAX_T = 80, MAX_A = 40;
var app = document.getElementById('app');
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); };
var txt = function (v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n || 80) : ''; };
var auj = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
var mmss = function (s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
var pl = function (n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); };
var LOGO = '<svg viewBox="0 0 22 16" aria-hidden="true"><path d="M5 1h3L5 15H2z"/><path d="M11 1h3l-3 14H8z"/><path d="M17 1h3l-3 14h-3z"/></svg>';
var COCHE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>';
var TEL = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="2" width="10" height="16" rx="2"/><path d="M8 15h4"/></svg>';
var MICRO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';

var B = null;        /* le billet, contrôlé champ par champ */
var S = null;        /* la saisie : {r:{i:{G,D}}, v:{i:{G,D}}, a:{i:{g,d,v,mg,md,mv}}, n:'', c:[s]} */
var V = {ecran: 1, feuille: null, inc: null, chr: {t0: 0, cible: 'libre', minuteur: 0}, code: null, msg: '', efface: 0, tmp: {}, ouvre: null, vient: null};   /* tmp, ouvre, vient : la réévaluation rapide (2.5, lot H) */

/* --- le billet --- */
function lireBillet(o) {
  if (!o || typeof o !== 'object' || o.t !== 'x' || typeof o.id !== 'string' || !/^[A-Za-z0-9]{4,12}$/.test(o.id)) return null;
  var pa = o.pa && typeof o.pa === 'object' ? o.pa : {}, age = Number(pa.a);
  var b = {id: o.id, k: typeof o.k === 'string' ? o.k.slice(0, 64) : '', e: txt(o.e, 24), z: o.z ? 1 : 0, mel: /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(String(o.mel || '')) ? String(o.mel) : '',
    ini: txt(pa.i, 12), age: Number.isInteger(age) && age >= 0 && age < 130 ? age : null, rg: txt(o.rg, 40), bl: txt(o.bl, 40), h: /^\d\d:\d\d$/.test(String(o.h || '')) ? o.h : '', T: [], A: []};
  (Array.isArray(o.T) ? o.T : []).slice(0, MAX_T).forEach(function (x) { if (!x || typeof x !== 'object' || !txt(x.n)) return; b.T.push({n: txt(x.n), c: x.c === 'A' || x.c === 'N' ? x.c : 'GD', u: txt(x.u, 8), g: txt(x.g, 60)}); });
  (Array.isArray(o.A) ? o.A : []).slice(0, MAX_A).forEach(function (x) { if (!x || typeof x !== 'object' || !txt(x.n)) return; b.A.push({n: txt(x.n), x: x.x ? 1 : 0, u: txt(x.u, 8), r: txt(String(x.r == null ? '' : x.r), 16)}); });
  if (o.m === 'r') lireLignesR(o, b);   /* 2.5, lot H : la réévaluation rapide */
  return b;
}
var cotesT = function (t) { return t.c === 'GD' ? ['G', 'D'] : [t.c]; };
var cotesA = function (a) { return a.x ? ['v'] : ['g', 'd']; };
var libCote = function (c) { return c === 'G' || c === 'g' ? 'gauche' : c === 'D' || c === 'd' ? 'droite' : ''; };

/* --- la saisie gardée sur ce téléphone, jusqu'à « Effacer » --- */
function saisieVide() { return {r: {}, v: {}, a: {}, n: '', c: [], z: {}}; }
function relire() { if (B.m === 'r') return relireR(); try { var o = JSON.parse(localStorage.getItem(CLE) || 'null'); if (o && o.id === B.id && o.s && typeof o.s === 'object') { var s = saisieVide(); ['r', 'v', 'a', 'z'].forEach(function (k) { if (o.s[k] && typeof o.s[k] === 'object') s[k] = o.s[k]; }); s.n = typeof o.s.n === 'string' ? o.s.n : ''; s.c = Array.isArray(o.s.c) ? o.s.c.filter(function (x) { return Number.isFinite(x); }) : []; return s; } } catch (z) { /* rien de gardé */ } return saisieVide(); }
function garder() { V.code = null; try { localStorage.setItem(CLE, JSON.stringify({id: B.id, s: S})); } catch (z) { /* stockage refusé : la saisie vit le temps de la page */ } }
var propre = function (v) { return txt(String(v == null ? '' : v), 12); };

/* --- les comptes --- */
function comptes() { var t = 0, tc = 0, tot = 0, a = 0;
  B.T.forEach(function (x, i) { var n = 0; cotesT(x).forEach(function (c) { tot++; if ((S.r[i] || {})[c] || propre((S.v[i] || {})[c])) { n++; tc++; } }); if (n) t++; });
  B.A.forEach(function (x, i) { if (cotesA(x).some(function (c) { return propre((S.a[i] || {})[c]); })) a++; });
  return {t: t, tc: tc, tot: tot, a: a, c: S.c.length, n: S.n.trim() ? 1 : 0, z: Object.keys(S.z || {}).length}; }

/* --- les écrans --- */
function tete() { return '<div class="hp">' + LOGO + '<b>KINÉ</b><span>· praticien</span>' + (B.ini ? '<span class="pt" id="pr-qui">' + esc(B.ini) + (B.age != null ? ', ' + B.age + ' ans' : '') + '</span>' : '') + '</div>'; }
function onglets() { var c = comptes(), l = [[1, 'Tests', c.tc + ' / ' + c.tot], [2, 'Amplitudes', pl(c.a, 'notée') + (c.c ? ' · ' + pl(c.c, 'chrono') : '')], [3, 'Note et envoi', c.n ? '1 note' : 'pas de note']];
  return '<div class="onglets" role="tablist">' + l.map(function (x) { return '<button role="tab" id="pr-on-' + x[0] + '" data-a="ecran" data-v="' + x[0] + '" aria-selected="' + (V.ecran === x[0]) + '">' + x[1] + '<small>' + esc(x[2]) + '</small></button>'; }).join('') + '</div>'; }
function pmBtn(i, c, v, on) { var s = v === 'pos' ? '+' : '−'; return '<button class="' + (v === 'pos' ? 'p' : 'm') + '" data-a="res" data-i="' + i + '" data-c="' + c + '" data-v="' + v + '" aria-pressed="' + on + '" aria-label="' + esc(B.T[i].n + (libCote(c) ? ', ' + libCote(c) : '') + ' : ' + (v === 'pos' ? 'positif' : 'négatif')) + '">' + s + '</button>'; }
function ligneTest(x, i) { var r = S.r[i] || {}, v = S.v[i] || {}, cs = cotesT(x), sec = x.u === 's';
  var h = '<div class="tr" id="pr-t-' + i + '"><div class="tl"><span class="tn">' + esc(x.n) + '</span>' + cs.map(function (c) { return '<span class="pm">' + (cs.length > 1 ? '<em>' + c + '</em>' : '') + pmBtn(i, c, 'pos', r[c] === 'pos') + pmBtn(i, c, 'neg', r[c] === 'neg') + '</span>'; }).join('') + '</div>';
  if (x.u) h += '<div class="tv">' + cs.map(function (c) { return '<label>' + (cs.length > 1 ? c : 'Valeur') + '<input class="nb" inputmode="decimal" data-s="v" data-i="' + i + '" data-c="' + c + '" value="' + esc(propre(v[c])) + '" aria-label="' + esc(x.n + ', valeur' + (libCote(c) ? ' ' + libCote(c) : '')) + '">' + (x.u === 'val' ? '' : esc(x.u)) + '</label>'; }).join('')
    + (sec ? '<button data-a="chrono-test" data-i="' + i + '">Chronométrer</button>' : '') + '</div>';
  return h + '</div>'; }
function compteTxt(c) { return c.tc + ' sur ' + c.tot + ' notés · touchez + ou −' + (B.T.some(function (x) { return x.c === 'GD'; }) ? ', à gauche et à droite' : '') + ' ; un second appui efface.'; }
function recHtml(c) { return '<div><b>' + c.t + '</b>' + (c.t > 1 ? 'tests' : 'test') + '</div><div><b>' + c.a + '</b>' + (c.a > 1 ? 'amplitudes' : 'amplitude') + '</div><div><b>' + c.c + '</b>' + (c.c > 1 ? 'chronos' : 'chrono') + '</div><div><b>' + c.n + '</b>note</div>' + (c.z ? '<div id="l25j-rec-z"><b>' + c.z + '</b>' + (c.z > 1 ? 'zones' : 'zone') + '</div>' : ''); }
/* une valeur tapée : les comptes suivent sans redessiner l'écran (le clavier reste ouvert, la touche visée ensuite reste sous le doigt) */
function majComptes() { if (B.m === 'r') { majPiedR(); return; } var c = comptes(), o = app.querySelector('.onglets'), p = document.getElementById('pr-compte'), r = document.getElementById('pr-rec'), b = document.getElementById('pr-renvoyer');
  if (o) o.outerHTML = onglets(); if (p) p.textContent = compteTxt(c); if (r) r.innerHTML = recHtml(c); if (b) b.disabled = !c.t && !c.a && !c.c && !c.n && !c.z; }
function ecranTests() { var c = comptes(), h = '', g0 = null;
  if (!B.T.length) return '<h1>Tests</h1><p class="petit" id="pr-sans-tests">Aucun test dans cet examen : passez aux amplitudes ou à la note.</p><button class="btn sec" data-a="ecran" data-v="2">Amplitudes et chrono ›</button>';
  B.T.forEach(function (x, i) { if (x.g !== g0) { g0 = x.g; if (x.g) h += '<div class="gt">' + esc(x.g) + '</div>'; } h += ligneTest(x, i); });
  return '<h1>Tests</h1><div class="carte tsts">' + h + '</div><p class="petit" id="pr-compte">' + esc(compteTxt(c)) + '</p>'
    + '<button class="btn sec" data-a="ecran" data-v="2">Amplitudes et chrono ›</button><p class="rien">Rien ne part d’ici avant « Renvoyer au Mac ».</p>'; }
function ligneAmpl(x, i) { var a = S.a[i] || {}, cs = cotesA(x), u = x.u === 'niv' ? '' : x.u, mesurable = x.u === '°';
  return '<div class="am" id="pr-a-' + i + '"><b>' + esc(x.n) + '</b>' + (x.r ? '<span class="ref">attendu ' + esc(x.r) + (u === '°' ? '°' : u ? ' ' + esc(u) : '') + '</span>' : '')
    + '<div class="cg">' + cs.map(function (c) { return '<label>' + (c === 'v' ? 'Valeur' : c.toUpperCase()) + '<input class="nb" inputmode="' + (x.u === 'niv' ? 'text' : 'decimal') + '" data-s="a" data-i="' + i + '" data-c="' + c + '" value="' + esc(propre(a[c])) + '" aria-label="' + esc(x.n + (libCote(c) ? ', ' + libCote(c) : '')) + '"><i>' + esc(u) + '</i>' + (a['m' + c] ? '<small>mesuré</small>' : '') + '</label>'; }).join('') + '</div>'
    + (mesurable ? '<button class="mes" data-a="inc" data-i="' + i + '">' + TEL + '<span>' + (cs.some(function (c) { return a['m' + c]; }) ? 'Refaire la mesure' : 'Mesurer avec le téléphone') + '</span></button>' : '') + '</div>'; }
function cibles() { var l = [['libre', 'Libre']]; B.T.forEach(function (x, i) { if (x.u === 's') cotesT(x).forEach(function (c) { l.push(['t' + i + ':' + c, x.n + (libCote(c) ? ' · ' + c : '')]); }); }); return l; }
function ecranAmpl() { var ch = V.chr, va = !!ch.t0, l = cibles(); if (!l.some(function (x) { return x[0] === ch.cible; })) ch.cible = 'libre';
  var s = va ? (Date.now() - ch.t0) / 1000 : 0;
  return '<h1>Amplitudes</h1>' + (B.A.length ? '<div class="carte">' + B.A.map(ligneAmpl).join('') + '</div>' : '<p class="petit" id="pr-sans-ampl">Aucune amplitude dans cet examen.</p>')
    + '<h2>Chrono</h2><div class="carte chr"><button class="anneau' + (va ? ' va' : '') + '" id="pr-chrono" data-a="chrono" aria-label="' + (va ? 'Arrêter le chrono' : 'Lancer le chrono') + '"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="fd"/><circle cx="60" cy="60" r="52" class="pl" id="pr-chrono-arc" style="stroke-dashoffset:' + (326.7 * (1 - (s % 60) / 60)).toFixed(1) + '"/></svg><span><b id="pr-chrono-t">' + mmss(s) + '</b><small>' + (va ? '■ Arrêter' : '▶ Lancer') + '</small></span></button>'
    + '<div class="chd"><b>' + (va ? 'Le temps s’écrit à l’arrêt.' : 'Où écrire le temps ?') + '</b>' + (l.length > 1 ? '<div class="cibles" id="pr-cibles">' + l.map(function (x) { return '<button data-a="cible" data-v="' + esc(x[0]) + '" aria-pressed="' + (ch.cible === x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' : '<p class="petit">Chaque temps part au Mac avec la note.</p>')
    + (S.c.length ? '<ul class="tps" id="pr-temps">' + S.c.map(function (t, i) { return '<li><span>Chrono ' + (i + 1) + ' · <b>' + mmss(t) + '</b></span><button data-a="chrono-oter" data-i="' + i + '" aria-label="Retirer le chrono ' + (i + 1) + '">Retirer</button></li>'; }).join('') + '</ul>' : '') + '</div></div>'
    + '<button class="btn sec" data-a="ecran" data-v="3">Note et envoi ›</button>'; }
function ecranNote() { var c = comptes(), rien = !c.t && !c.a && !c.c && !c.n && !c.z;
  return '<h1>Note</h1><div class="carte mic"><button class="micb" data-a="dicter" aria-label="Écrire ou dicter la note">' + MICRO + '</button><p class="mt">Touchez, puis le micro du clavier pour dicter</p>'
    + '<textarea id="pr-note" data-s="n" rows="4" maxlength="4000" placeholder="La note s’écrit ici." aria-label="Note de l’examen">' + esc(S.n) + '</textarea><p class="petit">La dictée est celle ' + (l25jIci() === 'ce téléphone' ? 'du téléphone' : 'de l’iPad') + ' : le texte s’écrit ici, rien d’autre ne part.</p></div>'
    + '<h2>Ce qui part au Mac</h2><div class="carte rec' + (c.z ? ' l25j-5' : '') + '" id="pr-rec">' + recHtml(c) + '</div>'
    + '<button class="btn" id="pr-renvoyer" data-a="renvoyer"' + (rien ? ' disabled' : '') + '>Renvoyer au Mac</button>'
    + '<p class="rien">Le Mac range tout dans l’examen de ' + esc(B.ini || 'ce dossier') + ', à relire avant de valider.</p>'
    + '<button class="btn rouge" id="pr-effacer" data-a="effacer">' + (V.efface ? 'Toucher encore pour tout effacer' : 'Effacer de ' + l25jIci()) + '</button>'; }

/* --- les feuilles --- */
function feuilleInc() { var d = V.inc, x = B.A[d.i], cs = cotesA(x), ang = d.ang == null ? null : Math.round(d.ang), arc = ang == null ? 100 : 100 - Math.min(180, ang) / 180 * 100;
  var h = '<h1>Inclinomètre</h1><p class="gros"><b>' + esc(x.n) + '</b>. Posez le téléphone sur le segment, au départ du mouvement : <b>Zéro</b>. Puis allez au bout du mouvement.</p>';
  if (cs.length > 1) h += '<div class="cibles" id="pr-inc-cote">' + cs.map(function (c) { return '<button data-a="inc-cote" data-v="' + c + '" aria-pressed="' + (d.c === c) + '">' + (c === 'g' ? 'Gauche' : 'Droite') + '</button>'; }).join('') + '</div>';
  if (d.etat === 'refuse' || d.etat === 'absent') h += '<p class="err" id="pr-inc-repli" role="status">' + (d.etat === 'refuse' ? 'Le capteur de mouvement est refusé sur ce téléphone.' : 'Ce téléphone ne donne pas son inclinaison.') + '</p><p class="gros">Écrivez la valeur au pouce :</p>'
    + '<div class="cg"><label>' + (d.c === 'v' ? 'Valeur' : d.c.toUpperCase()) + '<input class="nb" id="pr-inc-main" inputmode="decimal" data-s="a" data-i="' + d.i + '" data-c="' + d.c + '" value="' + esc(propre((S.a[d.i] || {})[d.c])) + '" aria-label="' + esc(x.n + ', valeur au pouce') + '"><i>°</i></label></div><button class="btn" data-a="inc-fermer">Terminé</button>';
  else h += '<svg class="jauge" viewBox="0 0 220 130" aria-hidden="true"><path class="fd" d="M20 115a90 90 0 0 1 180 0" fill="none" stroke-width="10" stroke-linecap="round"/><path class="arc" id="pr-inc-arc" d="M20 115a90 90 0 0 1 180 0" fill="none" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + arc.toFixed(1) + '"/><g class="aig" id="pr-inc-aig" style="transform:rotate(' + (ang || 0) + 'deg)"><path d="M110 115L28 115" stroke-width="4" stroke-linecap="round"/></g><circle class="axe" cx="110" cy="115" r="8"/></svg>'
    + '<div class="ang"><b id="pr-inc-ang">' + (ang == null ? '—' : ang + '°') + '</b><span id="pr-inc-etat">' + (d.etat === 'attente' ? 'en attente du capteur…' : esc(x.n.toLowerCase()) + (libCote(d.c) ? ' · ' + d.c.toUpperCase() : '')) + '</span></div>'
    + '<button class="btn okb" id="pr-inc-garder" data-a="inc-garder"' + (ang == null ? ' disabled' : '') + '>' + COCHE + '<span id="pr-inc-garder-t">Garder ' + (ang == null ? '' : ang + '°') + '</span></button>'
    + '<div class="duo"><button class="btn sec" data-a="inc-zero"' + (ang == null ? ' disabled' : '') + ' id="pr-inc-zero">Zéro</button><button class="btn sec" data-a="inc-fermer">Annuler</button></div>';
  return h; }
function feuilleRetour() { var r = V.code, h = B.m === 'r' ? '<h1>Prêt à renvoyer</h1>' + relectureR() : '<h1>Renvoyer au Mac</h1>';
  if (!r) return h + '<p class="gros" id="pr-prep">Préparation du code…</p>';
  if (r.err) return h + '<p class="err" id="pr-code-err">' + esc(r.err) + '</p><button class="lien" data-a="fermer">Fermer</button>';
  h += '<p class="gros">Au Mac, dans KINÉ : <b>Copier le code</b> ici puis ⌘V là-bas (presse-papiers partagé), ou montrez ce QR code à la caméra du Mac (« Retours du téléphone »).</p>';
  h += r.qr ? '<div class="qr" id="pr-qr">' + r.qr + '</div>' : '<p class="petit" id="pr-qr-long">Trop long pour un QR code : copiez le code.</p>';
  h += '<button class="btn" id="pr-copier" data-a="copier">' + (V.msg === 'copie' ? COCHE + 'Code copié' : 'Copier le code') + '</button>';
  var plus = []; if (navigator.share) plus.push('<button class="btn sec" data-a="partager">Partager (AirDrop…)</button>'); if (B.mel) plus.push('<a class="btn sec" id="pr-mail" href="mailto:' + encodeURIComponent(B.mel) + '?subject=' + encodeURIComponent('Retour KINÉ · ' + (B.m === 'r' ? 'réévaluation' : 'examen')) + '&body=' + encodeURIComponent(r.code) + '">Mail à moi-même</a>');
  if (plus.length) h += '<div class="' + (plus.length > 1 ? 'duo' : '') + '">' + plus.join('') + '</div>';
  h += '<textarea class="code" id="pr-code" readonly aria-label="Le code à coller dans KINÉ">' + esc(r.code) + '</textarea>';
  h += '<p class="petit">' + (r.chiffre ? 'Code chiffré, sans nom : seul votre Mac sait le lire.' : 'Ce téléphone ne chiffre pas : le code part en clair, sans nom.') + ' Une fois rangé au Mac, effacez ce téléphone.</p>';
  h += '<button class="btn rouge" data-a="effacer">' + (V.efface ? 'Toucher encore pour tout effacer' : 'Effacer de ' + l25jIci()) + '</button><button class="lien" data-a="fermer">Fermer</button>';
  return h; }

function rendre(garde) { if (!B) return; if (B.m === 'r') { rendreR(garde); return; } app.className = ''; var y = window.scrollY, f = V.feuille === 'inc' ? feuilleInc() : V.feuille === 'retour' ? feuilleRetour() : '', f25 = l25jClasse(), pay = f25 === 'pay', dl = f25 !== 'tel' && V.l25jVue === 'dl';
  app.innerHTML = tete() + '<p class="petit" id="pr-sous">' + esc([B.bl, B.rg, B.h ? 'reçu du Mac à ' + B.h.replace(':', ' h ') : ''].filter(Boolean).join(' · ')) + '</p>' + (f25 !== 'tel' ? l25jVues() : '') + (pay || dl ? '' : onglets())
    + (dl ? l25jDouleurs() : pay ? l25jColonnes() : '<section id="pr-ecran" data-ecran="' + V.ecran + '">' + (V.ecran === 1 ? ecranTests() : V.ecran === 2 ? ecranAmpl() : ecranNote()) + '</section>')
    + (f ? '<div class="voile" data-a="' + (V.feuille === 'inc' ? 'inc-fermer' : 'fermer') + '"></div><div class="feuille" id="pr-feuille" role="dialog" aria-modal="true">' + f + '</div>' : '');
  if (garde) window.scrollTo(0, y); else window.scrollTo(0, 0); }

/* --- l'inclinomètre : l'angle entre la pesanteur au « Zéro » et la pesanteur maintenant (ne dépend pas du cap du téléphone) --- */
function pesanteur(ev) { var b = ev.beta * Math.PI / 180, g = ev.gamma * Math.PI / 180; return [Math.cos(b) * Math.sin(g), -Math.sin(b), -Math.cos(b) * Math.cos(g)]; }
function surOrientation(ev) { var d = V.inc; if (!d || ev.beta == null || ev.gamma == null) return; var g = pesanteur(ev); d.g = g; if (!d.g0) d.g0 = g;
  var p = Math.max(-1, Math.min(1, g[0] * d.g0[0] + g[1] * d.g0[1] + g[2] * d.g0[2])), a0 = d.ang; d.ang = Math.acos(p) * 180 / Math.PI;
  if (d.etat !== 'actif' || a0 == null) { d.etat = 'actif'; rendre(true); return; }
  var ang = Math.round(d.ang), q = function (id) { return document.getElementById(id); };   /* à chaque lecture, sans tout redessiner */
  if (q('pr-inc-ang')) q('pr-inc-ang').textContent = ang + '°'; if (q('pr-inc-garder-t')) q('pr-inc-garder-t').textContent = 'Garder ' + ang + '°';
  if (q('pr-inc-aig')) q('pr-inc-aig').style.transform = 'rotate(' + ang + 'deg)'; if (q('pr-inc-arc')) q('pr-inc-arc').setAttribute('stroke-dashoffset', (100 - Math.min(180, ang) / 180 * 100).toFixed(1)); }
function incEcouter() { window.addEventListener('deviceorientation', surOrientation); var d = V.inc; setTimeout(function () { if (V.inc === d && d.etat === 'attente') { d.etat = 'absent'; rendre(true); } }, 1800); }
function incOuvrir(i) { var x = B.A[i]; if (!x) return; var cs = cotesA(x), a = S.a[i] || {}, c = cs.find(function (k) { return !propre(a[k]); }) || cs[0];
  V.inc = {i: i, c: c, g0: null, g: null, ang: null, etat: 'attente'}; V.feuille = 'inc';
  var DO = window.DeviceOrientationEvent;
  if (!DO) V.inc.etat = 'absent';
  else if (typeof DO.requestPermission === 'function') { var d = V.inc; try { DO.requestPermission().then(function (r) { if (V.inc !== d) return; if (r === 'granted') incEcouter(); else { d.etat = 'refuse'; rendre(true); } }, function () { if (V.inc === d) { d.etat = 'refuse'; rendre(true); } }); } catch (z) { d.etat = 'refuse'; } }   /* iOS : la permission se demande au toucher */
  else incEcouter();
  rendre(true); }
function incFermer() { window.removeEventListener('deviceorientation', surOrientation); V.inc = null; V.feuille = null; rendre(true); }

/* --- le chrono --- */
function chronoTic() { var ch = V.chr, t = document.getElementById('pr-chrono-t'), a = document.getElementById('pr-chrono-arc'); if (!ch.t0) return; var s = (Date.now() - ch.t0) / 1000;
  if (t) t.textContent = mmss(s); if (a) a.style.strokeDashoffset = (326.7 * (1 - (s % 60) / 60)).toFixed(1); }
function chrono() { var ch = V.chr;
  if (!ch.t0) { ch.t0 = Date.now(); clearInterval(ch.minuteur); ch.minuteur = setInterval(chronoTic, 200); rendre(true); return; }
  var s = Math.max(0, Math.round((Date.now() - ch.t0) / 1000)), m = /^t(\d+):([GDAN])$/.exec(ch.cible); ch.t0 = 0; clearInterval(ch.minuteur);
  if (m && B.T[Number(m[1])]) { var i = Number(m[1]); (S.v[i] = S.v[i] || {})[m[2]] = String(s); } else S.c = S.c.concat([s]).slice(-12);
  garder(); rendre(true); }

/* --- le retour --- */
function objetRetour() { if (B.m === 'r') return objetRetourR(); var o = {e: B.e, t: 'x', pv: VERSION_PRATICIEN, d: auj(), h: Date.now(), T: [], A: []};
  B.T.forEach(function (x, i) { var r = {}, v = {}, n = 0; cotesT(x).forEach(function (c) { var a = (S.r[i] || {})[c], b = propre((S.v[i] || {})[c]); if (a === 'pos' || a === 'neg') { r[c] = a; n++; } if (b) { v[c] = b; n++; } }); if (n) o.T.push([i, r, v]); });
  B.A.forEach(function (x, i) { var a = S.a[i] || {}, v = {}, m = {}, n = 0; cotesA(x).forEach(function (c) { var b = propre(a[c]); if (b) { v[c] = b; n++; if (a['m' + c]) m[c] = 1; } }); if (n) o.A.push([i, v, m]); });
  if (S.n.trim()) o.n = S.n.trim().slice(0, 4000); if (S.c.length) o.c = S.c.slice(0, 12);
  var z = l25jZonesRetour(); if (z.length) o.Z = z;   /* 2.5, lot J : les zones du schéma des douleurs, [code, type] */
  return o; }
function renvoyer() { V.feuille = 'retour'; V.msg = ''; if (V.code && !V.code.err) { rendre(true); return; } V.code = null; rendre(true);
  var fin = function (r) { var qr = null; try { qr = QR.svg(r.code, 'L', 'role="img" aria-label="QR code à montrer au Mac"').svg; } catch (z) { qr = null; } V.code = {code: r.code, chiffre: r.chiffre, qr: qr}; if (V.feuille === 'retour') rendre(true); };
  try { Codec.retour(B.id, B.k, objetRetour(), B.z).then(fin, function () { V.code = {err: 'Le code n’a pas pu être préparé sur ce téléphone.'}; if (V.feuille === 'retour') rendre(true); }); }
  catch (z) { V.code = {err: 'Le code n’a pas pu être préparé sur ce téléphone.'}; rendre(true); } }
function copier() { var r = V.code; if (!r || !r.code) return; var fait = function () { V.msg = 'copie'; rendre(true); }, main = function () { var t = document.getElementById('pr-code'); if (t) { t.focus(); t.select(); try { if (document.execCommand('copy')) fait(); } catch (z) { /* le code reste sélectionné */ } } };
  try { navigator.clipboard.writeText(r.code).then(fait, main); } catch (z) { main(); } }
function effacer() { if (!V.efface) { V.efface = 1; rendre(true); setTimeout(function () { if (V.efface === 1) { V.efface = 0; if (B) rendre(true); } }, 4000); return; }
  var quoi = B && B.m === 'r' ? 'de cette réévaluation : ni les initiales, ni les valeurs, ni la note' : 'de cet examen : ni les initiales, ni les tests, ni la note';
  V.efface = 2; clearInterval(V.chr.minuteur); window.removeEventListener('deviceorientation', surOrientation);
  try { localStorage.removeItem(CLE); } catch (z) { /* rien à retirer */ }
  B = null; S = null; V.code = null; V.inc = null; V.feuille = null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (z) { try { location.hash = ''; } catch (y) { /* le lien reste dans la barre */ } }
  app.className = ''; app.innerHTML = '<div class="hp">' + LOGO + '<b>KINÉ</b><span>· praticien</span></div><h1 id="pr-vide">Tout est effacé</h1><p>' + l25jMaj(l25jIci()) + ' ne garde plus rien ' + quoi + '.</p><p class="petit">Pour un autre examen : au Mac, dans le dossier, « ⋯ » puis « Sur mon téléphone ».</p>'; }

/* --- 2.5, lot H, RET-632 (audit 2.4.0, point 7 ; G2) : la réévaluation rapide. Le billet porte m:'r' et R, les lignes de la réévaluation du Mac, chacune avec
   ses valeurs d'avant (b : au bilan, d : dernière fois, j : sa date, a : le chiffre d'avant), sa sorte (y) et ses côtés (c). La douleur d'abord (l'ordre
   vient du Mac). Un appui par ligne : la carte se range dès le choix, l'écart s'écrit (vert mieux, rouge pire, gris pareil) ; un appui sur une ligne rangée
   la rouvre. Ce qui n'est pas touché reste comme avant. Le retour : {e, t:'x', pv:2, m:'r', d, h, R:[[i, valeur]], dec, n}. --- */
var SORTES_R = ['eva', 'num', 'pm', 'hyp', 'obj', 'mac', 'pat'], MAX_R = 60;
var DEC_R = [['continue', 'On continue la phase'], ['suivante', 'On passe à la phase suivante'], ['reprendre', 'À reprendre au Mac, bilan complet']];
var HYP_R = [['inchangee', 'Elle tient', 'rien ne la contredit'], ['revue', 'À revoir', 'au Mac, bilan complet']];
var OBJ_R = [['atteint', 'Atteint'], ['partiel', 'En partie'], ['non', 'Non']];
function lireLignesR(o, b) { b.m = 'r'; b.bl = txt(o.bl, 80); b.ph = txt(o.ph, 60); b.ti = txt(o.ti, 40); b.sd = o.sd ? 1 : 0; b.R = [];   /* ti, sd : les points de « À faire » (titre, sans décision) */
  (Array.isArray(o.R) ? o.R : []).slice(0, MAX_R).forEach(function (x, i) { if (!x || typeof x !== 'object' || !txt(x.n) || SORTES_R.indexOf(x.y) < 0) return;
    var c = ['G', 'D', 'A', 'N', 'GD', 'g', 'd', 'v', 'gd'].indexOf(x.c) >= 0 ? x.c : '', a = Number(x.a);
    b.R.push({i: i, y: x.y, n: txt(x.n), f: txt(x.f, 60), b: txt(String(x.b == null ? '' : x.b), 40), d: txt(String(x.d == null ? '' : x.d), 40), j: /^\d\d\/\d\d$/.test(String(x.j || '')) ? x.j : '',
      a: x.a != null && Number.isFinite(a) ? a : null, av: avR(x.av), c: c, u: txt(x.u, 12), s: x.s === 1 ? 1 : x.s === -1 ? -1 : 0, f2: txt(x.f2, 80)}); });
  return b; }
function avR(o) { var r = {}; if (o && typeof o === 'object') ['g', 'd', 'v'].forEach(function (k) { var v = Number(o[k]); if (o[k] != null && Number.isFinite(v)) r[k] = v; }); return r; }
var uniteR = function (x) { return x.u === '°' ? '°' : x.u ? ' ' + x.u : ''; };
var cotesR = function (x) { return x.y === 'pm' ? (x.c === 'GD' ? ['G', 'D'] : [x.c || 'A']) : x.c === 'gd' ? ['g', 'd'] : [x.c || 'v']; };
var aillR = function (x) { return x.y === 'mac' || x.y === 'pat'; };
function saisieVideR() { return {r: {}, dec: '', n: ''}; }
function relireR() { try { var o = JSON.parse(localStorage.getItem(CLE) || 'null'); if (o && o.id === B.id && o.s && typeof o.s === 'object') { var s = saisieVideR(); if (o.s.r && typeof o.s.r === 'object') s.r = o.s.r; s.dec = typeof o.s.dec === 'string' ? o.s.dec : ''; s.n = typeof o.s.n === 'string' ? o.s.n : ''; return s; } } catch (z) { /* rien de gardé */ } return saisieVideR(); }
/* une ligne est faite quand chacun de ses côtés a sa valeur */
function faiteR(k) { var x = B.R[k], v = S.r[k]; if (v == null || v === '') return false;
  if (x.y === 'pm' || x.y === 'num') return typeof v === 'object' && cotesR(x).every(function (c) { return v[c] != null && v[c] !== ''; });
  return true; }
function comptesR() { var m = 0, a = 0; B.R.forEach(function (x, k) { if (faiteR(k)) { if (aillR(x)) a++; else m++; } }); return {m: m, a: a, n: m + a, tot: B.R.length}; }
var nf1 = function (v) { return String(Math.round(v * 10) / 10).replace('.', ','); };
function valTxtR(x, v) { var cs = cotesR(x);
  if (x.y === 'eva') return v + ' sur 10';
  if (x.y === 'num') return cs.map(function (c) { return (cs.length > 1 ? c.toUpperCase() + ' ' : '') + nf1(v[c]) + uniteR(x); }).join(' · ');
  if (x.y === 'pm') return cs.map(function (c) { return (cs.length > 1 ? c + ' ' : '') + (v[c] === 'pos' ? '+' : '−'); }).join(' · ');
  if (x.y === 'hyp') return v === 'revue' ? 'à revoir' : 'elle tient';
  if (x.y === 'obj') return ({atteint: 'atteint', partiel: 'en partie', non: 'non'})[v] || '';
  return x.y === 'mac' ? 'à faire au Mac' : 'à envoyer au patient'; }
/* l'écart, tout de suite : [classe, texte] ; rien quand il n'y a pas d'avant comparable */
function ecartR(x, v) { var av = String(x.d || x.b || '').trim().charAt(0);
  if (x.y === 'pm') { var cs = cotesR(x), w = cs.length === 1 ? v[cs[0]] : null; if (!w || (av !== '+' && av !== '−')) return null;
    return av === '+' ? (w === 'neg' ? ['mieux', 'était +'] : ['pareil', 'toujours +']) : (w === 'pos' ? ['pire', 'était −'] : ['pareil', 'toujours −']); }
  if (x.a == null) return null; var n = x.y === 'eva' ? v : x.y === 'num' && cotesR(x).length === 1 ? v[cotesR(x)[0]] : null; if (n == null || !Number.isFinite(n)) return null;
  var d = Math.round((n - x.a) * 10) / 10, u = x.y === 'num' ? uniteR(x) : '';
  if (!d) return ['pareil', '= pareil']; var t = (d > 0 ? '▲ ' : '▼ ') + nf1(Math.abs(d)) + u;
  return [!x.s ? 'neutre' : (d > 0) === (x.s > 0) ? 'mieux' : 'pire', t]; }
function avantR(x) { var l = [];
  if (x.b && x.b !== '—') l.push('<span>au bilan <b>' + esc(x.b) + '</b></span>');
  l.push(x.d ? '<span>dernière fois <b>' + esc(x.d) + '</b>' + (x.j ? ' · ' + esc(x.j) : '') + '</span>' : '<span>jamais remesuré</span>');
  return '<div class="rav">' + l.join('') + '</div>'; }
function corpsR(x, k) { var v = S.r[k], cs = cotesR(x), h = '';
  if (x.y === 'eva') { for (var n = 0; n <= 10; n++) h += '<button class="' + (n === x.a ? 'avant' : '') + '" data-a="r-eva" data-k="' + k + '" data-v="' + n + '" aria-pressed="' + (v === n) + '" aria-label="' + esc(x.n + ' : ' + n + ' sur 10') + '">' + n + '</button>';
    return '<div class="reva">' + h + '</div><div class="rleg"><span>' + (x.s > 0 ? 'impossible' : 'aucune') + '</span>' + (x.a != null ? '<span><i></i>la dernière fois</span>' : '') + '<span>' + (x.s > 0 ? 'comme avant' : 'pire imaginable') + '</span></div>'; }
  if (x.y === 'num') { var t = V.tmp[k] || (V.tmp[k] = (function () { var o = {}; cs.forEach(function (c) { o[c] = v && typeof v === 'object' && v[c] != null ? v[c] : x.av[c] != null ? x.av[c] : x.a != null ? x.a : 0; }); return o; })());
    h = cs.map(function (c) { return '<div class="rnum' + (cs.length > 1 ? ' cote' : '') + '">' + (cs.length > 1 ? '<em>' + c.toUpperCase() + '</em>' : '') + '<button data-a="r-pas" data-k="' + k + '" data-c="' + c + '" data-v="-1" aria-label="' + esc(x.n + (cs.length > 1 ? ' ' + c.toUpperCase() : '') + ' : moins') + '">−</button><label class="rval"><input class="rnb" id="pr-r-' + k + '-' + c + '" inputmode="decimal" data-s="r" data-k="' + k + '" data-c="' + c + '" value="' + nf1(t[c]) + '" aria-label="' + esc(x.n + (cs.length > 1 ? ' ' + c.toUpperCase() : '') + ', la valeur') + '"><small>' + esc(uniteR(x)) + '</small></label><button data-a="r-pas" data-k="' + k + '" data-c="' + c + '" data-v="1" aria-label="' + esc(x.n + (cs.length > 1 ? ' ' + c.toUpperCase() : '') + ' : plus') + '">+</button></div>'; }).join('');
    return h + '<div class="rinc">' + (x.u === '°' ? '<button data-a="r-inc" data-k="' + k + '">' + TEL + 'Inclinomètre du téléphone</button>' : '') + '<button class="prim" data-a="r-ok" data-k="' + k + '">C’est noté</button></div>'; }
  if (x.y === 'pm') return cs.map(function (c) { var w = v && typeof v === 'object' ? v[c] : ''; return '<div class="rpm' + (cs.length > 1 ? ' cote' : '') + '">' + (cs.length > 1 ? '<em>' + c + '</em>' : '') + '<button class="p" data-a="r-pm" data-k="' + k + '" data-c="' + c + '" data-v="pos" aria-pressed="' + (w === 'pos') + '">+<small>positif, douleur connue</small></button><button class="m" data-a="r-pm" data-k="' + k + '" data-c="' + c + '" data-v="neg" aria-pressed="' + (w === 'neg') + '">−<small>négatif</small></button></div>'; }).join('');
  if (x.y === 'hyp') return '<div class="rpm">' + HYP_R.map(function (o) { return '<button data-a="r-choix" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + '<small>' + o[2] + '</small></button>'; }).join('') + '</div>';
  if (x.y === 'obj') return '<div class="rpm r3">' + OBJ_R.map(function (o) { return '<button data-a="r-choix" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  return '<div class="rmac"><span>' + esc(x.y === 'pat' ? 'Un questionnaire : le patient le remplit sur son téléphone.' : x.f2 || 'Se mesure au Mac.') + '</span><button data-a="r-choix" data-k="' + k + '" data-v="1" aria-pressed="' + (v === 1) + '">' + (x.y === 'pat' ? 'À envoyer au patient' : 'À faire au Mac') + '</button></div>'; }
function resR(x, k) { var v = S.r[k], e = ecartR(x, v), loin = aillR(x);
  return '<button class="rres" data-a="r-rouvrir" data-k="' + k + '" aria-label="' + esc(x.n + ' : ' + valTxtR(x, v) + '. Toucher pour changer') + '"><span class="' + (loin ? 'rail' : 'rok') + '" aria-hidden="true">' + (loin ? '↗' : '✓') + '</span><b>' + esc(x.n) + '</b><em>' + esc(valTxtR(x, v)) + '</em>' + (e ? '<i class="' + e[0] + '">' + esc(e[1]) + '</i>' : '') + '</button>'; }
function carteR(x, k) { var rangee = faiteR(k) && V.ouvre !== k;
  return '<section class="rc' + (rangee ? ' range' : '') + (V.vient === k ? ' vient' : '') + '" id="pr-r-' + k + '" data-y="' + x.y + '">' + (rangee ? resR(x, k) : '<h2>' + esc(x.n) + '</h2>' + avantR(x) + corpsR(x, k)) + '</section>'; }
function piedR() { var c = comptesR(), reste = c.tot - c.n, rien = !c.n && !S.dec && !S.n.trim();
  return '<footer class="rpied" id="pr-pied"><p><b id="pr-p1">' + (c.n ? pl(c.m, 'mesurée') + (c.a ? ' · ' + c.a + ' pour plus tard' : '') : 'Rien de noté') + '</b><span id="pr-p2">' + (!c.n ? 'Ce que vous ne touchez pas reste comme avant.' : reste ? reste + ' pas touchée' + (reste > 1 ? 's' : '') + ' : comme avant.' : 'Tout est passé en revue.') + '</span></p>'
    + '<button class="btn" id="pr-renvoyer" data-a="renvoyer"' + (rien ? ' disabled' : '') + '>Renvoyer au Mac</button></footer>'; }
function rendreR(garde) { var y = window.scrollY, c = comptesR(), f0 = null, h = '';
  B.R.forEach(function (x, k) { if (x.f !== f0) { f0 = x.f; h += '<div class="gt rf">' + esc(x.f) + '</div>'; } h += carteR(x, k); });
  if (!B.sd) h += '<div class="gt rf">Et maintenant</div><section class="rc rdec" id="pr-dec"><h2>On fait quoi ?</h2>' + (B.ph ? '<div class="rav"><span>' + esc(B.ph) + '</span></div>' : '')
    + '<div class="rchoix">' + DEC_R.map(function (o) { return '<button data-a="r-dec" data-v="' + o[0] + '" aria-pressed="' + (S.dec === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>'
    + '<div class="rnote"><textarea id="pr-note" data-s="n" rows="2" maxlength="4000" placeholder="Une note, dictée ou tapée" aria-label="Note de la réévaluation">' + esc(S.n) + '</textarea><button class="micb" data-a="dicter" aria-label="Dicter la note">' + MICRO + '</button></div></section>';
  h += '<p class="rien">Rien ne part d’ici avant « Renvoyer au Mac ».</p><button class="btn rouge" id="pr-effacer" data-a="effacer">' + (V.efface ? 'Toucher encore pour tout effacer' : 'Effacer de ce téléphone') + '</button>';
  var f = V.feuille === 'inc' ? feuilleIncR() : V.feuille === 'retour' ? feuilleRetour() : '';
  app.className = 'rmode';
  app.innerHTML = '<header class="rtete"><div class="hp">' + LOGO + '<b>KINÉ</b><span>· praticien</span>' + (B.ini ? '<span class="pt" id="pr-qui">' + esc(B.ini) + (B.age != null ? ', ' + B.age + ' ans' : '') + '</span>' : '') + '</div>'
    + '<h1>' + esc(B.ti || 'Réévaluation rapide') + '</h1><p class="petit" id="pr-sous">' + esc(B.bl || B.rg) + ' · <b id="pr-n">' + c.n + '</b> sur ' + c.tot + '</p><div class="rbarre"><i style="width:' + (c.tot ? Math.round(100 * c.n / c.tot) : 0) + '%"></i></div></header>'
    + '<section id="pr-ecran" data-ecran="r">' + h + '</section>' + piedR()
    + (f ? '<div class="voile" data-a="' + (V.feuille === 'inc' ? 'inc-fermer' : 'fermer') + '"></div><div class="feuille" id="pr-feuille" role="dialog" aria-modal="true">' + f + '</div>' : '');
  V.vient = null; if (garde) window.scrollTo(0, y); else window.scrollTo(0, 0); }
/* la note tapée : le pied suit sans redessiner (le clavier reste ouvert) */
function majPiedR() { var p = document.getElementById('pr-pied'); if (p) p.outerHTML = piedR(); }
/* un choix : la carte se range ; la suivante remonte sous le pouce */
function choisirR(k, v) { S.r[k] = v; V.ouvre = null; V.vient = k; delete V.tmp[k]; garder(); rendreR(true); }
function clicR(a, el) { var k = Number(el.dataset.k), x = B.R[k], c = el.dataset.c, v = el.dataset.v;
  if (a === 'r-eva') { if (x) choisirR(k, Number(v)); }
  else if (a === 'r-pm') { if (!x || cotesR(x).indexOf(c) < 0) return true; var o = Object.assign({}, S.r[k] && typeof S.r[k] === 'object' ? S.r[k] : {}); o[c] = o[c] === v ? '' : v; S.r[k] = o;
    if (faiteR(k)) choisirR(k, o); else { garder(); rendreR(true); } }
  else if (a === 'r-pas') { var t = V.tmp[k]; if (!x || !t || cotesR(x).indexOf(c) < 0) return true; t[c] = Math.round((t[c] + Number(v) * (x.u === 'cm' || x.u === 'kg' ? 0.5 : 1)) * 10) / 10; var out = document.getElementById('pr-r-' + k + '-' + c); if (out) out.value = nf1(t[c]); }
  else if (a === 'r-ok') { if (x && V.tmp[k]) choisirR(k, Object.assign({}, V.tmp[k])); }
  else if (a === 'r-choix') { if (!x) return true; var w = x.y === 'mac' || x.y === 'pat' ? 1 : v; if (S.r[k] === w && V.ouvre === k) { delete S.r[k]; V.ouvre = null; garder(); rendreR(true); } else choisirR(k, w); }
  else if (a === 'r-rouvrir') { V.ouvre = k; rendreR(true); }
  else if (a === 'r-dec') { S.dec = S.dec === v ? '' : v; garder(); rendreR(true); }
  else if (a === 'r-inc') incOuvrirR(k);
  else if (a === 'inc-cote' && V.inc && V.inc.r) { if (cotesR(B.R[V.inc.i]).indexOf(v) >= 0) { V.inc.c = v; rendre(true); } }
  else if (a === 'inc-garder' && V.inc && V.inc.r) garderIncR();
  else return false;
  return true; }
/* l'inclinomètre d'une amplitude : le même que celui de l'examen ; « Garder » pose l'angle dans la carte, « C'est noté » le range */
function incOuvrirR(k) { var x = B.R[k]; if (!x || x.y !== 'num') return; var cs = cotesR(x);
  V.inc = {r: 1, i: k, c: cs[0], g0: null, g: null, ang: null, etat: 'attente'}; V.feuille = 'inc';
  var DO = window.DeviceOrientationEvent;
  if (!DO) V.inc.etat = 'absent';
  else if (typeof DO.requestPermission === 'function') { var d = V.inc; try { DO.requestPermission().then(function (r) { if (V.inc !== d) return; if (r === 'granted') incEcouter(); else { d.etat = 'refuse'; rendre(true); } }, function () { if (V.inc === d) { d.etat = 'refuse'; rendre(true); } }); } catch (z) { d.etat = 'refuse'; } }
  else incEcouter();
  rendre(true); }
function feuilleIncR() { var d = V.inc, x = B.R[d.i], cs = cotesR(x), ang = d.ang == null ? null : Math.round(d.ang), arc = ang == null ? 100 : 100 - Math.min(180, ang) / 180 * 100;
  var h = '<h1>Inclinomètre</h1><p class="gros"><b>' + esc(x.n) + '</b>. Posez le téléphone sur le segment, au départ du mouvement : <b>Zéro</b>. Puis allez au bout du mouvement.</p>';
  if (cs.length > 1) h += '<div class="cibles" id="pr-inc-cote">' + cs.map(function (c) { return '<button data-a="inc-cote" data-v="' + c + '" aria-pressed="' + (d.c === c) + '">' + (c === 'g' ? 'Gauche' : 'Droite') + '</button>'; }).join('') + '</div>';
  if (d.etat === 'refuse' || d.etat === 'absent') return h + '<p class="err" id="pr-inc-repli" role="status">' + (d.etat === 'refuse' ? 'Le capteur de mouvement est refusé sur ce téléphone.' : 'Ce téléphone ne donne pas son inclinaison.') + '</p><p class="gros">Réglez la valeur avec − et + sur la carte.</p><button class="btn" data-a="inc-fermer">Terminé</button>';
  return h + '<svg class="jauge" viewBox="0 0 220 130" aria-hidden="true"><path class="fd" d="M20 115a90 90 0 0 1 180 0" fill="none" stroke-width="10" stroke-linecap="round"/><path class="arc" id="pr-inc-arc" d="M20 115a90 90 0 0 1 180 0" fill="none" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="' + arc.toFixed(1) + '"/><g class="aig" id="pr-inc-aig" style="transform:rotate(' + (ang || 0) + 'deg)"><path d="M110 115L28 115" stroke-width="4" stroke-linecap="round"/></g><circle class="axe" cx="110" cy="115" r="8"/></svg>'
    + '<div class="ang"><b id="pr-inc-ang">' + (ang == null ? '—' : ang + '°') + '</b><span id="pr-inc-etat">' + (d.etat === 'attente' ? 'en attente du capteur…' : esc(x.n.toLowerCase()) + (cs.length > 1 ? ' · ' + d.c.toUpperCase() : '')) + '</span></div>'
    + '<button class="btn okb" id="pr-inc-garder" data-a="inc-garder"' + (ang == null ? ' disabled' : '') + '>' + COCHE + '<span id="pr-inc-garder-t">Garder ' + (ang == null ? '' : ang + '°') + '</span></button>'
    + '<div class="duo"><button class="btn sec" data-a="inc-zero"' + (ang == null ? ' disabled' : '') + ' id="pr-inc-zero">Zéro</button><button class="btn sec" data-a="inc-fermer">Annuler</button></div>'; }
function garderIncR() { var d = V.inc, x = d && B.R[d.i]; if (!x || d.ang == null) return; var t = V.tmp[d.i] = V.tmp[d.i] || {}; cotesR(x).forEach(function (c) { if (t[c] == null) t[c] = x.a != null ? x.a : 0; }); t[d.c] = Math.round(d.ang); incFermer(); }
function objetRetourR() { var o = {e: B.e, t: 'x', pv: VERSION_PRATICIEN, m: 'r', d: auj(), h: Date.now(), R: []};
  B.R.forEach(function (x, k) { if (faiteR(k)) o.R.push([x.i, S.r[k]]); });
  if (S.dec) o.dec = S.dec; if (S.n.trim()) o.n = S.n.trim().slice(0, 4000);
  return o; }
function relectureR() { var l = [];
  B.R.forEach(function (x, k) { if (!faiteR(k)) return; var e = ecartR(x, S.r[k]); l.push('<li><span>' + esc(x.n) + '</span><em>' + esc(valTxtR(x, S.r[k])) + '</em>' + (e ? '<i class="' + e[0] + '">' + esc(e[1]) + '</i>' : '') + '</li>'); });
  var dec = DEC_R.filter(function (o) { return o[0] === S.dec; })[0];
  if (!B.sd) l.push('<li><span>Décision</span><em>' + esc(dec ? dec[1] : 'pas de décision notée') + '</em></li>'); if (S.n.trim()) l.push('<li class="rln"><span>Note</span><em>' + esc(S.n.trim()) + '</em></li>');
  return '<ul class="rrel" id="pr-relecture">' + l.join('') + '</ul>'; }

/* ===== 2.5, lot J : la tablette (l'iPad du cabinet, réflexion du 24/11, point 1) =====
   La même page, les mêmes données, le même retour : sur un grand écran (au moins 700 × 600), tout en plus grand ; en paysage (au moins 1 000 de large),
   les trois écrans côte à côte, sans onglets : les tests à gauche (G et D en colonnes), les amplitudes, le chrono, la note et l'envoi à droite. Pas
   d'inclinomètre sur l'iPad (écarté le 24/11). Tourner l'iPad change la forme sans rien perdre (la saisie est gardée à chaque geste). */
var L25J_FORME = null;
function l25jForme() { var w = window.innerWidth || 0, h = window.innerHeight || 0; return w >= 700 && h >= 600 ? (w >= 1000 && w > h ? 'pay' : 'tab') : 'tel'; }
function l25jClasse() { var f = L25J_FORME = l25jForme(), r = document.documentElement.classList; r.toggle('l25j-tab', f !== 'tel'); r.toggle('l25j-pay', f === 'pay'); return f; }
function l25jIci() { return (L25J_FORME || l25jForme()) === 'tel' ? 'ce téléphone' : 'cet iPad'; }
function l25jMaj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function l25jColonnes() { return '<section id="pr-ecran" data-ecran="tout" class="l25j-cols"><div class="l25j-g" id="l25j-g">' + ecranTests() + '</div><div class="l25j-d" id="l25j-d">' + ecranAmpl() + ecranNote() + '</div></section>'; }
/* le point 2 : le schéma des douleurs au doigt, sur l'iPad (« Examen » | « Douleurs ») : le dessin du corps de KINÉ (corps.js, écrit par
   outils/l25j_corps.py : mêmes zones, mêmes codes), le type de douleur choisi puis les zones touchées ; toucher encore une zone du même type la retire.
   Le retour : Z = [[code, type]], rangé au Mac dans les zones du bilan. corps.js n'est chargé qu'à la première ouverture (le téléphone ne le charge jamais). */
var L25J_CHARGE = 0;
function l25jVues() { var n = Object.keys(S.z || {}).length;
  return '<div class="l25j-vues" role="tablist" id="l25j-vues"><button role="tab" data-a="l25j-vue" data-v="ex" aria-selected="' + (V.l25jVue !== 'dl') + '">Examen</button><button role="tab" id="l25j-vue-dl" data-a="l25j-vue" data-v="dl" aria-selected="' + (V.l25jVue === 'dl') + '">Douleurs<small>' + (n ? pl(n, 'zone') : 'schéma') + '</small></button></div>'; }
function l25jCharger() { if (L25J_CHARGE) return; L25J_CHARGE = 1; var sc = document.createElement('script'); sc.src = 'corps.js';
  sc.onload = function () { L25J_CHARGE = window.CorpsTel ? 2 : 3; if (B) rendre(true); }; sc.onerror = function () { L25J_CHARGE = 3; if (B) rendre(true); }; document.head.appendChild(sc); }
var l25jC = function () { var C = window.CorpsTel; return C && Array.isArray(C.zones) && Array.isArray(C.types) ? C : null; };
function l25jNom(k) { var C = l25jC(), z = C && C.zones.filter(function (x) { return x[0] === k; })[0]; return z ? z[1] + ', ' + z[2] : k; }
function l25jCouleur(t) { var C = l25jC(), i = C ? C.types.map(function (x) { return x[0]; }).indexOf(t) : -1; return i >= 0 ? 'var(--t' + (i + 1) + ')' : 'var(--tq)'; }
function l25jSvg() { var C = l25jC(), z = S.z || {};
  var h = '<svg viewBox="0 0 1296 1216" class="l25j-corps" id="l25j-corps" role="img" aria-label="Schéma des douleurs, face et dos"><defs><mask id="l25j-m" maskUnits="userSpaceOnUse" x="0" y="0" width="1296" height="1216"><path d="' + C.masque + '" fill="#FFFFFF"/></mask></defs>'
    + '<g mask="url(#l25j-m)"><rect class="l25j-fond" width="1296" height="1216"/><image class="l25j-img" href="' + C.img + '" width="1296" height="1216" preserveAspectRatio="none"/>';
  C.zones.forEach(function (x) { var t = z[x[0]]; h += '<path d="' + x[3] + '" class="l25j-z' + (t != null ? ' note' : '') + '"' + (t != null ? ' style="fill:' + l25jCouleur(t) + '"' : '') + ' data-a="l25j-zone" data-v="' + esc(x[0]) + '"><title>' + esc(x[1] + ', ' + x[2]) + '</title></path>'; });
  h += '</g><path class="l25j-bord" d="' + C.masque + '"/><g class="l25j-lims">' + C.limites.map(function (d) { return '<path d="' + d + '"/>'; }).join('') + '</g>';
  return h + '<g class="l25j-lab" aria-hidden="true"><text x="390" y="1196" text-anchor="middle">Face</text><text x="250" y="1196" text-anchor="middle">D</text><text x="530" y="1196" text-anchor="middle">G</text><text x="902" y="1196" text-anchor="middle">Dos</text><text x="762" y="1196" text-anchor="middle">G</text><text x="1042" y="1196" text-anchor="middle">D</text></g></svg>'; }
function l25jDouleurs() { var C = l25jC();
  if (!C) { l25jCharger(); return '<section id="pr-ecran" data-ecran="dl"><h1>Douleurs</h1><p class="' + (L25J_CHARGE === 3 ? 'err' : 'petit') + '" id="l25j-attente">' + (L25J_CHARGE === 3 ? 'Le schéma n’a pas pu s’ouvrir : rechargez la page.' : 'Ouverture du schéma…') + '</p></section>'; }
  var ty = V.l25jType || C.types[0][0], z = S.z || {}, l = Object.keys(z);
  var pal = C.types.map(function (x, i) { return '<button data-a="l25j-type" data-v="' + esc(x[0]) + '" aria-pressed="' + (ty === x[0]) + '"><i style="background:var(--t' + (i + 1) + ')"></i>' + esc(x[1]) + '</button>'; }).join('');
  var li = l.length ? '<ul class="l25j-liste" id="l25j-liste">' + l.map(function (k) { var t = C.types.filter(function (x) { return x[0] === z[k]; })[0]; return '<li><i style="background:' + l25jCouleur(z[k]) + '"></i><span>' + esc(l25jNom(k)) + '<small>' + esc(t ? t[1] : 'sans type') + '</small></span><button data-a="l25j-oter" data-v="' + esc(k) + '" aria-label="' + esc('Retirer ' + l25jNom(k)) + '">Retirer</button></li>'; }).join('') + '</ul>' : '<p class="petit" id="l25j-aucune">Aucune zone touchée.</p>';
  return '<section id="pr-ecran" data-ecran="dl" class="l25j-dl"><div class="l25j-sch">' + l25jSvg() + '</div><div class="l25j-pan"><h1>Douleurs</h1><p class="petit">Choisissez le type, puis touchez les zones ; toucher encore une zone la retire.</p>'
    + '<div class="l25j-types" id="l25j-types" role="group" aria-label="Type de douleur">' + pal + '</div><h2>' + (l.length ? pl(l.length, 'zone') + ' notée' + (l.length > 1 ? 's' : '') : 'Les zones') + '</h2>' + li
    + '<button class="btn sec" data-a="l25j-vue" data-v="ex">Retour à l’examen</button><p class="rien">Les zones partent au Mac avec « Renvoyer au Mac » ; il les range dans le schéma du bilan.</p></div></section>'; }
function l25jZonesRetour() { var z = S && S.z || {}; return Object.keys(z).slice(0, 94).map(function (k) { return [k, typeof z[k] === 'string' ? z[k] : '']; }); }
window.addEventListener('resize', function () { if (!B || L25J_FORME === null || l25jForme() === L25J_FORME) return; var a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return; rendre(true); });

/* --- les touches --- */
app.addEventListener('click', function (ev) { var el = ev.target.closest ? ev.target.closest('[data-a]') : null; if (!el || !B) return; var a = el.dataset.a, i = Number(el.dataset.i), c = el.dataset.c, v = el.dataset.v;
  if (a !== 'effacer' && V.efface === 1) V.efface = 0;
  if (B.m === 'r' && clicR(a, el)) return;   /* 2.5, lot H : la réévaluation rapide */
  if (a === 'ecran') { V.ecran = Number(v) || 1; V.feuille = null; rendre(); }
  else if (a === 'res') { if (!B.T[i] || cotesT(B.T[i]).indexOf(c) < 0) return; var r = S.r[i] = S.r[i] || {}; r[c] = r[c] === v ? '' : v; garder(); rendre(true); var b = document.querySelector('#pr-t-' + i + ' button[data-c="' + c + '"][aria-pressed=true]'); if (b) b.classList.add('pop'); }
  else if (a === 'chrono-test') { var cs = B.T[i] ? cotesT(B.T[i]) : [], libre = cs.find(function (k) { return !propre((S.v[i] || {})[k]); }) || cs[0]; if (!libre) return; V.chr.cible = 't' + i + ':' + libre; V.ecran = 2; rendre(); var z = document.getElementById('pr-chrono'); if (z && z.scrollIntoView) z.scrollIntoView({block: 'center'}); }
  else if (a === 'inc') incOuvrir(i);
  else if (a === 'inc-cote') { if (V.inc && cotesA(B.A[V.inc.i]).indexOf(v) >= 0) { V.inc.c = v; rendre(true); } }
  else if (a === 'inc-zero') { if (V.inc && V.inc.g) { V.inc.g0 = V.inc.g; V.inc.ang = 0; rendre(true); } }
  else if (a === 'inc-garder') { var d = V.inc; if (!d || d.ang == null) return; var o = S.a[d.i] = S.a[d.i] || {}; o[d.c] = String(Math.round(d.ang)); o['m' + d.c] = 1; garder(); incFermer(); }
  else if (a === 'inc-fermer') incFermer();
  else if (a === 'chrono') chrono();
  else if (a === 'cible') { V.chr.cible = v; rendre(true); }
  else if (a === 'chrono-oter') { S.c = S.c.filter(function (x, k) { return k !== i; }); garder(); rendre(true); }
  else if (a === 'dicter') { var t = document.getElementById('pr-note'); if (t) { t.focus(); try { t.setSelectionRange(t.value.length, t.value.length); } catch (z2) { /* sans curseur */ } } }
  else if (a === 'renvoyer') renvoyer();
  else if (a === 'copier') copier();
  else if (a === 'partager') { if (V.code && V.code.code && navigator.share) navigator.share({text: V.code.code}).catch(function () {}); }
  else if (a === 'fermer') { V.feuille = null; V.msg = ''; rendre(true); }
  else if (a === 'effacer') effacer();
  else if (a === 'l25j-vue') { V.l25jVue = v === 'dl' ? 'dl' : 'ex'; V.feuille = null; rendre(); }
  else if (a === 'l25j-type') { V.l25jType = v; rendre(true); }
  else if (a === 'l25j-zone' || a === 'l25j-oter') { var C = l25jC(); if (!C || !C.zones.some(function (x) { return x[0] === v; })) return; S.z = S.z || {}; var ty = V.l25jType || C.types[0][0];
    if (a === 'l25j-oter' || S.z[v] === ty) delete S.z[v]; else S.z[v] = ty; garder(); rendre(true); }
});
/* une valeur tapée : gardée sans redessiner (le clavier reste ouvert) */
app.addEventListener('input', function (ev) { var t = ev.target; if (!B || !t || !t.dataset || !t.dataset.s) return; var k = t.dataset.s, i = Number(t.dataset.i), c = t.dataset.c;
  if (k === 'r' && B.m === 'r') { var kr = Number(t.dataset.k), xr = B.R[kr], z = Number(String(t.value).replace(/[−–]/g, '-').replace(',', '.')); if (xr && V.tmp[kr] && cotesR(xr).indexOf(c) >= 0 && String(t.value).trim() !== '' && Number.isFinite(z)) V.tmp[kr][c] = z; return; }   /* 2.5, lot H : la valeur tapée d'une carte */
  if (k === 'n') S.n = String(t.value).slice(0, 4000);
  else if (k === 'v' && B.T[i] && cotesT(B.T[i]).indexOf(c) >= 0) (S.v[i] = S.v[i] || {})[c] = propre(t.value);
  else if (k === 'a' && B.A[i] && cotesA(B.A[i]).indexOf(c) >= 0) { var o = S.a[i] = S.a[i] || {}; o[c] = propre(t.value); if (o['m' + c]) { delete o['m' + c]; var m = t.parentElement && t.parentElement.querySelector('small'); if (m) m.remove(); } }
  else return;
  garder(); majComptes(); });

/* --- l'ouverture --- */
function dire(titre, texte) { app.className = ''; app.innerHTML = '<div class="hp">' + LOGO + '<b>KINÉ</b><span>· praticien</span></div><h1 id="pr-msg">' + esc(titre) + '</h1><p>' + esc(texte) + '</p>'; }
function ouvrir() { var h = location.hash;
  if (typeof Codec !== 'object' || typeof QR !== 'object') { dire('Page incomplète', 'Rechargez la page : un de ses fichiers n’est pas arrivé.'); return; }
  if (!h || h === '#') { dire('Le téléphone du praticien', 'Cette page s’ouvre depuis KINÉ, au Mac : dans le dossier, « ⋯ » puis « Sur mon téléphone », et visez le QR code. Elle ne garde rien.'); return; }
  Codec.lireAller(h).then(function (o) { var b = lireBillet(o);
    if (!b) { dire('Ce lien n’est pas un examen', 'Reprenez le QR code au Mac : dossier, « ⋯ », « Sur mon téléphone ».'); return; }
    if (Number(o.pv) > VERSION_PRATICIEN) { dire('Cette page doit être mise à jour', 'Le Mac envoie un examen plus récent que cette page : rechargez-la, ou redéposez le dossier telephone/ de KINÉ.'); return; }
    B = b; V.tmp = {}; V.ouvre = null; S = relire(); V.ecran = 1; V.l25jVue = 'ex'; rendre(); },
  function (z) { dire(z && z.message === 'ancien' ? 'Téléphone trop ancien' : 'Lien illisible', z && z.message === 'ancien' ? 'Ce navigateur ne sait pas ouvrir ce lien : mettez le téléphone à jour.' : 'Le lien est abîmé ou incomplet : reprenez le QR code au Mac.'); }); }
window.addEventListener('hashchange', function () { if (V.efface !== 2 || location.hash.length > 1) { V.efface = 0; ouvrir(); } });
try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (z) { /* sans copie hors connexion */ }
ouvrir();
})();

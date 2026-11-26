/* Lecteur « Mon kiné » : garde les fichiers de la page pour l'ouvrir sans connexion.
   Le réseau d'abord (une mise à jour passe tout de suite) ; version 6 (R10) : s'il ne répond pas en trois secondes (la salle, un mauvais réseau), la copie
   gardée sert tout de suite, et la réponse du réseau, quand elle arrive, remplace la copie pour la fois suivante.
   Rien d'autre que les fichiers de cette page : ce qui suit le « # » du lien n'est jamais demandé au réseau. Le numéro du cache suit la version de la page. */
var CACHE = 'lecteur-13';   /* version 13 (2.6, lot E1 : le téléphone homogène, les encarts, la police Source Sans 3 en fichiers) ; version 12 (2.3.3 : sauter tout l'exercice, corriger une séance enregistrée) ; version 11 (2.3.2 : l'icône au logo de KINÉ, « Je ne la ferai pas ») ; version 10 (2.3.1 : l'icône garde le lien) ; version 9 (2.3, T14) */
var FICHIERS = ['./', 'index.html', 'commun.js', 'pictos.js', 'fiches.js', 'icone.png', 'manifeste.webmanifest', 'source-sans-3-400.woff2', 'source-sans-3-600.woff2', 'source-sans-3-700.woff2'];
var ATTENTE = 3000;
self.addEventListener('install', function (ev) { ev.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(FICHIERS.map(function (f) { return c.add(f).catch(function () {}); })); }).catch(function () {})); self.skipWaiting(); });
self.addEventListener('activate', function (ev) { ev.waitUntil(caches.keys().then(function (l) { return Promise.all(l.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
function gardee(r) { return caches.match(r, {ignoreSearch: true}).then(function (x) { return x || (r.mode === 'navigate' ? caches.match('index.html') : undefined); }); }
self.addEventListener('fetch', function (ev) { var r = ev.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  ev.respondWith(new Promise(function (rendre) { var fait = false, donner = function (x) { if (!fait && x) { fait = true; rendre(x); } };
    var minuteur = setTimeout(function () { gardee(r).then(donner); }, ATTENTE);
    fetch(r).then(function (rep) { if (rep && rep.ok) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(r, copie); }); } clearTimeout(minuteur); donner(rep); })
      .catch(function () { clearTimeout(minuteur); gardee(r).then(function (x) { donner(x || Response.error()); }); }); })); });

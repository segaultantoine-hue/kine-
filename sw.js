/* Lecteur « Mon kiné » : garde les fichiers de la page pour l'ouvrir sans connexion.
   Le réseau d'abord (une mise à jour passe tout de suite), la copie gardée seulement si le réseau manque.
   Rien d'autre que les fichiers de cette page : ce qui suit le « # » du lien n'est jamais demandé au réseau. */
var CACHE = 'lecteur-3';
var FICHIERS = ['./', 'index.html', 'commun.js', 'pictos.js'];
self.addEventListener('install', function (ev) { ev.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).catch(function () {})); self.skipWaiting(); });
self.addEventListener('activate', function (ev) { ev.waitUntil(caches.keys().then(function (l) { return Promise.all(l.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (ev) { var r = ev.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  ev.respondWith(fetch(r).then(function (rep) { if (rep && rep.ok) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(r, copie); }); } return rep; })
    .catch(function () { return caches.match(r, {ignoreSearch: true}).then(function (x) { return x || caches.match('index.html'); }); })); });

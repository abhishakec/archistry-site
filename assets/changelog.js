/* Changelog page: renders releases.json (written at build time), then refreshes from the GitHub API
   so a new release shows up without waiting for a rebuild. */
(function () {
  'use strict';
  var REPO = 'abhishakec/archistry';
  var list = document.getElementById('rel-list');
  var status = document.getElementById('rel-status');
  var root = document.documentElement;

  /* theme + menu, same behaviour as the home page */
  var themeBtn = document.getElementById('theme');
  function themeLabel() { if (themeBtn) themeBtn.setAttribute('aria-label', 'Switch to ' + ((root.dataset.theme || 'light') === 'dark' ? 'light' : 'dark') + ' theme'); }
  themeLabel();
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = (root.dataset.theme || 'light') === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next; themeLabel();
    try { localStorage.setItem('archistry-theme', next); } catch (e) { /* storage can be blocked */ }
  });
  var menuBtn = document.querySelector('.menu-btn'), links = document.getElementById('nav-links');
  if (menuBtn && links) {
    menuBtn.addEventListener('click', function () {
      var open = links.dataset.open === 'true';
      links.dataset.open = open ? 'false' : 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { links.dataset.open = 'false'; menuBtn.setAttribute('aria-expanded', 'false'); } });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* GitHub returns sanitised HTML. Drop the cover image and the heading that repeats the title. */
  function tidy(html, name) {
    var box = document.createElement('div');
    box.innerHTML = html;
    var cover = box.querySelector('p[align="center"]');
    if (cover && cover.querySelector('img') && !cover.textContent.trim()) cover.remove();
    var h = box.querySelector('h1, h2');
    if (h && h.textContent.trim().toLowerCase() === String(name).trim().toLowerCase()) h.remove();
    box.querySelectorAll('a[href]').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
    /* GitHub keeps the source's hard line wraps as <br>; let the text reflow instead */
    box.querySelectorAll('br').forEach(function (b) { if (!b.closest('pre')) b.replaceWith(document.createTextNode(' ')); });
    box.querySelectorAll('.anchor, .octicon').forEach(function (n) { n.remove(); });
    return box.innerHTML;
  }

  function render(rel) {
    if (!rel.length) {
      list.innerHTML = '<p class="rel__empty">No releases yet. <a href="https://github.com/' + REPO + '/releases">Check GitHub</a>.</p>';
      return;
    }
    var latestIdx = rel.findIndex(function (r) { return !r.prerelease; });
    list.innerHTML = rel.map(function (r, i) {
      var ver = String(r.tag).replace(/^v/i, '');
      var badges = (i === latestIdx ? '<span class="rel__badge rel__badge--latest">Latest</span>' : '') + (r.prerelease ? '<span class="rel__badge">Pre-release</span>' : '');
      return '<article class="rel" id="v' + esc(ver) + '">' +
        '<header class="rel__meta"><a class="rel__ver" href="#v' + esc(ver) + '">' + esc(ver) + '</a>' +
        '<time datetime="' + esc(r.date) + '">' + esc(fmtDate(r.date)) + '</time>' + badges + '</header>' +
        '<div class="rel__main"><h2>' + esc(r.name) + '</h2><div class="rel__body">' + tidy(r.html, r.name) + '</div>' +
        '<a class="rel__gh" href="' + esc(r.url) + '" target="_blank" rel="noopener">View release on GitHub <svg aria-hidden="true"><use href="#i-arrow"/></svg></a></div></article>';
    }).join('');
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }

  var baked = '';
  function show(rel) { var s = JSON.stringify(rel); if (s === baked) return; baked = s; render(rel); }

  fetch('releases.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    .then(function (rel) {
      if (rel.length) show(rel);
      /* live refresh: picks up a release published since the last build */
      return fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=100', { headers: { Accept: 'application/vnd.github.html+json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (rows) {
          show(rows.filter(function (r) { return !r.draft; }).map(function (r) {
            return { tag: r.tag_name, name: r.name || r.tag_name, date: r.published_at || r.created_at, url: r.html_url, prerelease: !!r.prerelease, html: r.body_html || '' };
          }));
        })
        .catch(function () { if (!rel.length) list.innerHTML = '<p class="rel__empty">The release list could not be loaded. <a href="https://github.com/' + REPO + '/releases">Read it on GitHub</a>.</p>'; });
    })
    .then(function () { if (status) status.hidden = true; });
})();

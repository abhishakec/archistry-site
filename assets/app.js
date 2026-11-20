/* Archistry site behaviour. Plain JS, no dependencies. Reads window.ARCHISTRY (site/data.js, generated).
   Respects prefers-reduced-motion: everything shows at once, nothing types or wipes. */
(function () {
  'use strict';
  var D = window.ARCHISTRY || { stages: [], types: [], engines: 11 };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var byName = {}; D.types.forEach(function (t) { byName[t.name] = t; });
  var label = function (n) {
    var s = n.replace(/-/g, ' '); s = s.charAt(0).toUpperCase() + s.slice(1);
    return s.replace(/\boauth\b/i, 'OAuth').replace(/\braci\b/i, 'RACI').replace(/\bdevops\b/i, 'DevOps').replace(/\bdata cloud\b/i, 'Data Cloud').replace(/\bflow logic\b/i, 'Flow logic');
  };
  var stageVar = function (s) { return 'var(--st-' + s.toLowerCase() + ')'; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

  /* typing helper: cancels the previous run when called again */
  function typer(el, done) {
    var token = 0;
    return function (text, speed) {
      var my = ++token;
      if (reduce) { el.textContent = text; if (done) done(); return; }
      el.textContent = '';
      var i = 0;
      (function step() {
        if (my !== token) return;
        el.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(step, speed || 16); else if (done) done();
      })();
    };
  }
  function wipe(el) { // clip-path reveal, restartable
    if (!el) return;
    el.classList.remove('is-in');
    if (reduce) return;
    void el.offsetWidth;
    requestAnimationFrame(function () { el.classList.add('is-in'); });
  }

  /* ---------- theme ---------- */
  var root = document.documentElement;
  var themeBtn = $('#theme');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var cur = root.dataset.theme || 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next; themeBtn.setAttribute('aria-label', 'Switch to ' + cur + ' theme');
    try { localStorage.setItem('archistry-theme', next); } catch (e) { /* storage can be blocked */ }
  });
  if (themeBtn) themeBtn.setAttribute('aria-label', 'Switch to ' + ((root.dataset.theme || 'light') === 'dark' ? 'light' : 'dark') + ' theme');

  /* ---------- nav ---------- */
  var menuBtn = $('.menu-btn'), links = $('#nav-links');
  function closeMenu() { if (links) links.dataset.open = 'false'; if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = links.dataset.open === 'true';
      links.dataset.open = open ? 'false' : 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }
  if ('IntersectionObserver' in window) {
    var navLinks = $$('.nav__links a[href^="#"]:not(.btn)');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + en.target.id || (en.target.id === 'metadata' && a.getAttribute('href') === '#gallery');
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main > section[id]').forEach(function (s) { io.observe(s); });
  }

  /* ---------- copy buttons ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy-from]');
    if (!b) return;
    var src = $(b.getAttribute('data-copy-from'));
    var text = src ? (src.dataset.plain || src.textContent) : '';
    var ok = function () {
      var span = $('span', b), old = span.textContent;
      b.dataset.done = 'true'; span.textContent = 'Copied';
      setTimeout(function () { b.dataset.done = 'false'; span.textContent = old; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (err) { /* nothing else to try */ }
      ta.remove();
    }
  });

  /* ---------- hero: window, chat box, typing, send, diagram, callouts with arrows ---------- */
  (function hero() {
    var vis = $('#hero-vis'); if (!vis) return;
    var frame = $('#hero-frame', vis), chat = $('.chat', vis), prompt = $('.prompt', vis), typed = $('#hero-typed'), shot = $('#hero-shot'), svg = $('.arrows', vis);
    var hots = [], callouts = $$('.callout', vis), full = typed.textContent, caret = $('.caret', vis), timers = [], paths = [];
    var NS = 'http://www.w3.org/2000/svg';
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

    /* arrows: a curve from each callout to its spot in the diagram (x and y are percent of the picture) */
    function layout() {
      if (getComputedStyle(svg).display === 'none') return;
      /* layout positions, not getBoundingClientRect: the window and callouts are still scaling in when this runs */
      function pos(el) { var x = 0, y = 0; while (el && el !== vis) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x: x, y: y }; }
      var img = $('img', shot), vr = { width: vis.offsetWidth, height: vis.offsetHeight }, ip = pos(img), iw = img.offsetWidth, ih = img.offsetHeight;
      var on = paths.length && paths[0].classList.contains('on');
      svg.setAttribute('viewBox', '0 0 ' + vr.width + ' ' + vr.height);
      svg.innerHTML = ''; paths = [];
      hots.forEach(function (h) { h.remove(); }); hots = [];
      var fp = pos(frame), fw = frame.offsetWidth, gy = fp.y, gh = ip.y - fp.y;
      var defs = document.createElementNS(NS, 'defs'), mk = document.createElementNS(NS, 'mask');
      mk.setAttribute('id', 'hero-gap'); mk.setAttribute('maskUnits', 'userSpaceOnUse'); mk.setAttribute('x', 0); mk.setAttribute('y', 0); mk.setAttribute('width', vr.width); mk.setAttribute('height', vr.height);
      var white = document.createElementNS(NS, 'rect'); white.setAttribute('width', vr.width); white.setAttribute('height', vr.height); white.setAttribute('fill', '#fff');
      var black = document.createElementNS(NS, 'rect'); black.setAttribute('x', fp.x); black.setAttribute('y', gy + 1); black.setAttribute('width', fw); black.setAttribute('height', gh - 1); black.setAttribute('fill', '#000');
      mk.appendChild(white); mk.appendChild(black); defs.appendChild(mk); svg.appendChild(defs);
      callouts.forEach(function (co, i) {
        var top = !!co.closest('.anat--top'), cp = pos(co), cw = co.offsetWidth, ch = co.offsetHeight;
        var x1 = cp.x + cw / 2, y1 = top ? cp.y + ch : cp.y;
        var tx = ip.x + iw * parseFloat(co.dataset.x) / 100, ty = ip.y + ih * parseFloat(co.dataset.y) / 100;
        var my = (y1 + ty) / 2, d = 'M' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + my + ', ' + tx + ' ' + my + ', ' + tx + ' ' + (ty + (top ? -9 : 9));
        var halo = document.createElementNS(NS, 'path'); halo.setAttribute('d', d); halo.setAttribute('pathLength', '1'); halo.setAttribute('class', 'halo');
        var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('pathLength', '1'); p.setAttribute('class', 'arrow');
        var ah = document.createElementNS(NS, 'path'); ah.setAttribute('class', 'ah');
        var dir = top ? 1 : -1; ah.setAttribute('d', 'M' + (tx - 6) + ' ' + (ty - 11 * dir) + ' L' + (tx + 6) + ' ' + (ty - 11 * dir) + ' L' + tx + ' ' + ty + ' Z');
        [halo, p, ah].forEach(function (n) { svg.appendChild(n); });
        paths.push(p, halo, ah);
        var hb = document.createElement('button'); hb.type = 'button'; hb.className = 'hot'; hb.style.setProperty('--i', i); hb.style.left = tx + 'px'; hb.style.top = ty + 'px';
        hb.setAttribute('aria-label', co.querySelector('b').textContent + ': ' + co.querySelector('span').textContent);
        ['mouseenter', 'focus'].forEach(function (ev) { hb.addEventListener(ev, function () { setCallout(i, true); }); });
        ['mouseleave', 'blur'].forEach(function (ev) { hb.addEventListener(ev, function () { setCallout(i, false); }); });
        vis.appendChild(hb); hots.push(hb);
        if (on || reduce) [halo, p, ah].forEach(function (n) { n.classList.add('on'); });
      });
    }
    function setCallout(i, on) {
      callouts[i].classList.toggle('on', on);
      var k = i * 3;
      [paths[k + 1], paths[k], paths[k + 2]].forEach(function (n) { if (n) n.classList.toggle('on', on); });
    }
    function showCallout(i) { setCallout(i, true); }
    function hotspots() { callouts.forEach(function (c2, i) { setCallout(i, false); }); vis.classList.add('is-hot'); }
    function reset() {
      timers.forEach(clearTimeout); timers = []; vis.classList.remove('is-hot');
      frame.classList.remove('is-on'); prompt.classList.remove('is-chat'); chat.classList.remove('is-typing', 'is-done', 'is-sent');
      shot.classList.remove('is-in'); callouts.forEach(function (c2) { c2.classList.remove('on'); });
      paths.forEach(function (n) { n.classList.remove('on'); });
      typed.textContent = ''; if (caret) caret.style.display = '';
    }
    function showAll() {
      frame.classList.add('is-on'); prompt.classList.add('is-chat'); chat.classList.add('is-done');
      typed.textContent = full; if (caret) caret.style.display = 'none'; shot.classList.add('is-in');
      callouts.forEach(function (c2) { c2.classList.add('on'); }); paths.forEach(function (n) { n.classList.add('on'); });
    }
    function play() {
      reset(); layout();
      if (reduce) { showAll(); later(hotspots, 2000); return; }
      later(function () { frame.classList.add('is-on'); }, 150);                         /* 1. the window appears */
      later(function () { prompt.classList.add('is-chat'); }, 900);                      /* 2. the user icon and the chat box */
      later(function () {                                                                /* 3. the request is typed */
        chat.classList.add('is-typing');
        var i = 0; (function step() { typed.textContent = full.slice(0, ++i); if (i < full.length) timers.push(setTimeout(step, 15)); })();
      }, 1500);
      var typedEnd = 1500 + full.length * 15 + 250;
      later(function () { chat.classList.remove('is-typing'); chat.classList.add('is-done', 'is-sent'); if (caret) caret.style.display = 'none'; }, typedEnd);   /* send */
      later(function () { shot.classList.add('is-in'); }, typedEnd + 450);               /* 4. the diagram appears */
      callouts.forEach(function (c2, i) { later(function () { showCallout(i); }, typedEnd + 1700 + i * 260); });   /* 5. the anatomy, box by box */
      later(hotspots, typedEnd + 1700 + callouts.length * 260 + 2000);                   /* 6. after 2 s the boxes hide, dots stay on the diagram */
    }
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    var again = $('#hero-replay'); if (again) again.addEventListener('click', play);
    play();
  })();

  /* ---------- try it ---------- */
  (function tryIt() {
    var list = $('#asks'); if (!list) return;
    var names = ['solution-architecture', 'data-model', 'agent-interaction-map', 'sequence', 'business-process', 'cutover-plan'].filter(function (n) { return byName[n]; });
    var text = $('#try-text'), sr = $('#try-sr'), img = $('#try-img'), shot = $('#try-shot'), cmd = $('#try-cmd'), files = $('#try-files');
    var touched = false;
    var type = typer(text, function () { wipe(shot); });
    list.innerHTML = names.map(function (n, i) {
      return '<button class="ask" type="button" role="radio" aria-checked="false" tabindex="-1" data-n="' + n + '"><span class="ask__n">' + (i + 1) + '</span>' + esc(label(n)) + '</button>';
    }).join('');
    var buttons = $$('.ask', list);
    function pick(n, animate) {
      var t = byName[n];
      buttons.forEach(function (b) { var on = b.dataset.n === n; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
      sr.textContent = t.ask;
      img.width = t.w; img.height = t.h; img.srcset = 'img/sm/' + n + '.png 800w, previews/' + n + '.png 1600w'; img.src = 'previews/' + n + '.png';
      img.alt = label(n) + ' diagram. ' + t.question;
      shot.href = 'examples/' + n + '.html'; shot.target = '_blank'; shot.rel = 'noopener';
      shot.setAttribute('aria-label', 'Open the ' + label(n).toLowerCase() + ' diagram as an interactive page (opens in a new tab)');
      cmd.innerHTML = '<span class="p">$</span> archistry build ' + n + '.json --format drawio,html,png\n<span class="c">  wrote ' + n + '.drawio, ' + n + '.html, ' + n + '.png</span>';
      cmd.dataset.plain = 'archistry build ' + n + '.json --format drawio,html,png';
      files.innerHTML = ['drawio', 'html', 'png'].map(function (x) { return '<span class="pill">' + n + '.' + x + '</span>'; }).join('');
      $('#try-open').href = 'examples/' + n + '.html';
      $('#try-spec').href = 'examples/' + n + '.json';
      if (animate) { shot.classList.remove('is-in'); type(t.ask, 11); } else { text.textContent = t.ask; shot.classList.add('is-in'); }
    }
    list.addEventListener('click', function (e) { var b = e.target.closest('.ask'); if (b) { touched = true; pick(b.dataset.n, true); } });
    list.addEventListener('keydown', function (e) {
      var i = buttons.findIndex(function (b) { return b === document.activeElement; });
      if (i < 0) return;
      var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      var nb = buttons[(i + d + buttons.length) % buttons.length];
      touched = true; nb.focus(); pick(nb.dataset.n, true);
    });
    pick(names[0], false);
    if ('IntersectionObserver' in window && !reduce) {
      var seen = new IntersectionObserver(function (en, o) {
        if (en[0].isIntersecting) { o.disconnect(); if (!touched) pick(names[0], true); }
      }, { threshold: 0.45 });
      seen.observe($('#try'));
    }
  })();

  /* ---------- explorer ---------- */
  (function explorer() {
    var stagesEl = $('#stages'); if (!stagesEl) return;
    var typesEl = $('#types'), q = $('#q');
    var st = { stage: 'Architect', name: 'solution-architecture', query: '', live: false };
    var counts = {}; D.types.forEach(function (t) { counts[t.stage] = (counts[t.stage] || 0) + 1; });

    stagesEl.innerHTML = D.stages.map(function (s) {
      return '<button class="tab" type="button" role="tab" data-s="' + s + '" aria-selected="false" tabindex="-1"><small>' + counts[s] + '</small> ' + s + '</button>';
    }).join('');

    function visible() {
      var qq = st.query.trim().toLowerCase();
      if (qq) return D.types.filter(function (t) { return (t.name + ' ' + t.question + ' ' + t.engine + ' ' + (t.aliases || []).join(' ')).toLowerCase().indexOf(qq) > -1; });
      return D.types.filter(function (t) { return t.stage === st.stage; });
    }
    function renderTabs() {
      $$('.tab', stagesEl).forEach(function (b) {
        var on = !st.query && b.dataset.s === st.stage;
        b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
      });
    }
    function renderList() {
      var items = visible();
      if (!items.length) { typesEl.innerHTML = '<p class="muted" style="padding:10px 12px">No type matches. Try ERD, OAuth or roadmap.</p>'; return; }
      if (!items.some(function (t) { return t.name === st.name; })) st.name = items[0].name;
      typesEl.innerHTML = items.map(function (t) {
        var on = t.name === st.name;
        return '<button class="type" type="button" role="option" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-n="' + t.name + '" style="--st:' + stageVar(t.stage) + '"><span class="type__dot"></span>' + esc(label(t.name)) + '</button>';
      }).join('');
    }
    function renderDetail() {
      var t = byName[st.name]; if (!t) return;
      $('#d-name').textContent = label(t.name);
      var pill = $('#d-stage'); pill.textContent = t.stage; pill.style.background = stageVar(t.stage);
      $('#d-q').textContent = t.question;
      $('#d-ask').textContent = '“' + t.ask + '”';
      $('#d-file').textContent = t.name + '.html';
      $('#d-open').href = 'examples/' + t.name + '.html';
      $('#d-drawio').href = 'examples/' + t.name + '.drawio';
      $('#d-spec').href = 'examples/' + t.name + '.json';
      var view = $('#d-view');
      $('#d-live').href = 'examples/' + t.name + '.html';
      {
        view.innerHTML = '<a class="shot shot--detail" href="examples/' + t.name + '.html" target="_blank" rel="noopener" aria-label="Open the ' + esc(label(t.name)).toLowerCase() + ' diagram live (opens in a new tab)"><img id="d-img" src="previews/' + t.name + '.png" srcset="img/sm/' + t.name + '.png 800w, previews/' + t.name + '.png 1600w" sizes="(max-width: 900px) 100vw, 920px" decoding="async" width="' + t.w + '" height="' + t.h + '" alt="' + esc(label(t.name)) + ' diagram. ' + esc(t.question) + '"></a>';
      }
    }
    function select(name, focus) {
      st.name = name; st.live = false;
      var t = byName[name]; if (!st.query) st.stage = t.stage;
      renderTabs(); renderList(); renderDetail();
      if (focus) { var b = $('.type[data-n="' + name + '"]', typesEl); if (b) b.focus(); }
    }
    stagesEl.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      st.query = ''; q.value = ''; st.stage = b.dataset.s;
      var first = D.types.filter(function (t) { return t.stage === st.stage; })[0];
      select(first.name, false);
    });
    stagesEl.addEventListener('keydown', function (e) {
      var tabs = $$('.tab', stagesEl), i = tabs.indexOf(document.activeElement);
      var d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (i < 0 || !d) return;
      e.preventDefault(); var nb = tabs[(i + d + tabs.length) % tabs.length]; nb.focus(); nb.click(); nb.focus();
    });
    typesEl.addEventListener('click', function (e) { var b = e.target.closest('.type'); if (b) select(b.dataset.n, false); });
    typesEl.addEventListener('keydown', function (e) {
      var items = $$('.type', typesEl), i = items.indexOf(document.activeElement);
      var d = { ArrowDown: 1, ArrowUp: -1 }[e.key]; if (i < 0 || !d) return;
      e.preventDefault(); select(items[(i + d + items.length) % items.length].dataset.n, true);
    });
    q.addEventListener('input', function () { st.query = q.value; renderTabs(); renderList(); st.live = false; renderDetail(); });
    renderTabs(); renderList(); renderDetail();
    $$('.tab', stagesEl).forEach(function (b) { if (b.dataset.s === st.stage) b.setAttribute('aria-selected', 'true'); });
  })();

  /* ---------- the editor iframe loads when it nears the screen ---------- */
  (function lazyFrame() {
    var f = $('#edit-frame'); if (!f || getComputedStyle(f).display === 'none') return;
    var load = function () { if (!f.src && f.dataset.src) f.src = f.dataset.src; };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en, o) { if (en[0].isIntersecting) { load(); o.disconnect(); } }, { rootMargin: '600px' }).observe(f);
    } else load();
  })();

  /* ---------- export command builder ---------- */
  (function builder() {
    var b = $('#builder'); if (!b) return;
    var s = { format: 'png', theme: 'light', scale: '2' };
    var cmd = $('#export-cmd'), tr = $('#transparent');
    function render() {
      var p = ['archistry export diagram.drawio'];
      if (s.format === 'all') p.push('--format png,jpg,svg'); else p.push('-o diagram.' + s.format);
      if (s.scale !== '2' && s.format !== 'svg') p.push('--scale ' + s.scale);
      if (s.theme === 'dark') p.push('--theme dark');
      var canTransparent = s.format === 'png' || s.format === 'svg' || s.format === 'all';
      tr.disabled = !canTransparent;
      if (!canTransparent) tr.checked = false;
      if (tr.checked) p.push('--transparent');
      var plain = p.join(' ');
      var shot = $('#export-shot'), pic = $('#export-img');
      var useT = tr.checked && canTransparent;
      pic.src = useT ? 'assets/export-transparent.png' : (s.theme === 'dark' ? 'assets/export-dark.png' : 'assets/export-light.png');
      shot.classList.toggle('checker', useT);
      shot.style.background = useT ? '' : (s.theme === 'dark' ? '#0f1220' : '#fff');
      $('#export-name').textContent = s.format === 'all' ? 'diagram.png · diagram.jpg · diagram.svg' : 'diagram.' + s.format + (s.scale !== '2' && s.format !== 'svg' ? ' · ' + s.scale + '×' : '');
      cmd.dataset.plain = plain;
      cmd.innerHTML = '<span class="p">$</span> ' + esc(plain).replace(/(--[a-z-]+|-o)/g, '<span class="c">$1</span>');
    }
    $$('[data-ctl]', b).forEach(function (g) {
      g.addEventListener('click', function (e) {
        var btn = e.target.closest('.tab'); if (!btn) return;
        s[g.dataset.ctl] = btn.dataset.v;
        $$('.tab', g).forEach(function (x) { x.setAttribute('aria-checked', x === btn); });
        render();
      });
    });
    tr.addEventListener('change', render);
    render();
  })();

  /* ---------- install tabs ---------- */
  (function install() {
    var tabs = $('#agents'); if (!tabs) return;
    var clone = 'git clone https://github.com/abhishakec/archistry.git';
    var up = '\n\n# Update to a new release\n';
    var agents = [
      { id: 'npx skills', note: 'Finds the agents on your machine (Claude Code, Copilot, Cursor, Gemini CLI, Codex and more) and installs for the ones you pick. Add -g to install for every project.', label: 'terminal', cmd: 'npx skills add abhishakec/archistry' + up + 'npx skills update' },
      { id: 'Claude Code', note: 'Put the folder in ~/.claude/skills for all projects, or in .claude/skills inside one project. It triggers on diagram requests.', label: 'terminal', cmd: clone + ' ~/.claude/skills/archistry\nnode ~/.claude/skills/archistry/scripts/archistry.mjs doctor' + up + 'git -C ~/.claude/skills/archistry pull' },
      { id: 'Desktop', note: 'Clone the folder, then add it as a skill. It triggers the same way.', label: 'terminal', cmd: clone + '\nnode archistry/scripts/archistry.mjs doctor' + up + 'git -C archistry pull' },
      { id: 'Copilot', note: 'Clone it into your repository and add one line to the Copilot instructions.', label: 'terminal', cmd: clone + ' archistry\necho "For any Salesforce diagram request, follow archistry/SKILL.md." >> .github/copilot-instructions.md' + up + 'git -C archistry pull' },
      { id: 'Cursor', note: 'Clone it and add a rule that points at SKILL.md.', label: 'terminal', cmd: clone + ' archistry\n# Cursor rule: "For any Salesforce diagram request, follow archistry/SKILL.md."' + up + 'git -C archistry pull' },
      { id: 'Gemini, Codex', note: 'Point the agent at SKILL.md. Any agent that can read files and run node can use it.', label: 'terminal', cmd: clone + ' archistry\nnode archistry/scripts/archistry.mjs doctor' + up + 'git -C archistry pull' }
    ];
    tabs.innerHTML = agents.map(function (a, i) { return '<button class="tab" type="button" role="tab" id="ag' + i + '" aria-selected="' + (i === 0) + '" aria-controls="agent-panel" tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(a.id) + '</button>'; }).join('');
    var panel = $('#agent-panel');
    function show(i) {
      var a = agents[i];
      $$('.tab', tabs).forEach(function (b, j) { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', 'ag' + i);
      $('#agent-note').textContent = a.note; $('#agent-label').textContent = a.label;
      var c = $('#agent-cmd'); c.dataset.plain = a.cmd;
      c.innerHTML = a.cmd.split('\n').map(function (l) { return l === '' ? '' : l.charAt(0) === '#' ? '<span class="c">' + esc(l) + '</span>' : '<span class="p">$</span> ' + esc(l); }).join('\n');
    }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) show($$('.tab', tabs).indexOf(b)); });
    tabs.addEventListener('keydown', function (e) {
      var all = $$('.tab', tabs), i = all.indexOf(document.activeElement), d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (i < 0 || !d) return; e.preventDefault(); var n = (i + d + all.length) % all.length; show(n); all[n].focus();
    });
    show(0);
  })();

  var eng = $('[data-engines]'); if (eng && D.engines) eng.textContent = D.engines;
})();

/* github icon: the useanimations "github" Lottie (MIT), looped while hovered or focused, finishing its cycle on leave */
(function () {
  var host = document.getElementById('gh-lottie'); if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var link = host.parentNode;
  function start() {
    if (!window.lottie) return;
    var a = window.lottie.loadAnimation({ container: host, renderer: 'svg', loop: false, autoplay: false, path: 'assets/github.json' });
    a.addEventListener('DOMLoaded', function () { var old = host.querySelector(':scope > svg:not([viewBox="0 0 32 32"])'); if (old) old.remove(); });
    var hovering = false;
    function go() { hovering = true; a.loop = true; a.play(); }
    function stop() { hovering = false; a.loop = false; }
    a.addEventListener('complete', function () { if (!hovering) a.goToAndStop(0, true); });
    link.addEventListener('mouseenter', go); link.addEventListener('focus', go); link.addEventListener('mouseleave', stop); link.addEventListener('blur', stop);
  }
  var s = document.createElement('script'); s.src = 'assets/vendor/lottie_light.min.js'; s.async = true; s.onload = start; document.head.appendChild(s);
})();

/* ---------- star count on the closing block (shown from 10 stars up) ---------- */
(function starCount() {
  var el = document.getElementById('star-n'); if (!el) return;
  function show(n) { if (n >= 10) { el.textContent = n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n); el.hidden = false; } }
  var cached = null;
  try { cached = JSON.parse(sessionStorage.getItem('archistry-stars') || 'null'); } catch (e) {}
  if (cached && Date.now() - cached.t < 36e5) { show(cached.n); return; }
  if (!window.fetch) return;
  fetch('https://api.github.com/repos/abhishakec/archistry', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.stargazers_count !== 'number') return;
      show(d.stargazers_count);
      try { sessionStorage.setItem('archistry-stars', JSON.stringify({ n: d.stargazers_count, t: Date.now() })); } catch (e) {}
    })
    .catch(function () {});
})();

/* what-you-get icons: useanimations Lottie icons (MIT), played once each time the card is hovered or focused */
(function () {
  var hosts = Array.prototype.slice.call(document.querySelectorAll('.what .ico[data-lottie]'));
  if (!hosts.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function start() {
    hosts.forEach(function (host) {
      var card = host.closest('.what'), fallback = host.querySelector('svg');
      var a = window.lottie.loadAnimation({ container: host, renderer: 'svg', loop: false, autoplay: false, path: 'assets/icons/' + host.dataset.lottie + '.json' });
      a.addEventListener('DOMLoaded', function () {
        if (fallback) fallback.remove();
        var s = host.querySelector('svg'); if (s) s.classList.add('lt');
      });
      a.addEventListener('complete', function () { a.goToAndStop(0, true); });
      function go() { a.goToAndPlay(0, true); }
      card.addEventListener('mouseenter', go);
      card.addEventListener('focusin', function (e) { if (!e.relatedTarget || !card.contains(e.relatedTarget)) go(); });
    });
  }
  function ready() {
    if (window.lottie) return start();
    var tag = document.querySelector('script[src*="lottie_light"]');
    if (!tag) { tag = document.createElement('script'); tag.src = 'assets/vendor/lottie_light.min.js'; tag.async = true; document.head.appendChild(tag); }
    tag.addEventListener('load', start);
  }
  ready();
})();

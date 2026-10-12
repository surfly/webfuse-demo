/* Start page for a personal Webfuse demo link.
 *
 * The link carries a token in ?t=: base64url(JSON payload) + "." + signature.
 * This page decodes the payload only to greet the visitor. It never checks
 * the signature; the start endpoint does that, counts the starts, and answers
 * with a session link. The visitor's click on "Start the demo" is what starts
 * a session, so link scanners that merely fetch the page start nothing.
 *
 * A short link (https://demo.webfuse.it/<id>) redirects here with ?c=<id>
 * instead. The page first trades the id for the token at the resolve
 * endpoint, which only looks it up, then carries on exactly as for ?t=.
 */
(function () {
  'use strict';

  var cfg = window.DEMO_CONFIG || {};
  var API_URL = cfg.API_URL || 'https://demo.webfuse.it/start';
  var RESOLVE_URL = cfg.RESOLVE_URL || 'https://demo.webfuse.it/resolve';
  var ALLOWED_PREFIX = cfg.ALLOWED_LINK_PREFIX || 'https://webfu.se/';
  var OWNER_EMAIL = cfg.OWNER_EMAIL || '';
  var OWNER_NAME = cfg.OWNER_NAME || '';
  var TIMEOUT_MS = cfg.TIMEOUT_MS || 25000;

  // Codes the endpoint may return that deserve their own page state. Every
  // other answer ("busy", "unavailable", HTTP errors, timeouts) means: retry.
  var FINAL_STATES = { expired: true, limit: true, invalid: true };

  var MAIL_REASONS = {
    incomplete: 'seems to be incomplete',
    expired: 'has expired',
    limit: 'has reached its start limit',
    invalid: 'is not working'
  };

  var token = readParam('t');
  var payload = token ? decodePayload(token) : null;
  // A short link's id, used only while there is no token yet.
  var shortCode = token ? '' : readCode();
  var current = null;
  var starting = false;
  var resolving = false;

  function readParam(name) {
    try {
      var v = new URLSearchParams(window.location.search).get(name);
      return v ? v.trim() : '';
    } catch (e) {
      return '';
    }
  }

  function readCode() {
    var c = readParam('c');
    return /^[A-Za-z0-9_-]{12}$/.test(c) ? c : '';
  }

  function bytesFromBase64url(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) {
      throw new Error('not base64url');
    }
    var b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) { b64 += '='; }
    var bin = window.atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    return bytes;
  }

  function clean(value, limit) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  // Display data only. Returns null when the payload cannot be read.
  function decodePayload(tok) {
    if (tok.length > 4096) { return null; }
    var parts = tok.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) { return null; }
    var data;
    try {
      var json = new TextDecoder('utf-8', { fatal: true }).decode(bytesFromBase64url(parts[0]));
      data = JSON.parse(json);
    } catch (e) {
      return null;
    }
    if (!data || typeof data !== 'object') { return null; }
    var name = clean(data.n, 60);
    var domain = clean(data.d, 253).toLowerCase();
    if (!name || !/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(domain) || typeof data.exp !== 'number') {
      return null;
    }
    return {
      firstName: name.split(' ')[0].slice(0, 40),
      company: clean(data.c, 80),
      domain: domain,
      linkId: clean(data.id, 40),
      exp: data.exp,
      // Which avatar the link starts: Arthur (Anam) when the token says so,
      // otherwise Victor (Tavus), as for every link minted before Arthur.
      agent: data.a === 'anam' ? 'Arthur' : 'Victor'
    };
  }

  function mailtoHref(reason) {
    if (!OWNER_EMAIL) { return null; }
    var lines = [
      (OWNER_NAME ? 'Hi ' + OWNER_NAME + ',' : 'Hi,'),
      '',
      'My Webfuse demo link ' + (MAIL_REASONS[reason] || 'is not working') +
        '. Could you send me a new one?',
      ''
    ];
    if (payload && payload.company) { lines.push('Company: ' + payload.company); }
    if (payload && payload.linkId) {
      lines.push('Link id: ' + payload.linkId);
    } else if (shortCode) {
      lines.push('Link id: ' + shortCode);
    }
    return 'mailto:' + OWNER_EMAIL +
      '?subject=' + encodeURIComponent('New Webfuse demo link') +
      '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function show(state, moveFocus) {
    document.body.setAttribute('data-state', state);
    current = state;
    var sections = document.querySelectorAll('.state');
    for (var i = 0; i < sections.length; i++) {
      var on = sections[i].getAttribute('data-state') === state;
      sections[i].hidden = !on;
      if (on && moveFocus) {
        var heading = sections[i].querySelector('.js-heading');
        if (heading) { heading.focus(); }
      }
    }
  }

  function setWorking(title, text) {
    document.getElementById('working-title').textContent = title;
    document.getElementById('working-text').textContent = text;
  }

  function allowedLink(link) {
    if (typeof link !== 'string' || link.indexOf(ALLOWED_PREFIX) !== 0) { return false; }
    try {
      var url = new URL(link);
      var allowed = new URL(ALLOWED_PREFIX);
      return url.protocol === 'https:' && url.origin === allowed.origin;
    } catch (e) {
      return false;
    }
  }

  // Accepts the endpoint's answer bare ({link} / {error}) or wrapped by the
  // server runtime ({run_id, result: {...}, error}).
  function interpret(status, body) {
    if (status < 200 || status >= 300 || !body || typeof body !== 'object') {
      return { state: 'busy' };
    }
    var inner = (body.result && typeof body.result === 'object') ? body.result : body;
    if (typeof inner.link === 'string') {
      return allowedLink(inner.link) ? { state: 'go', link: inner.link } : { state: 'busy' };
    }
    var code = typeof inner.error === 'string' ? inner.error : null;
    if (code && FINAL_STATES[code]) { return { state: code }; }
    return { state: 'busy' };
  }

  function start() {
    if (starting || !token) { return; }
    starting = true;
    setWorking('Starting your demo with ' + agentName() + '...', 'This takes a few seconds. Keep this tab open.');
    show('starting', true);

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) { ctrl.abort(); } }, TIMEOUT_MS);

    window.fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (resp) {
      return resp.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
        return interpret(resp.status, body);
      });
    }).then(null, function () {
      return { state: 'busy' };
    }).then(function (outcome) {
      window.clearTimeout(timer);
      if (outcome.state === 'go') {
        setWorking('Opening your session...', agentName() + ' will be waiting for you there.');
        window.location.assign(outcome.link);
        return;
      }
      starting = false;
      show(outcome.state, true);
    });
  }

  // Accepts the resolve endpoint's answer bare ({t} / {error}) or wrapped.
  function readResolved(status, body) {
    if (status < 200 || status >= 300 || !body || typeof body !== 'object') {
      return { state: 'busy' };
    }
    var inner = (body.result && typeof body.result === 'object') ? body.result : body;
    if (typeof inner.t === 'string' && inner.t.length <= 4096) { return { token: inner.t }; }
    var err = typeof inner.error === 'string' ? inner.error : null;
    if (err === 'invalid' || err === 'expired') { return { state: err }; }
    return { state: 'busy' };
  }

  // Trade a short link's id for its token, then carry on as for ?t=. The
  // lookup starts nothing, so it runs at once, for scanners too.
  function resolveCode() {
    if (resolving || !shortCode) { return; }
    resolving = true;
    setWorking('Opening your demo link...', 'This takes a moment.');
    show('starting', false);

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (ctrl) { ctrl.abort(); } }, TIMEOUT_MS);

    window.fetch(RESOLVE_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ c: shortCode }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (resp) {
      return resp.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
        return readResolved(resp.status, body);
      });
    }).then(null, function () {
      return { state: 'busy' };
    }).then(function (outcome) {
      window.clearTimeout(timer);
      resolving = false;
      if (outcome.token) {
        var decoded = decodePayload(outcome.token);
        if (decoded) {
          token = outcome.token;
          payload = decoded;
          fill();
          proceed();
          return;
        }
        outcome = { state: 'invalid' };
      }
      show(outcome.state, true);
    });
  }

  function retry() {
    if (!token && shortCode) { resolveCode(); } else { start(); }
  }

  function agentName() { return (payload && payload.agent) || 'Victor'; }

  function fill() {
    var agents = document.querySelectorAll('.js-agent');
    for (var a = 0; a < agents.length; a++) { agents[a].textContent = agentName(); }
    var initials = document.querySelectorAll('.js-agent-initial');
    for (var k = 0; k < initials.length; k++) { initials[k].textContent = agentName().charAt(0); }
    var name = payload && payload.firstName;
    document.getElementById('greeting').textContent = name ? 'Hi ' + name + '.' : 'Hi there.';
    var domains = document.querySelectorAll('.js-domain');
    for (var i = 0; i < domains.length; i++) {
      domains[i].textContent = payload ? payload.domain : 'your website';
    }
    var links = document.querySelectorAll('.js-mailto');
    for (var j = 0; j < links.length; j++) {
      var href = mailtoHref(links[j].getAttribute('data-reason'));
      if (href) {
        links[j].setAttribute('href', href);
      } else {
        links[j].hidden = true;
      }
    }
  }

  // A valid link starts the demo straight away (Nicholas, 2026-10-09): the
  // visitor already chose to open it, and the agent's own Start button in
  // the session is the click the browser needs for sound. Two exceptions
  // keep the Start button: an automated browser (mail security scanners
  // open links in one, which would spend a start and a session), and a tab
  // nobody is looking at yet (opened in the background), which starts when
  // it becomes visible.
  function autoStart() {
    if (navigator.webdriver) { show('ready', false); return; }
    if (document.visibilityState === 'visible') { start(); return; }
    show('ready', false);
    document.addEventListener('visibilitychange', function onVisible() {
      if (document.visibilityState !== 'visible') { return; }
      document.removeEventListener('visibilitychange', onVisible);
      if (current === 'ready' && !starting) { start(); }
    });
  }

  function proceed() {
    if (!token || !payload) {
      show('incomplete', false);
    } else if (payload.exp * 1000 <= Date.now()) {
      show('expired', false);
    } else {
      autoStart();
    }
  }

  function init() {
    fill();
    document.getElementById('start').addEventListener('click', start);
    document.getElementById('retry').addEventListener('click', retry);

    if (!token && shortCode) {
      resolveCode();
    } else {
      proceed();
    }

    // Coming back with the Back button can restore this page from the
    // back/forward cache mid-start; give the visitor a working button again.
    window.addEventListener('pageshow', function (ev) {
      if (ev.persisted && current === 'starting') {
        starting = false;
        resolving = false;
        if (token) {
          show('ready', false);
        } else {
          resolveCode();
        }
      }
    });
  }

  init();
}());

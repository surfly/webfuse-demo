/* Deployment settings for the start page. Change these when the page or the
 * start endpoint moves to another host; app.js reads nothing else. */
window.DEMO_CONFIG = {
  // Receives POST {"t": "<token>"} and answers with a session link or an
  // error code (expired, limit, invalid, busy, unavailable).
  API_URL: 'https://demo.webfuse.it/start',

  // The only place a returned link may send the visitor.
  ALLOWED_LINK_PREFIX: 'https://webfu.se/',

  // "Request a new link" goes here.
  OWNER_EMAIL: 'nicholas@surfly.com',
  OWNER_NAME: 'Nicholas',

  // Give up on the start request after this long and offer a retry.
  TIMEOUT_MS: 25000
};

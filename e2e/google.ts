import type { Page } from '@playwright/test'
import { FakeDrive } from '../src/test/fakeDrive'

export { FakeDrive }

/**
 * Stand in for Google in a browser test: Google's sign-in script and every Drive request are
 * answered by the test process. No request reaches Google, so these tests prove GymBook's own
 * behaviour, not Google's.
 *
 * What the pretend sign-in does is read from sessionStorage['fake-google'] on each request:
 *   token   which account "signs in" (a token registered with the FakeDrive)
 *   mode    'ok' | 'denied' | 'closed' | 'popup-blocked' | 'no-scope'
 *   silent  whether a request without a click (prompt "none") is allowed through
 */
const GIS_STUB = `
window.__googleCalls = [];
window.google = { accounts: { oauth2: {
  initTokenClient: function (cfg) {
    return { requestAccessToken: function (o) {
      var s = JSON.parse(sessionStorage.getItem('fake-google') || '{}');
      window.__googleCalls.push({ prompt: o && o.prompt, hint: o && o.hint, scope: cfg.scope, client_id: cfg.client_id });
      Promise.resolve().then(function () {
        if (o && o.prompt === 'none' && !s.silent) return cfg.error_callback({ type: 'popup_failed_to_open' });
        if (s.mode === 'popup-blocked') return cfg.error_callback({ type: 'popup_failed_to_open' });
        if (s.mode === 'closed') return cfg.error_callback({ type: 'popup_closed' });
        if (s.mode === 'denied') return cfg.callback({ error: 'access_denied' });
        cfg.callback({ access_token: s.token || 'token-a', expires_in: 3599, scope: s.mode === 'no-scope' ? 'openid' : cfg.scope });
      });
    } };
  },
  hasGrantedAllScopes: function (r, scope) { return String(r.scope || '').split(' ').indexOf(scope) >= 0; },
  revoke: function (t, done) { window.__revoked = t; if (done) done(); }
} } };
`

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,OPTIONS', 'access-control-expose-headers': 'Location' }

export async function mockGoogle(page: Page, drive: FakeDrive): Promise<void> {
  await page.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({ contentType: 'application/javascript', body: GIS_STUB }))
  await page.route('https://www.googleapis.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const res = drive.handle({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postDataBuffer() ?? undefined })
    if (res === 'network-error') return route.abort('internetdisconnected')
    return route.fulfill({ status: res.status, headers: { ...res.headers, ...CORS }, body: typeof res.body === 'string' ? res.body : Buffer.from(res.body) })
  })
}

export async function setGoogle(page: Page, config: { token?: string; mode?: 'ok' | 'denied' | 'closed' | 'popup-blocked' | 'no-scope'; silent?: boolean }): Promise<void> {
  await page.evaluate((c) => sessionStorage.setItem('fake-google', JSON.stringify(c)), config)
}

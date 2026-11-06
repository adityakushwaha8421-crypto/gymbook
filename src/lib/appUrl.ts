/**
 * Absolute path inside the app for hard navigations (window.open, location.assign).
 * The app can be served from a sub-path such as /gymbook/ on GitHub Pages, so a bare
 * "/x" would leave the app. Router links do not need this; the router adds the base itself.
 */
export function appUrl(path = '/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

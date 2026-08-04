/**
 * The version the build actually produced, injected by Vite from package.json.
 *
 * It reaches the cards through the footer's `{version}` placeholder, so a
 * thumbnail found on a frame a year later says which build drew it.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'v0.0.0-dev'

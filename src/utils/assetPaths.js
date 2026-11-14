/** App-local URLs work at a domain root and below a GitHub Pages project path. */
export function sitePath(path = '') {
  const base = import.meta.env?.BASE_URL || './';
  return `${base}${String(path).replace(/^\/+/, '')}`;
}

const BASE_URL = import.meta.env.BASE_URL || '/';

export function assetPath(path) {
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}${relativePath}`;
}

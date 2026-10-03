import { useEffect, useState } from 'react';

// Minimal hash router: "#/files/123" -> "/files/123"
const read = () => window.location.hash.replace(/^#/, '') || '/dashboard';

export function useHashRoute() {
  const [path, setPath] = useState(read());
  useEffect(() => {
    const onChange = () => setPath(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export const navigate = (to) => { window.location.hash = `#${to}`; };

import { useState, useEffect } from 'react'

// Reactive viewport check. Mirrors the 700px CSS breakpoint so JS-gated
// behavior (read-only editing on mobile) stays in sync with the layout.
export function useIsMobile(maxWidth = 700) {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = e => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return isMobile;
}

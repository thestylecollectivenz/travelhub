import * as React from 'react';

export function useMinViewportWidth(minPx: number): boolean {
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth >= minPx
  );

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minPx}px)`);
    const onChange = (): void => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [minPx]);

  return matches;
}

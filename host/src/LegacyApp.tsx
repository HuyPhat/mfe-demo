import { useEffect, useRef, useState } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';

type Mount = { mount: (el: HTMLElement) => void; unmount: (el: HTMLElement) => void };

// The legacy remote brings its own React 17, so we cannot render it as a component of this
// (React 19) tree. We give it a plain <div> and let it mount its own root there.
export default function LegacyApp() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current!;
    let m: Mount | undefined;
    let cancelled = false;
    loadRemote<Mount>('legacy/mount')
      .then((mod) => {
        if (cancelled || !mod) return;
        m = mod;
        m.mount(el);
      })
      .catch((e) => setError(String(e.message ?? e)));
    return () => {
      cancelled = true;
      m?.unmount(el);
    };
  }, []);

  if (error) return <div style={{ border: '2px solid red', padding: 12 }}>⚠️ <b>legacy</b> đang lỗi: {error}</div>;
  return <div ref={ref} style={{ gridColumn: '1 / -1' }} />;
}

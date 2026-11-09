import { useEffect, useState } from 'react';
import RemoteComponent from './RemoteComponent';
import LegacyApp from './LegacyApp';
import { UI_VERSION } from '@shop/ui'; // host uses it too, so host registers the shared copy first

export default function App() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const onChanged = (e: CustomEvent<{ count: number }>) => setCount(e.detail.count);
    window.addEventListener('cart:changed', onChanged);
    return () => window.removeEventListener('cart:changed', onChanged);
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1677ff' }}>
        <h1 style={{ color: '#1677ff' }}>Shop (host) <small style={{ fontSize: 12 }}>ui v{UI_VERSION}</small></h1>
        <h2>🛒 {count}</h2>
      </header>
      <main style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
        <RemoteComponent id="products/ProductList" />
        <RemoteComponent id="cart/Cart" />
        <LegacyApp />
      </main>
    </div>
  );
}

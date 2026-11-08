import { useState, version } from 'react';

// Old-style app: runs on React 17 (its own copy, not the host's React 19).
export default function Legacy() {
  const [clicks, setClicks] = useState(0);
  return (
    <section style={{ border: '1px solid #999', padding: 12, borderRadius: 8, gridColumn: '1 / -1' }}>
      <h2>Legacy app <small>React {version}</small></h2>
      <button
        onClick={() => {
          setClicks((c) => c + 1);
          // same contract as products: no React shared, only a window event
          window.dispatchEvent(new CustomEvent('cart:add', { detail: { id: 99, name: 'Legacy item', price: 10000 } }));
        }}
      >
        Thêm vào giỏ (từ React {version}) — đã bấm {clicks}
      </button>
    </section>
  );
}

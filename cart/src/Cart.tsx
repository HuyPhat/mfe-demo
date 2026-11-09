import { useEffect, useState } from 'react';
import { Panel, UI_VERSION } from '@shop/ui';
import type { CartItem } from './events';

export default function Cart() {
  const [items, setItems] = useState<CartItem[]>([]);

  // Listen to the contract event; state stays private to this MFE.
  useEffect(() => {
    const onAdd = (e: CustomEvent<CartItem>) => setItems((prev) => [...prev, e.detail]);
    window.addEventListener('cart:add', onAdd);
    return () => window.removeEventListener('cart:add', onAdd);
  }, []);

  // Publish a read-only summary so others (host header) can show a badge.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart:changed', { detail: { count: items.length } }));
  }, [items]);

  const total = items.reduce((sum, i) => sum + i.price, 0);
  return (
    <Panel accent="purple" title={<>Cart <small>v{__APP_VERSION__} · ui v{UI_VERSION}</small></>}>
      {items.length === 0 ? <p>Giỏ hàng trống</p> : (
        <ul>{items.map((i, idx) => <li key={idx}>{i.name}</li>)}</ul>
      )}
      <strong>Tổng: {total.toLocaleString('vi-VN')}₫</strong>
    </Panel>
  );
}

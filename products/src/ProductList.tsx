import { Suspense } from 'react';
import { Button, Panel, UI_VERSION } from '@shop/ui';
import * as styles from './ProductList.module.css';
import type { CartItem } from './events';
import { Badge } from './ds';

const PRODUCTS: CartItem[] = [
  { id: 1, name: 'Bàn phím cơ', price: 1200000 },
  { id: 2, name: 'Chuột không dây', price: 450000 },
  { id: 3, name: 'Màn hình 27"', price: 5900000 },
];

// Communication contract (v1): window CustomEvent 'cart:add', detail = { id, name, price }.
// Products does NOT import Cart -> no coupling, either side can deploy alone.
const addToCart = (product: CartItem) =>
  window.dispatchEvent(new CustomEvent('cart:add', { detail: product }));

export default function ProductList() {
  return (
    <Panel accent="green" title={<>New Products <small>v{__APP_VERSION__} · ui v{UI_VERSION}</small><Suspense fallback={null}><Badge>{PRODUCTS.length} sản phẩm</Badge></Suspense></>}>
      {PRODUCTS.map((p) => (
        <div key={p.id} className={styles.row}>
          <span>{p.name} — {p.price.toLocaleString('vi-VN')}₫</span>
          <Button onClick={() => addToCart(p)}>Thêm vào giỏ</Button>
        </div>
      ))}
    </Panel>
  );
}

import * as styles from './ProductList.module.css';
import type { CartItem } from './events';

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
    <section className={styles.box}>
      <h2 className={styles.title}>Products <small>v{__APP_VERSION__}</small></h2>
      {PRODUCTS.map((p) => (
        <div key={p.id} className={styles.row}>
          <span>{p.name} — {p.price.toLocaleString('vi-VN')}₫</span>
          <button onClick={() => addToCart(p)}>Thêm vào giỏ</button>
        </div>
      ))}
    </section>
  );
}

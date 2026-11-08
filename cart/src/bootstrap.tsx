import { createRoot } from 'react-dom/client';
import Cart from './Cart';

createRoot(document.getElementById('root')!).render(
  <>
    <button onClick={() => window.dispatchEvent(new CustomEvent('cart:add', { detail: { id: 0, name: 'Fake item', price: 1000 } }))}>
      [standalone] giả lập cart:add
    </button>
    <Cart />
  </>
);

// Standalone mode: the team can develop/test this MFE without the host.
import { createRoot } from 'react-dom/client';
import ProductList from './ProductList';

window.addEventListener('cart:add', (e) => console.log('[standalone] cart:add', e.detail));
createRoot(document.getElementById('root')).render(<ProductList />);

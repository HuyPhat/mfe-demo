import { createRoot } from 'react-dom/client';
import Badge from './Badge';

// Standalone mode: preview the components without any host.
createRoot(document.getElementById('root')!).render(<p>Badge preview: <Badge>sample</Badge></p>);

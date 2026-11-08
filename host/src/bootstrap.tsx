import { createRoot } from 'react-dom/client';
import { registerRemotes } from '@module-federation/enhanced/runtime';
import App from './App';

// Dynamic remotes: URLs come from a JSON file fetched at runtime, NOT baked in at build time.
// Release/rollback a remote = edit remotes.json (or a config service). Host is never rebuilt.
const remotes: Record<string, string> = await fetch('/remotes.json').then((r) => r.json());
registerRemotes(Object.entries(remotes).map(([name, entry]) => ({ name, entry })));

createRoot(document.getElementById('root')!).render(<App />);

import { lazy, type ComponentType, type ReactNode } from 'react';
import { loadRemote, registerRemotes } from '@module-federation/enhanced/runtime';

type BadgeProps = { children?: ReactNode };

// The design system is registered at runtime, NOT in the rspack `remotes` option: a static remote makes
// this app's container fetch the ds manifest while initialising, so ds being down would break the whole app.
registerRemotes([{ name: 'ds', entry: 'http://localhost:3004/mf-manifest.json' }]);

// Badge from the design-system remote. If ds is unreachable we render nothing instead of breaking this app.
export const Badge = lazy<ComponentType<BadgeProps>>(async () => {
  try {
    const mod = await loadRemote<{ default: ComponentType<BadgeProps> }>('ds/Badge');
    if (mod) return mod;
  } catch {
    // ds down or not deployed yet: fall through to the empty fallback
  }
  return { default: () => null };
});

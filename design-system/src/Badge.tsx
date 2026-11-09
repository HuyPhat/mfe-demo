import type { ReactNode } from 'react';
import * as styles from './Badge.module.css';

// Public API of the design-system remote. Consumers load it at runtime, so a change here
// reaches every app after ds is deployed, without rebuilding them.
export default function Badge({ children }: { children?: ReactNode }) {
  return <span className={styles.badge} title={`design-system v${__APP_VERSION__}`}>{children}</span>;
}

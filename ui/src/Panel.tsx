import type { CSSProperties, ReactNode } from 'react';
import * as styles from './Panel.module.css';

// One look for every micro-frontend's box: change it here, every app that uses @shop/ui follows.
export default function Panel({ title, accent = 'steelblue', children }: { title: ReactNode; accent?: string; children: ReactNode }) {
  return (
    <section className={styles.box} style={{ '--accent': accent } as CSSProperties}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}

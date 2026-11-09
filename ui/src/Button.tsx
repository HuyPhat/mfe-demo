import type { ButtonHTMLAttributes } from 'react';
import * as styles from './Button.module.css';

export default function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={styles.button} />;
}

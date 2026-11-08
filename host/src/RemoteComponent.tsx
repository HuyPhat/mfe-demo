import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';

// Isolation: a crashing or unreachable remote only breaks its own box, never the whole page.
class ErrorBoundary extends Component<{ id: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ border: '2px solid red', padding: 12, borderRadius: 8 }}>
          ⚠️ <b>{this.props.id}</b> đang lỗi — phần còn lại vẫn chạy.
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(this.state.error.message)}</pre>
          <button onClick={() => this.setState({ error: null })}>Thử lại</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const cache = new Map<string, ComponentType<any>>(); // one lazy() per remote id, otherwise React remounts on every render
const getLazy = (id: string) => {
  if (!cache.has(id)) {
    // loadRemote is untyped without generated remote types (dts); we assert the module shape here
    cache.set(id, lazy(() => loadRemote<{ default: ComponentType<any> }>(id) as Promise<{ default: ComponentType<any> }>));
  }
  return cache.get(id)!;
};

export default function RemoteComponent({ id, ...props }: { id: string } & Record<string, unknown>) {
  const Remote = getLazy(id);
  return (
    <ErrorBoundary id={id}>
      <Suspense fallback={<p>Đang tải {id}…</p>}>
        <Remote {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

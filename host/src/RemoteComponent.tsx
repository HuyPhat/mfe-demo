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
          {/* a rejected lazy() is cached forever by React -> drop it so retry calls loadRemote again */}
          <button onClick={() => { cache.delete(this.props.id); this.setState({ error: null }); }}>Thử lại</button>
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

// getLazy runs inside this child (not in RemoteComponent): when the boundary resets, the child
// remounts and re-reads the cache. Resolving it in the parent would keep the old rejected lazy().
function Remote({ id, ...props }: { id: string } & Record<string, unknown>) {
  const Lazy = getLazy(id);
  return <Lazy {...props} />;
}

export default function RemoteComponent({ id, ...props }: { id: string } & Record<string, unknown>) {
  return (
    <ErrorBoundary id={id}>
      <Suspense fallback={<p>Đang tải {id}…</p>}>
        <Remote id={id} {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

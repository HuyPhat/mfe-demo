import { Component, lazy, Suspense } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';

// Isolation: a crashing or unreachable remote only breaks its own box, never the whole page.
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
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

const cache = new Map(); // one lazy() per remote id, otherwise React remounts on every render
const getLazy = (id) => {
  if (!cache.has(id)) cache.set(id, lazy(() => loadRemote(id)));
  return cache.get(id);
};

export default function RemoteComponent({ id, ...props }) {
  const Remote = getLazy(id);
  return (
    <ErrorBoundary id={id}>
      <Suspense fallback={<p>Đang tải {id}…</p>}>
        <Remote {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

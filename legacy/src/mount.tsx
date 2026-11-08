import ReactDOM from 'react-dom';
import Legacy from './Legacy';

// The host never renders this component. It only calls mount/unmount, so both
// React copies stay separate. React 17 has no createRoot.
export const mount = (el: HTMLElement) => ReactDOM.render(<Legacy />, el);
export const unmount = (el: HTMLElement) => ReactDOM.unmountComponentAtNode(el);

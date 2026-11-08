// Contract v1 (host only LISTENS to cart:changed)
export {};
declare global {
  interface WindowEventMap { 'cart:changed': CustomEvent<{ count: number }> }
}

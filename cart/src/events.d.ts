// Contract v1 (this app RECEIVES cart:add and SENDS cart:changed)
export interface CartItem { id: number; name: string; price: number }
declare global {
  interface WindowEventMap {
    'cart:add': CustomEvent<CartItem>;
    'cart:changed': CustomEvent<{ count: number }>;
  }
}

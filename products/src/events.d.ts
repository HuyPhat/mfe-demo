// Contract v1 (this app only SENDS cart:add)
export interface CartItem { id: number; name: string; price: number }
declare global {
  interface WindowEventMap { 'cart:add': CustomEvent<CartItem> }
}

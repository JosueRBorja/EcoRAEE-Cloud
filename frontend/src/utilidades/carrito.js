const KEY = "ecoraee-shopping-cart";
export function readCart() {
  try {
    const values = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    return Object.fromEntries(
      Object.entries(values).filter(
        ([id, quantity]) =>
          /^\d+$/.test(id) &&
          Number.isInteger(quantity) &&
          quantity > 0 &&
          quantity <= 100,
      ),
    );
  } catch {
    return {};
  }
}
export function saveCart(cart) {
  sessionStorage.setItem(KEY, JSON.stringify(cart));
}
export function clearCart() {
  sessionStorage.removeItem(KEY);
}

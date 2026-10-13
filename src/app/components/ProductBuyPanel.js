"use client";

import { useState } from "react";
import { useStore } from "./Storefront";
import styles from "./ProductPage.module.css";

const clamp = (value) => Math.min(999, Math.max(1, Math.floor(value)));

/** Quantity stepper plus the add-to-cart button for a single product. */
export default function ProductBuyPanel({ product }) {
  const { addToCart, openCart } = useStore();
  const [quantity, setQuantity] = useState(1);

  if (product.price == null) {
    // The price line above already says "Price coming soon" — repeating it on
    // the button just reads as a stutter, so the button stays plain and disabled.
    return (
      <div className={styles.panel}>
        <button type="button" className={styles.addButton} disabled>
          Add to cart
        </button>
      </div>
    );
  }

  const change = (delta) => setQuantity((current) => clamp(current + delta));
  const onInput = (event) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value)) setQuantity(clamp(value));
  };
  const add = () => {
    addToCart(product, quantity);
    openCart();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.stepper} role="group" aria-label="Quantity">
        <button type="button" onClick={() => change(-1)} disabled={quantity <= 1} aria-label="Decrease quantity">
          −
        </button>
        <input
          type="number"
          min="1"
          max="999"
          value={quantity}
          onChange={onInput}
          aria-label="Quantity"
        />
        <button type="button" onClick={() => change(1)} disabled={quantity >= 999} aria-label="Increase quantity">
          +
        </button>
      </div>
      <button type="button" className={styles.addButton} onClick={add}>
        Add to cart
      </button>
    </div>
  );
}

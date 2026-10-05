"use client";

import Link from "next/link";
import { useState } from "react";
import { PageIntro } from "./PageContent";
import { formatPrice, productImage, productTitle, useStore } from "./Storefront";
import styles from "./CartPage.module.css";

export default function CartPage() {
  const { cart, cartTotal, storageReady, updateQuantity, removeFromCart, clearCart } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const submitOrder = async (event) => {
    event.preventDefault();
    if (submitting || !cart.length) return;
    setSubmitting(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart.map(({ id, quantity }) => ({ id, quantity })), customer: { name: fields.name, email: fields.email, phone: fields.phone, address: fields.address, city: fields.city, postcode: fields.postcode }, notes: fields.notes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We couldn’t save your request. Please try again.");
      setReceipt(data);
      clearCart();
    } catch (issue) { setError(issue.message || "We couldn’t save your request. Please try again."); }
    finally { setSubmitting(false); }
  };
  return <main className="page-container">
    <PageIntro eyebrow="Your move starts here" title="Your shopping cart" description="Review your boxes and supplies, adjust quantities and send your order request." breadcrumb="Shopping cart" />
    {receipt ? <section className={styles.confirmation} role="status">
      <span className={styles.check} aria-hidden="true">✓</span><span className="eyebrow-label">Request received</span><h2>Let’s get your move organised.</h2>
      <p>Your order request has been saved with reference <strong>{receipt.reference}</strong>. Keep this reference to check the request status.</p>
      <dl><div><dt>Product subtotal</dt><dd>{formatPrice(receipt.total)}</dd></div><div><dt>Current status</dt><dd>Order request received</dd></div></dl>
      <p>Payment and delivery are still to be confirmed. This request does not take payment or reserve stock.</p>
      <div className={styles.actions}><Link className="orange-button" href={`/tracking?reference=${encodeURIComponent(receipt.reference)}`}>View request status</Link><Link className="text-link" href="/boxes">Keep shopping</Link></div>
    </section> : !storageReady ? <p className={styles.loading}>Loading your cart…</p> : !cart.length ? <section className={styles.empty}>
      <img src="/boxes/small.webp" alt="Save On Boxes moving carton" /><h2>Your next move starts with a box.</h2><p>Your cart is empty. Choose individual boxes, start with a moving kit or pick up the packing essentials.</p><div className={styles.actions}><Link className="orange-button" href="/boxes">Shop boxes</Link><Link className="text-link" href="/kits">Choose a moving kit</Link></div>
    </section> : <div className={styles.layout}>
      <div>
        <section className={styles.items} aria-labelledby="cart-items-heading"><div className={styles.sectionTop}><h2 id="cart-items-heading">Your items <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2><Link className="text-link" href="/boxes">Continue shopping</Link></div>
          {cart.map((item) => <article className={styles.item} key={item.id}>
            <img src={productImage(item)} alt={productTitle(item)} />
            <div className={styles.itemDetails}><h3>{productTitle(item)}</h3><p>{item.configurationLabel || item.purpose || `${item.boxCount} boxes · box-only moving kit`}</p>{item.detail && <small>{item.detail}</small>}<span>{formatPrice(item.price)} each</span><button onClick={() => removeFromCart(item.id)}>Remove</button></div>
            <div className={styles.itemQuantity}><label htmlFor={`qty-${item.id}`}>Quantity</label><div><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Decrease ${productTitle(item)} quantity`}>−</button><input id={`qty-${item.id}`} type="number" min="1" max="999" value={item.quantity} onChange={(event) => { const value = Number(event.target.value); if (event.target.value && Number.isFinite(value)) updateQuantity(item.id, value); }} /><button onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Increase ${productTitle(item)} quantity`}>+</button></div><strong>{formatPrice(item.price * item.quantity)}</strong></div>
          </article>)}
        </section>
        <section className={styles.deliveryNote}><h3>Everything for moving day</h3><p>Before you finish, check that you have tape to seal your cartons, a marker for room labels and protective wrap for fragile items.</p><Link className="text-link" href="/extras">Add packing supplies</Link></section>
        <form className={styles.form} onSubmit={submitOrder} aria-labelledby="order-details-heading">
          <span className="eyebrow-label">The next step</span><h2 id="order-details-heading">Your delivery details</h2><p>Send a request with your product choices and delivery address. Payment and delivery charges will be confirmed separately.</p>
          <div className={styles.fields}>
            <label>Full name<input name="name" autoComplete="name" required maxLength={120} /></label>
            <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={200} /></label>
            <label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
            <label>City / town<input name="city" autoComplete="address-level2" required maxLength={100} /></label>
            <label className={styles.full}>Delivery address<input name="address" autoComplete="street-address" required maxLength={300} /></label>
            <label>Postcode<input name="postcode" autoComplete="postal-code" required maxLength={20} /></label>
            <label className={styles.full}>Delivery notes <span>(optional)</span><textarea name="notes" rows={4} maxLength={2000} placeholder="Access instructions or anything we should know about your move" /></label>
          </div>
          <p className={styles.privacyNote}>Your details are used to handle this request. <Link href="/privacy">Read our Privacy Policy</Link>.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className="orange-button" type="submit" disabled={submitting}>{submitting ? "Saving your request…" : "Send order request"}</button>
        </form>
      </div>
      <aside className={styles.summary}><span className="eyebrow-label">Order summary</span><h2>Ready to pack?</h2><dl><div><dt>Products</dt><dd>{formatPrice(cartTotal)}</dd></div><div><dt>Delivery</dt><dd>To be confirmed</dd></div><div className={styles.total}><dt>Product subtotal</dt><dd>{formatPrice(cartTotal)}</dd></div></dl><p>No payment is taken when you send a request. We’ll confirm availability and delivery before payment.</p><a className="orange-button" href="#order-details-heading">Complete your details</a><div className={styles.summaryLinks}><Link href="/delivery-policy">Delivery information</Link><Link href="/return-policy">Returns & support</Link><Link href="/contact">Need help with your order?</Link></div></aside>
    </div>}
  </main>;
}

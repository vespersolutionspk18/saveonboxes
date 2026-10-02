"use client";
import Link from "next/link";
import { boxProducts, kits, supplies } from "../catalog";
import { PageIntro, HelpCTA } from "./PageContent";
import { ProductSection, useStore } from "./Storefront";

export default function AccountPage() {
  const { wishedIds } = useStore();
  const products = [...boxProducts, ...kits, ...supplies].filter((product) => wishedIds.has(product.id));
  return <main className="page-container">
    <PageIntro eyebrow="YOUR SAVE ON BOXES" title="Your moving hub" description="Find your order request, revisit your saved products and keep your packing plans in one place." breadcrumb="Your account" />
    <section className="account-order-card"><div><span className="eyebrow-label">ACCESS YOUR ORDER</span><h2>Your reference is your way in.</h2><p>Use your order reference and the email address provided with your request to view its latest status. You can request an order without creating a password.</p><Link className="orange-button" href="/tracking">Find your order →</Link></div><div><h3>Need a hand?</h3><p>For changes to a request, product advice or help finding your reference, send us an enquiry with your order details.</p><Link className="text-link" href="/contact">Contact Save On Boxes</Link></div></section>
    <section className="account-saved"><div className="catalogue-intro"><div><span className="eyebrow-label">YOUR SHORTLIST</span><h2>Saved for your move</h2></div><p>Products you save with the heart button stay in this browser.</p></div>{products.length ? <ProductSection id="saved-products" title="Your saved products" products={products} /> : <div className="account-empty"><p>Your shortlist is empty. Tap the heart on a product to save it here.</p><Link className="text-link" href="/boxes">Explore moving boxes →</Link></div>}</section>
    <HelpCTA />
  </main>;
}

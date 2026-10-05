"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Accordion, HelpCTA, PageIntro } from "./PageContent";
import styles from "./SupportPages.module.css";

const subjects = [["product-help", "Choosing boxes & kits"], ["order", "An existing order"], ["delivery", "Delivery & tracking"], ["returns", "Returns & damaged items"], ["bulk", "A larger order"], ["privacy", "Privacy & my information"], ["other", "Something else"]];
const topicSubjects = { Returns: "returns", "Order issue": "order", Delivery: "delivery", "Product advice": "product-help", Privacy: "privacy", "General enquiry": "other" };
function SupportLinks() {
  return <div className={styles.supportLinks}>
    <Link href="/tracking"><span><small>Your order</small><strong>Track an order</strong></span></Link>
    <Link href="/delivery-policy"><span><small>Getting your boxes</small><strong>Delivery information</strong></span></Link>
    <Link href="/return-policy"><span><small>When plans change</small><strong>Returns & order issues</strong></span></Link>
  </div>;
}

function ContactForm() {
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState("product-help");
  const [state, setState] = useState({ status: "idle", message: "" });
  useEffect(() => {
    const requested = searchParams.get("subject") || topicSubjects[searchParams.get("topic")];
    if (subjects.some(([value]) => value === requested)) setSubject(requested);
  }, [searchParams]);
  async function submit(event) {
    event.preventDefault();
    if (state.status === "submitting") return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setState({ status: "submitting", message: "" });
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your enquiry could not be saved. Please try again.");
      setState({ status: "success", message: `Your enquiry has been recorded. Your reference is ${result.reference}. Keep this reference with your order details.` });
      form.reset();
      setSubject("product-help");
    } catch (error) {
      setState({ status: "error", message: error.message || "Something went wrong. Please try again." });
    }
  }
  return <section className={styles.formPanel} aria-labelledby="contact-form-title">
    <span className={styles.eyebrow}>Let’s get you packing</span><h2 id="contact-form-title">How can we help?</h2><p className={styles.panelIntro}>Tell us what you need help with. For an existing order, include your order reference so your enquiry can be matched to it.</p>
    <form onSubmit={submit} className={styles.form}>
      <div className={styles.fieldRow}>
        <label htmlFor="contact-name">Your name <span>*</span><input id="contact-name" name="name" autoComplete="name" maxLength={120} placeholder="Full name" required /></label>
        <label htmlFor="contact-email">Email address <span>*</span><input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>
      </div>
      <div className={styles.fieldRow}>
        <label htmlFor="contact-subject">What’s this about? <span>*</span><select id="contact-subject" name="subject" value={subject} onChange={event => setSubject(event.target.value)}>{subjects.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label htmlFor="contact-order">Order reference <small>Optional</small><input id="contact-order" name="orderNumber" maxLength={80} placeholder="e.g. SOB-12345" /></label>
      </div>
      <label htmlFor="contact-message">Your message <span>*</span><textarea id="contact-message" name="message" rows={6} minLength={10} maxLength={5000} placeholder="Tell us a little about your move or the help you need…" required /><small>Include the product name, quantity or relevant order details. Please leave out payment card information.</small></label>
      <label className={styles.consent}><input type="checkbox" name="consent" value="yes" required /><span>I’ve read the <Link href="/privacy">privacy policy</Link> and agree to my details being used to handle this enquiry.</span></label>
      {state.message && <div className={`${styles.message} ${state.status === "success" ? styles.success : styles.error}`} role={state.status === "error" ? "alert" : "status"}>{state.status === "success" && <strong>Enquiry recorded</strong>}{state.message}</div>}
      <div className={styles.submitRow}><button type="submit" className={styles.primaryButton} disabled={state.status === "submitting"}>{state.status === "submitting" ? "Saving your enquiry…" : "Submit enquiry"}</button><small>* Required fields</small></div>
    </form>
  </section>;
}

export function ContactPage() {
  return <main className="page-container">
    <PageIntro eyebrow="Contact and support" title="A little help for your big move." description="From picking the right box to getting an order update, start here. Tell us what you’re packing and we’ll help you find your next step." image="/boxes/dishpack1.webp" breadcrumb="Contact" />
    <div className={styles.container}>
      <div className={styles.contactLayout}><Suspense fallback={<section className={styles.formPanel}><h2>How can we help?</h2><p>Loading your enquiry form…</p></section>}><ContactForm /></Suspense><aside className={styles.helpAside}>
        <div className={styles.asideIntro}><span className={styles.eyebrow}>Find your answer</span><h2>A good place to start.</h2><p>Your order confirmation and the product details contain the information you’ll use most often.</p></div><SupportLinks />
        <div className={styles.tipCard}><span className={styles.tipIcon} aria-hidden="true">□</span><h3>Choosing a moving kit?</h3><p>Start with the size of your home, then add TV, mirror, dish and other specialty boxes for the items you have.</p><Link href="/kits">Compare moving kits</Link></div>
      </aside></div>
      <section className={styles.guideSection} aria-labelledby="contact-help-title"><div className={styles.sectionHeading}><span className={styles.eyebrow}>Make your next step easy</span><h2 id="contact-help-title">What do you need a hand with?</h2><p>A few details make it easier to point you to the right product or order information.</p></div><div className={styles.guideGrid}>
        <article><span className={styles.number}>01</span><h3>Planning your move</h3><p>Share your home size and any awkward items, such as a TV, hanging clothes or framed artwork.</p><Link href="/boxes">Find boxes by room</Link></article>
        <article><span className={styles.number}>02</span><h3>Checking an order</h3><p>Have your order reference and the email address used for the order ready. These details help identify your purchase.</p><Link href="/tracking">Look up your order</Link></article>
        <article><span className={styles.number}>03</span><h3>Reporting an issue</h3><p>Describe the item, the quantity affected and what happened. Keep any packaging while your issue is being reviewed.</p><Link href="/contact?subject=returns">Get order help</Link></article>
      </div></section>
      <section className={styles.faqSection} aria-labelledby="contact-faq-title"><div><span className={styles.eyebrow}>Before you get in touch</span><h2 id="contact-faq-title">Frequently asked questions</h2><p>Practical answers to the questions that come up when you start packing.</p></div><Accordion items={[
        { title: "How do I choose the right box size?", content: "Use small boxes for books and heavier items, medium boxes for everyday packing, large boxes for clothing and household items, and X-Large boxes for bedding and light bulky items. Check the dimensions on each product before you choose." },
        { title: "Do moving kits include tape and packing supplies?", content: "Our moving kits are box-only bundles. Add tape, a marker, bubble wrap and protective covers separately from the packing supplies collection." },
        { title: "Can I add specialty boxes to my kit?", content: "Yes. Open a kit and use the special-item options to add TV, mirror, electronics, dish, bicycle, lamp or file boxes. You can also upgrade the included 20-inch wardrobe boxes to 24-inch wardrobe boxes." },
        { title: "What information should I include about an order?", content: "Include your order reference, the email address used for your order, the relevant product name and a description of what you need help with. You do not need to include payment card details." },
        { title: "I need a large quantity. Where do I start?", content: "Choose ‘A larger order’ in the enquiry form and tell us the box types, quantities and destination you have in mind. You can also compare the priced multipacks in the box collection." },
      ]} /></section>
    </div><HelpCTA title="One less thing on your moving list." description="Choose your boxes, add your packing essentials and get your next move organised." />
  </main>;
}

function TrackingForm() {
  const searchParams = useSearchParams();
  const [state, setState] = useState({ status: "idle", message: "", order: null });
  const [reference, setReference] = useState("");
  useEffect(() => { setReference(searchParams.get("reference") || ""); }, [searchParams]);
  async function submit(event) {
    event.preventDefault();
    if (state.status === "submitting") return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setState({ status: "submitting", message: "", order: null });
    try {
      const response = await fetch("/api/tracking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn’t look up that order. Please try again.");
      setState({ status: "success", message: "", order: result.order });
    } catch (error) { setState({ status: "error", message: error.message, order: null }); }
  }
  return <section className={styles.formPanel} aria-labelledby="tracking-form-title">
    <span className={styles.eyebrow}>Your order at a glance</span><h2 id="tracking-form-title">Find your order.</h2><p className={styles.panelIntro}>Enter the order reference from your confirmation and the same email address you used for the order.</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="tracking-reference">Order reference <span>*</span><input id="tracking-reference" name="orderNumber" value={reference} onChange={event => setReference(event.target.value)} maxLength={80} placeholder="e.g. SOB-12345" autoComplete="off" required /></label>
      <label htmlFor="tracking-email">Email address <span>*</span><input id="tracking-email" name="email" type="email" maxLength={254} placeholder="Email used for this order" autoComplete="email" required /></label>
      <button type="submit" className={styles.primaryButton} disabled={state.status === "submitting"}>{state.status === "submitting" ? "Looking up your order…" : "Find my order"}</button>
      {state.message && <div className={`${styles.message} ${styles.error}`} role="alert">{state.message}<Link href="/contact?subject=order">Contact us with your order details</Link></div>}
    </form>{state.order && <OrderResult order={state.order} />}<p className={styles.privacyNote}>Your email helps protect your order information. Read our <Link href="/privacy">privacy policy</Link>.</p>
  </section>;
}

function OrderResult({ order }) {
  return <div className={styles.orderResult} role="status">
    <div className={styles.resultHeading}><div><span className={styles.eyebrow}>Order found</span><h3>{order.reference}</h3></div><span className={styles.statusTag}>{order.status}</span></div>
    <dl className={styles.orderDetails}>
      {order.createdAt && <div><dt>Order date</dt><dd>{new Date(order.createdAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</dd></div>}
      {order.updatedAt && <div><dt>Last updated</dt><dd>{new Date(order.updatedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}</dd></div>}
      {order.subtotal != null && <div><dt>Products subtotal</dt><dd>USD ${Number(order.subtotal).toFixed(2)}</dd></div>}
      {order.carrier && <div><dt>Carrier</dt><dd>{order.carrier}</dd></div>}
      {order.trackingNumber && <div><dt>Tracking number</dt><dd>{order.trackingNumber}</dd></div>}
    </dl>{order.update && <p>{order.update}</p>}
    {order.items.length > 0 && <div className={styles.orderItems}><h4>Items in your order</h4><ul>{order.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}</span><strong>× {item.quantity}</strong></li>)}</ul></div>}
    {order.trackingUrl ? <a className={styles.primaryButton} href={order.trackingUrl} target="_blank" rel="noreferrer">Open carrier tracking</a> : <p className={styles.resultNote}>A carrier tracking link will appear here when it is added to your order.</p>}
  </div>;
}

export function TrackingPage() {
  return <main className="page-container">
    <PageIntro eyebrow="Order tracking" title="Follow your boxes to your door." description="Look up an order, check its latest recorded update and find the next step for your delivery." image="/boxes/medium.webp" breadcrumb="Order tracking" />
    <div className={styles.container}><div className={styles.trackingLayout}><Suspense fallback={<section className={styles.formPanel}><h2>Find your order.</h2><p>Loading your order lookup…</p></section>}><TrackingForm /></Suspense><aside className={styles.helpAside}>
      <div className={styles.asideIntro}><span className={styles.eyebrow}>Have these handy</span><h2>Two details. One order.</h2><p>Your order reference identifies the purchase. Your matching email address helps keep its details private.</p></div>
      <div className={styles.checklist}><h3>Before you look it up</h3><ul><li>Check the reference in your order confirmation.</li><li>Use the email address entered for the order.</li><li>Copy the full reference, including any letters.</li><li>Check your dispatch email for a carrier link.</li></ul></div><SupportLinks />
    </aside></div>
    <section className={styles.guideSection} aria-labelledby="tracking-steps-title"><div className={styles.sectionHeading}><span className={styles.eyebrow}>From order to door</span><h2 id="tracking-steps-title">What happens along the way?</h2><p>Your order’s recorded status is shown above. These are the usual steps to look for in your updates.</p></div><ol className={styles.timeline}>{[
      ["Order recorded", "Your reference connects your boxes and delivery details to your order."],
      ["Being prepared", "Your selected boxes, kits and supplies are gathered for dispatch."],
      ["Dispatched", "Carrier details and tracking are added when available for your delivery."],
      ["Delivered", "Check your items against the order and keep the packaging if something needs attention."],
    ].map(([title, content], index) => <li key={title}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{content}</p></li>)}</ol></section>
    <section className={styles.deliveryHelp}><div><span className={styles.eyebrow}>Need a hand?</span><h2>Something doesn’t look right?</h2><p>If your reference doesn’t return an order, double-check the confirmation details. For an address correction, missing item or delivery question, include your reference in an enquiry.</p></div><Link className={styles.primaryButton} href="/contact?subject=delivery">Get delivery help</Link></section>
    <section className={styles.faqSection} aria-labelledby="tracking-faq-title"><div><span className={styles.eyebrow}>Order questions</span><h2 id="tracking-faq-title">Tracking made simple.</h2><p>Find the information you need while your moving supplies are on their way.</p></div><Accordion items={[
      { title: "Where do I find my order reference?", content: "Check the order confirmation provided for your purchase. Copy the complete reference into the lookup form and use the email address entered for that order." },
      { title: "Why can’t I find my order?", content: "A lookup needs both an existing order reference and its matching email address. Check for typing errors and confirm which email address you used. If you still cannot find it, use the contact form and include the details from your confirmation." },
      { title: "Why isn’t there a carrier tracking link yet?", content: "An order can be recorded before it has been dispatched. A carrier link only appears when tracking details have been added to the order. Also check any dispatch message provided for your purchase." },
      { title: "Can I change my delivery address?", content: "Use the contact form with the delivery subject and include your order reference, the original address and the requested correction. What can be changed depends on whether your order has already been dispatched." },
      { title: "What if an item arrives damaged or is missing?", content: "Check your delivery against your order, keep the packaging and note which items and quantities are affected. Use the contact form to report the issue with your order reference and a clear description." },
    ]} /></section></div><HelpCTA title="Ready for the rest of your packing?" description="Add the right tape, protective wrap and covers to keep your move organised." />
  </main>;
}

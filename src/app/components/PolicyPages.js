"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageIntro, HelpCTA, Accordion } from "./PageContent";
import styles from "./PolicyPages.module.css";

const consumerRights = "https://www.consumerprotection.govt.nz/general-help/consumer-laws/consumer-guarantees-act";
const productRights = "https://www.consumerprotection.govt.nz/general-help/consumer-rights-finder/products";
const changeOfMind = "https://www.consumerprotection.govt.nz/general-help/common-consumer-issues/change-of-mind";
const privacyRights = "https://www.privacy.org.nz/privacy-principles/";

function ExternalLink({ href, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const pages = {
  "return-policy": {
    eyebrow: "Customer care",
    title: "Returns & refunds",
    description: "Something isn’t right with your order? Here’s how to get help with a damaged carton, a missing item or a return request.",
    image: "/boxes/" + encodeURIComponent("mighty box with handles.webp"),
    cards: [
      ["Order issue", "Tell us what arrived and what you expected."],
      ["Keep the details", "Your order reference and photos help us resolve it."],
      ["We’ll agree a next step", "Get return instructions before arranging a shipment."],
    ],
    sections: [
      { id: "start-a-return", title: "Start a return or report an issue", content: <><p>Use our <Link href="/contact?topic=Returns">contact form</Link> and choose Returns or Order issue. Include the order reference, the name used for the order and the product you need help with. Explain whether the item is damaged, incorrect, missing or no longer needed.</p><ol className={styles.steps}><li><strong>Find your order details.</strong><span>Include the reference from your confirmation. If you don’t have it, give us the email address and approximate order date.</span></li><li><strong>Describe the issue.</strong><span>Tell us which box or supply is affected and the quantity. Keep photos of the product, outer packaging and delivery label where relevant.</span></li><li><strong>Agree the resolution.</strong><span>We’ll assess the request and provide the next steps, including the return address or collection arrangements if a return is needed.</span></li></ol><p>Keep the affected items while the issue is being reviewed. Please do not send goods to an unconfirmed address; the correct return location may differ from the dispatch location.</p></> },
      { id: "damaged-wrong-missing", title: "Damaged, wrong or missing items", content: <><p>Check the products and quantities against your confirmation when the delivery arrives. If a carton has crushed edges, torn panels or another defect that prevents its intended use, set it aside and contact us. For packing supplies, describe the fault and how it affects the product.</p><div className={styles.checklist}><h3>Useful details to send</h3><ul><li>Order reference and contact email</li><li>Product name, size and quantity affected</li><li>A description of the damage or discrepancy</li><li>Photos of the item and delivery packaging, if available</li><li>Whether the whole order or only part of it was affected</li></ul></div><p>For a missing item, check whether your order was split into more than one parcel. For an incorrect item, keep the unused item and its packaging so we can identify it. You can contact us even if you no longer have the original packaging.</p></> },
      { id: "change-of-mind", title: "Unused boxes & change of mind", content: <><p>Ordered too many boxes, picked the wrong size or changed your moving plans? Contact us with the product names, quantities and condition of the items. Tell us whether the boxes are still flat, have been assembled, or have tape, writing or damage.</p><p>Change-of-mind requests are assessed individually. Contacting us does not automatically approve a return, exchange or credit. Any agreed return conditions and transport costs will be explained before you send the items back.</p><p>A change of mind is different from receiving faulty or incorrectly supplied goods. <ExternalLink href={changeOfMind}>Consumer Protection explains the distinction</ExternalLink>.</p><div className={styles.note}><strong>Unsure about a size?</strong><p>Check the dimensions on the <Link href="/boxes">box collection</Link>, or <Link href="/contact?topic=Product%20advice">ask us about the item you’re packing</Link> before you order.</p></div></> },
      { id: "kits-and-bundles", title: "Moving kits & multipacks", content: <><p>A moving kit contains the quantities shown in its contents list. When reporting an issue, name the individual box type and quantity affected. You do not need to describe a damaged wardrobe box as a problem with every box in the kit.</p><p>Specialty boxes added to a kit appear as separate items in your cart and order request. Include those names separately when asking for help. If you selected the 24-inch wardrobe upgrade, mention it so we can compare the delivery with the selected configuration.</p><p>For a change-of-mind request involving a kit or multipack, tell us whether the bundle is complete and which items remain unused. We’ll explain any available arrangement before accepting the return.</p></> },
      { id: "consumer-rights", title: "Your consumer rights", content: <><p>For eligible consumer purchases in New Zealand, goods must meet the guarantees under the Consumer Guarantees Act. A problem with quality, description or fitness for purpose may entitle you to a remedy. The appropriate remedy depends on the circumstances and the nature of the fault.</p><p>This policy does not exclude or limit rights that cannot lawfully be excluded. An item being on sale does not remove those rights.</p><p><ExternalLink href={productRights}>Check your rights with products at Consumer Protection</ExternalLink>.</p></> },
    ],
    faqs: [
      { title: "Can I ask for help without an order reference?", content: "Yes. Give us the name and email used for the order, the approximate date and any other proof of purchase you have. These details help us identify the order." },
      { title: "Should I send the boxes back immediately?", content: "Contact us first so we can identify the issue and give you the correct return instructions. Keep the products while the request is reviewed." },
      { title: "What if only one box in my kit is damaged?", content: "Report that box type and the quantity affected. Include your kit name and any selected upgrades or add-ons so we can review the correct configuration." },
    ],
    ctaTitle: "Let’s sort out your order",
    ctaDescription: "Have your reference and the affected product details ready, then send a return or order enquiry.",
  },
  "delivery-policy": {
    eyebrow: "Delivery & dispatch",
    title: "From our boxes to your door",
    description: "How delivery is arranged, what to include with your order and what to do when a parcel needs attention.",
    image: "/boxes/" + encodeURIComponent("large.webp"),
    cards: [
      ["Address first", "A complete address helps us confirm delivery."],
      ["Delivery confirmed", "Charges and timing are agreed with your order."],
      ["Follow your order", "Keep your reference handy for status enquiries."],
    ],
    sections: [
      { id: "placing-your-order", title: "Delivery starts with your order", content: <><p>Select your boxes, kit and packing supplies, then submit your order request from the cart. The request records the products, quantities and your contact details. It does not charge a payment card.</p><p>Delivery availability, delivery charges, payment arrangements and the expected dispatch timing are confirmed when the store reviews your request. Submitting a request is not a promise of delivery on a particular date.</p><p>Tell us your moving date if you have one. We can assess the order against the available delivery arrangements before you commit to a confirmed order.</p><Link className={styles.textLink} href="/cart">Review your cart</Link></> },
      { id: "address-and-access", title: "Your address & delivery instructions", content: <><p>Provide the recipient’s name, street number and name, suburb, town or city, and postcode. Include a unit or apartment number where applicable. Use an email address and phone number where you can be reached about the delivery.</p><div className={styles.twoColumns}><div><h3>For homes & apartments</h3><ul><li>Building or unit number</li><li>Gate, entry or intercom instructions</li><li>Access restrictions for a bulky delivery</li><li>Any requested safe-place instructions</li></ul></div><div><h3>For workplaces</h3><ul><li>Business name and recipient</li><li>Reception or goods-entry location</li><li>Opening hours that affect access</li><li>Loading-area restrictions</li></ul></div></div><p>Special instructions are requests and must be confirmed as part of the delivery arrangement. If your address changes after submitting your order, <Link href="/contact?topic=Delivery">contact us</Link> with the order reference as soon as possible.</p></> },
      { id: "charges-and-timing", title: "Delivery charges & timing", content: <><p>The product subtotal in your cart is the cost of the selected products. Delivery is confirmed separately using the destination and the size of the order. Large specialty cartons and a full moving kit can require different handling from a small supply order.</p><p>Check the delivery charge and expected timing in your order confirmation before making payment. If an order needs to be split, the store will explain the arrangement. A collection request also needs to be agreed; there is no walk-in collection address listed on this website.</p><div className={styles.note}><strong>Planning around moving day?</strong><p>Order with enough time to pack, assemble boxes and resolve any last-minute additions. Include your preferred date in the order notes so it can be considered during confirmation.</p></div></> },
      { id: "tracking-and-receiving", title: "Tracking & receiving your boxes", content: <><p>Use the <Link href="/tracking">order tracking page</Link> with your order reference and the email address used for the order to see the recorded status. If courier tracking is supplied with a confirmed dispatch, use those details for the courier’s latest updates.</p><p>When the delivery arrives, count the items and compare the box sizes, supplies and kit contents with the order. Keep the delivery label and packaging until you have checked everything. Store cardboard in a dry, sheltered space before your move.</p><p>If you cannot locate a parcel marked as delivered, check the agreed delivery location and whether another household member or reception accepted it. Then contact us with the reference and the latest delivery information.</p></> },
      { id: "delivery-problems", title: "A delivery problem? Get in touch", content: <><p>For a delayed, damaged, incomplete or incorrect delivery, contact us through the <Link href="/contact?topic=Delivery">delivery enquiry form</Link>. Include the order reference, destination postcode and a clear description of what happened. Photos are useful for damage reports.</p><p>Keep the affected items and packaging where practical while we review the issue. Our <Link href="/return-policy">returns page</Link> explains how to report product problems.</p><p>For eligible New Zealand consumer purchases, delivery obligations are part of the applicable consumer guarantees. <ExternalLink href={consumerRights}>Read the Consumer Protection guide</ExternalLink>.</p></> },
    ],
    faqs: [
      { title: "Is delivery included in the product price?", content: "The cart shows the product subtotal. Delivery availability and any delivery charge are confirmed for your address with the order request." },
      { title: "Can I request a specific delivery date?", content: "Include your preferred date and moving date in the order notes. The store must confirm whether the requested arrangement is available." },
      { title: "How do I change my address?", content: "Send a delivery enquiry with your order reference and the correct address. If the order has already been dispatched, the available options depend on its delivery status." },
    ],
    ctaTitle: "Need help with a delivery?",
    ctaDescription: "Send your order reference and delivery details so we can identify the right order.",
  },
  terms: {
    eyebrow: "Shopping with save on boxes",
    title: "Terms & conditions",
    description: "Clear information about using our store, requesting an order and choosing the products for your move.",
    image: "/boxes/" + encodeURIComponent("medium.webp"),
    cards: [
      ["Products & prices", "Review the item, size and quantity before ordering."],
      ["Order confirmation", "Availability and delivery are confirmed by the store."],
      ["Consumer rights", "Your mandatory legal rights continue to apply."],
    ],
    sections: [
      { id: "using-the-store", title: "1. Using the website", content: <><p>These terms apply to your use of the Save On Boxes website and order requests submitted through it. Use the store for lawful shopping and enquiries. Do not interfere with the website, try to access another customer’s information or submit misleading details.</p><p>You are responsible for providing accurate contact and delivery information and for reviewing your chosen products. If you are ordering for someone else, make sure you have permission to provide their information and receive the order on their behalf.</p></> },
      { id: "products-and-contents", title: "2. Product information & kit contents", content: <><p>Product names, purposes, dimensions and pack quantities are displayed with each item. Check the stated dimensions against the object you are packing. A TV screen size alone does not account for the television’s stand, thickness or protective material.</p><p>Product images illustrate the products; colour and appearance can vary with lighting and screen settings. The listed product description and selected quantity identify what you are requesting.</p><p>Moving kits contain the box quantities in their contents list. Standard kits use the 20-inch wardrobe box unless you select the 24-inch upgrade. Specialty boxes and packing supplies are separate additions unless the displayed kit contents expressly include them.</p><p>The packing suggestions are a starting point. Choose suitable cushioning, avoid overloading cartons and follow relevant handling guidance for fragile or valuable items.</p></> },
      { id: "prices", title: "3. Prices & availability", content: <><p>All product prices are displayed in US dollars (USD). A multipack price applies to the displayed pack quantity. The cart product subtotal reflects the selected products and quantities; delivery charges are confirmed separately.</p><p>Availability and the final order total are confirmed by the store before payment and dispatch are arranged. If a displayed price or product detail contains an error, we will explain the correction and ask you to confirm the revised request before proceeding.</p><p>You can remove items or change quantities in your cart before submitting a request. Prices shown on the website may change for future requests; the agreed confirmation governs a confirmed order.</p></> },
      { id: "order-requests", title: "4. Order requests, payment & confirmation", content: <><p>Submitting the cart sends an order request and creates a reference. The website does not collect card details or take payment. A request acknowledgement confirms that the details were recorded; it is not payment confirmation or a dispatch notice.</p><p>The store reviews the requested items, availability, delivery details and any notes before confirming the order and payment arrangements. Check the confirmation carefully and raise any discrepancy before payment.</p><p>An order may need clarification or an agreed substitution if a selected product is unavailable. A different item or additional charge must be agreed with you rather than silently added to the request.</p></> },
      { id: "changes-and-delivery", title: "5. Changes, cancellation & delivery", content: <><p>Contact us with your reference to request a change or cancellation. The options depend on whether the request has been confirmed, paid, prepared or dispatched. We will explain any agreed next steps before changing the order.</p><p>Provide a complete delivery address and relevant access instructions. Delivery availability, charges and expected timing are confirmed with the order. See the <Link href="/delivery-policy">delivery policy</Link> for address guidance and how to report a delivery issue.</p><p>If your moving date changes, tell us promptly. A preferred date supplied in your notes is a request until it is confirmed.</p></> },
      { id: "returns-and-rights", title: "6. Product issues & consumer guarantees", content: <><p>If an item is damaged, incorrect or faulty, contact us with the order and product details. The <Link href="/return-policy">returns policy</Link> explains the reporting process and how change-of-mind requests are considered.</p><p>Nothing in these terms excludes rights or remedies that cannot lawfully be excluded under New Zealand consumer law. For eligible purchases, the Consumer Guarantees Act applies independently of this website’s terms.</p><p><ExternalLink href={consumerRights}>Consumer Guarantees Act guidance</ExternalLink>.</p></> },
      { id: "privacy-and-saved-data", title: "7. Privacy & saved shopping data", content: <><p>We use the information you provide to respond to enquiries and handle order requests. Read the <Link href="/privacy">privacy policy</Link> for the information collected, its use and how to ask for access or correction.</p><p>Your cart and saved products are stored in the browser on the device you use. Clearing that browser’s storage removes those saved selections. The <Link href="/cookies">cookies & browser storage page</Link> includes controls to clear them.</p><p>Keep order references private. Order lookup requires the reference and the email address supplied with the order.</p></> },
      { id: "questions-and-updates", title: "8. Questions & updates", content: <><p>Questions about these terms, a product or an order can be sent through the <Link href="/contact?topic=General%20enquiry">contact page</Link>. Describe the issue and include your order reference where relevant.</p><p>We may update the information on this page as the store changes. The terms available when an order is confirmed apply to that order, subject to any rights the law gives you.</p></> },
    ],
    ctaTitle: "A question before you order?",
    ctaDescription: "Ask about a box, a kit configuration or the details of your order request.",
  },
  privacy: {
    eyebrow: "Your information",
    title: "Privacy policy",
    description: "What we collect when you shop or contact us, how it is used and how to manage your saved information.",
    image: "/boxes/" + encodeURIComponent("file storage box with lid.webp"),
    cards: [
      ["Only what you provide", "Contact and order details support your request."],
      ["Your browser, your cart", "Shopping selections are saved on your device."],
      ["Access & correction", "Contact us about information you have submitted."],
    ],
    sections: [
      { id: "what-we-collect", title: "Information you provide", content: <><p>When you submit an enquiry, we collect the name, email address, subject and message entered in the contact form, along with any optional contact or order information you include. The enquiry is recorded by the store’s server so it can be handled.</p><p>An order request includes the selected products and quantities, your contact information, delivery details and any order notes. The order reference links those details to the request.</p><p>The website does not ask for a payment-card number. Do not include card details, passwords, identity documents or other sensitive information in an enquiry or order note.</p></> },
      { id: "how-we-use-it", title: "How your information is used", content: <><p>We use enquiry information to understand the question and respond using the contact details you supply. Order details are used to review the request, confirm availability and delivery, arrange payment and fulfilment, and handle related service issues.</p><ul><li>Identify your order or enquiry when you ask for help</li><li>Clarify products, quantities and kit configurations</li><li>Confirm delivery details and provide order updates</li><li>Review missing, damaged or incorrect items</li><li>Respond to access, correction or other privacy requests</li></ul><p>Submitting an enquiry does not enrol you in a marketing mailing list. This website does not currently run advertising or analytics trackers.</p></> },
      { id: "browser-storage", title: "Shopping data on your device", content: <><p>The cart and saved-product list use browser local storage. This keeps your selected products available when you return using the same browser. These saved selections are not an order until you submit an order request.</p><p>Local storage is specific to the browser and device you use. A cart on your phone does not automatically appear on another computer. Other people using the same browser profile may be able to see its saved cart and products.</p><p>Use the controls on the <Link href="/cookies">cookies & browser storage page</Link> to clear these selections, or remove this site’s saved data using your browser settings. Clearing browser storage does not delete an enquiry or order request already recorded on the server.</p></> },
      { id: "services-and-sharing", title: "Services used by the website", content: <><p>When the site loads, your browser connects to the website server to request pages and images. It also requests the Raleway font from Google Fonts. Those requests expose ordinary connection information, such as your IP address, to the receiving service.</p><p>Contact submissions and order requests are recorded on the store’s server. No advertising platform is used to profile your shopping activity. If delivery is arranged, the recipient and address details necessary to deliver the order are used for that purpose.</p><p>We do not sell the personal information you provide. Information may also need to be retained or supplied where required by law.</p><p><ExternalLink href="https://policies.google.com/privacy">Google’s privacy information</ExternalLink> describes its handling of information received by its services.</p></> },
      { id: "retention-and-security", title: "Keeping information", content: <><p>Order and enquiry records are kept for handling the request, related customer service and any applicable recordkeeping requirements. A request to delete information is assessed alongside those purposes and legal obligations.</p><p>We take reasonable steps to protect personal information against unauthorised access and misuse. Please keep your order reference private and use the contact form to tell us if you think your details have been used incorrectly.</p><p>Browser-saved shopping data remains until you remove it, clear the browser’s storage or change the selected products. It is not automatically removed when you close a tab.</p></> },
      { id: "your-privacy-rights", title: "Access, correction & privacy enquiries", content: <><p>You can ask to access personal information held about you or to correct information you believe is inaccurate. Use the <Link href="/contact?topic=Privacy">contact form</Link>, select Privacy and describe the request. Include enough information to identify the relevant enquiry or order.</p><p>We may need to verify your identity before releasing or changing personal information. Do not send identity documents in the first message. We will explain what is needed if verification is required.</p><p>New Zealand’s privacy principles cover the collection, use and protection of personal information, including access and correction rights. <ExternalLink href={privacyRights}>Read the Office of the Privacy Commissioner’s guidance</ExternalLink>.</p><p>If you have a concern, contact us first with the details so it can be investigated. You can also <ExternalLink href="https://www.privacy.org.nz/your-rights/making-a-complaint/">find information about privacy complaints</ExternalLink>.</p></> },
    ],
    ctaTitle: "Want to ask about your information?",
    ctaDescription: "Use the contact page for access, correction, deletion or another privacy enquiry.",
  },
  cookies: {
    eyebrow: "Your browser settings",
    title: "Cookies & browser storage",
    description: "Understand how your shopping selections are saved and clear them whenever you choose.",
    image: "/boxes/" + encodeURIComponent("small.webp"),
    cards: [
      ["Saved cart", "Products and quantities stay in this browser."],
      ["Saved products", "Your wishlist is stored on this device."],
      ["No ad tracking", "No advertising or analytics cookies are set by this store."],
    ],
    sections: [
      { id: "what-we-use", title: "What this store uses", content: <><p>Save On Boxes uses local storage to remember your cart and saved products. Local storage is a browser feature separate from cookies: it stores small amounts of information on your device and does not expire when you close a tab.</p><p>The store currently does not set advertising or analytics cookies. There is no optional analytics or advertising category to switch on or off.</p><p>The storage listed below supports the shopping features you choose to use. You can remove it without losing access to the product collections or help pages.</p><div className={styles.tableWrap}><table><thead><tr><th>Storage key</th><th>What it stores</th><th>Where it is kept</th></tr></thead><tbody><tr><td><code>saveonboxes-cart</code></td><td>Cart products and selected quantities</td><td>This browser until cleared</td></tr><tr><td><code>saveonboxes-wishlist</code></td><td>Identifiers of your saved products</td><td>This browser until cleared</td></tr></tbody></table></div></> },
      { id: "manage-saved-data", title: "Manage your saved shopping data", content: <><p>Use these controls to remove the saved cart or wishlist from this browser. Your recorded order requests and contact enquiries remain on the server; clearing browser storage does not cancel an order.</p><StorageControls /></> },
      { id: "browser-settings", title: "Managing data through your browser", content: <><p>You can also remove this website’s data in the privacy or site-data settings of your browser. Look for the website address, then clear its saved data. Browser menus vary, so use your browser’s help for the current steps.</p><div className={styles.twoColumns}><div><h3>If you block storage</h3><p>You can continue browsing. The cart and saved products may only remain available while the current page is open, and may not be restored on a later visit.</p></div><div><h3>If you share a device</h3><p>Remove the saved selections when you finish shopping if you do not want the next person using the same browser profile to see them.</p></div></div><p>Private or incognito browser windows may clear local storage when the private session ends. Saved selections do not synchronise between devices or separate browser profiles.</p></> },
      { id: "fonts-and-requests", title: "Fonts & ordinary page requests", content: <><p>The site loads the Raleway typeface through Google Fonts. Your browser requests the font files from Google, which receives the connection information needed to deliver them. This is separate from the saved cart and wishlist.</p><p>Page and image requests also reach the website server. This page describes the shopping storage implemented by the store; it does not control your browser extensions or other websites you visit.</p><p>Read our <Link href="/privacy">privacy policy</Link> for how enquiry and order information is handled, and <ExternalLink href="https://policies.google.com/privacy">Google’s privacy information</ExternalLink> for its services.</p></> },
    ],
    faqs: [
      { title: "Will clearing my cart cancel an order?", content: "No. It removes saved selections from this browser. An order request already submitted to the server has its own reference and must be changed through an order enquiry." },
      { title: "Why is my cart different on another device?", content: "The cart is saved in the browser on the device you used. It is not linked to a cross-device customer account." },
      { title: "Are you using advertising or analytics cookies?", content: "This storefront currently does not set advertising or analytics cookies. It saves the cart and wishlist using local storage." },
    ],
    ctaTitle: "Have a privacy question?",
    ctaDescription: "Ask us about browser storage or information submitted with an order or enquiry.",
  },
};

function StorageControls() {
  const [counts, setCounts] = useState({ cart: 0, wishlist: 0 });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const read = () => {
      try {
        const cart = JSON.parse(localStorage.getItem("saveonboxes-cart") || "[]");
        const wishlist = JSON.parse(localStorage.getItem("saveonboxes-wishlist") || "[]");
        setCounts({ cart: Array.isArray(cart) ? cart.length : 0, wishlist: Array.isArray(wishlist) ? wishlist.length : 0 });
      } catch { setCounts({ cart: 0, wishlist: 0 }); }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("saveonboxes-storage-change", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("saveonboxes-storage-change", read);
    };
  }, []);

  const clear = (name) => {
    try {
      const key = `saveonboxes-${name}`;
      localStorage.removeItem(key);
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }));
      window.dispatchEvent(new Event("saveonboxes-storage-change"));
      setCounts((current) => ({ ...current, [name]: 0 }));
      setNotice(name === "cart" ? "Your saved cart has been cleared from this browser." : "Your saved products have been cleared from this browser.");
    } catch { setNotice("Your browser did not allow the saved data to be cleared. Use its site-data settings to remove it."); }
  };

  return <div className={styles.storageControls}>
    <div><span className={styles.storageIcon} aria-hidden="true">▣</span><h3>Saved cart</h3><p>{counts.cart} product {counts.cart === 1 ? "line" : "lines"} saved in this browser</p><button type="button" onClick={() => clear("cart")}>Clear saved cart</button></div>
    <div><span className={styles.storageIcon} aria-hidden="true">♡</span><h3>Saved products</h3><p>{counts.wishlist} saved {counts.wishlist === 1 ? "product" : "products"} in this browser</p><button type="button" onClick={() => clear("wishlist")}>Clear saved products</button></div>
    <p className={styles.storageNotice} role="status" aria-live="polite">{notice}</p>
  </div>;
}

export default function PolicyPage({ slug }) {
  const page = pages[slug];
  if (!page) return null;
  return <main className="page-container">
    <PageIntro eyebrow={page.eyebrow} title={page.title} description={page.description} image={page.image} breadcrumb={page.title} />
    <div className={styles.page}>
      <div className={styles.summary} aria-label="At a glance">{page.cards.map(([title, description]) => <div key={title}><div><h2>{title}</h2><p>{description}</p></div></div>)}</div>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav aria-label="On this page"><h2>On this page</h2>{page.sections.map((section) => <a href={`#${section.id}`} key={section.id}>{section.title.replace(/^\d+\. /, "")}</a>)}{page.faqs && <a href="#common-questions">Common questions</a>}</nav>
          <div className={styles.sidebarHelp}><span className={styles.helpIcon} aria-hidden="true">?</span><h3>We’re here to help</h3><p>Have a question about your order or a product?</p><Link href="/contact">Contact our team</Link></div>
        </aside>
        <div className={styles.article}>
          <div className={styles.policyMeta}><span>Save On Boxes customer information</span><span>Updated 2 October 2026</span></div>
          {page.sections.map((section) => <section className={styles.section} id={section.id} key={section.id}><h2>{section.title}</h2>{section.content}</section>)}
          {page.faqs && <section className={styles.section} id="common-questions"><span className={styles.eyebrow}>A little more help</span><h2>Common questions</h2><Accordion items={page.faqs} /></section>}
          <nav className={styles.related} aria-label="Related customer information"><h3>More customer information</h3><div>{Object.entries(pages).filter(([key]) => key !== slug).map(([key, item]) => <Link key={key} href={`/${key}`}>{item.title}</Link>)}</div></nav>
        </div>
      </div>
    </div>
    <HelpCTA title={page.ctaTitle} description={page.ctaDescription} />
  </main>;
}

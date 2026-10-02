"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { boxProducts, kitAddonGroups, kits, productsById, supplies } from "../catalog";

const StoreContext = createContext(null);
export function useStore() { return useContext(StoreContext); }

export const productImage = (product) => product.image.startsWith("/") ? product.image : `/boxes/${encodeURIComponent(product.image)}`;
export const productTitle = (product) => product.packQty ? `${product.packQty} × ${product.name}` : product.name;
export const formatPrice = (price) => price == null ? "Price coming soon" : `$${price.toFixed(2)}`;

export function Icon({ name, size = 20 }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const shapes = {
    cart: <><circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M2 3h2l2.6 12.1a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.5L22 8H5" /></>,
    user: <><circle cx="12" cy="8" r="3.3" /><path d="M5.5 21v-1.2a6.5 6.5 0 0 1 13 0V21" /></>,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    heart: <path d="M20.8 8.8c0 5-8.8 10-8.8 10s-8.8-5-8.8-10a4.6 4.6 0 0 1 8.8-1.7 4.6 4.6 0 0 1 8.8 1.7Z" />,
    compare: <><path d="M4 7h15l-3-3M20 17H5l3 3" /><path d="m16 4 3 3-3 3M8 14l-3 3 3 3" /></>,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    top: <path d="m6 14 6-6 6 6" />,
    box: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z" /><path d="m3 7 9 4 9-4M12 11v10M7.5 5 16 9" /></>,
    award: <><circle cx="12" cy="8" r="6" /><path d="m8 13-1 8 5-3 5 3-1-8" /><path d="m9.5 8 1.6 1.6L14.8 6" /></>,
    package: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z" /><path d="m3 7 9 4 9-4M12 11v10" /></>,
    phone: <path d="M7.2 3.5 5.1 3c-.8-.2-1.7.2-2 1-.7 1.8-.8 3.9.1 6.4 1.5 4.5 5.8 8.8 10.3 10.3 2.5.9 4.6.8 6.4.1.8-.3 1.2-1.2 1-2l-.5-2.1a1.8 1.8 0 0 0-1.3-1.3l-2.7-.7a1.8 1.8 0 0 0-1.8.5l-1.2 1.2a14.2 14.2 0 0 1-5.4-5.4l1.2-1.2a1.8 1.8 0 0 0 .5-1.8L9 4.8a1.8 1.8 0 0 0-1.8-1.3Z" />,
    play: <path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none" />,
  };
  return <svg {...props}>{shapes[name]}</svg>;
}

export function BrandMark({ light = false }) {
  return <a href="/" className={`brand-mark${light ? " brand-mark-light" : ""}`} aria-label="Save On Boxes home">
    <img src="/assets/Logo-horizontal.svg" alt="Save On Boxes" />
  </a>;
}

export function ProductCard({ product }) {
  const { addToCart: onAdd, openProduct: onQuick, toggleWishlist: onWish, wishedIds } = useStore();
  const wished = wishedIds.has(product.id);
  const isKit = Boolean(product.boxCount);
  return <article className="product-card" data-product-id={product.id}>
    <div className="product-image-wrap">
      <button className="product-image-button" onClick={() => onQuick(product)} aria-label={`Quick view ${productTitle(product)}`}><img src={productImage(product)} alt={productTitle(product)} loading="lazy" /></button>
      {product.badge && <div className={`product-badge${isKit ? " product-badge-kit" : " product-badge-quantity"}`}>{isKit ? `${product.badge} · ${product.boxCount} BOXES` : product.badge}</div>}
      <div className="product-actions">
        <button aria-label={`Quick view ${productTitle(product)}`} title="Quick view" onClick={() => onQuick(product)}><Icon name="eye" size={18} /></button>
        <button aria-label={`${wished ? "Remove from" : "Add to"} wishlist: ${productTitle(product)}`} title="Add to Wishlist" onClick={() => onWish(product.id)} className={wished ? "is-wished" : ""}><Icon name="heart" size={17} /></button>
        <button aria-label={`Compare ${productTitle(product)}`} title="Add to Compare" onClick={() => onQuick(product)}><Icon name="compare" size={17} /></button>
        <button aria-label={`Add ${productTitle(product)} to cart`} title="Add to cart" onClick={() => onAdd(product)}><Icon name="cart" size={17} /></button>
      </div>
    </div>
    <button className="product-name" onClick={() => onQuick(product)}>{productTitle(product)}</button>
    {product.purpose && <div className="product-purpose">{product.purpose}</div>}
    {product.detail && <div className="product-detail">{product.detail}</div>}
    {isKit && <div className="product-detail">{product.boxCount} boxes · box-only kit</div>}
    <div className={`product-price${product.price == null ? " price-pending" : ""}`}>{formatPrice(product.price)}</div>
  </article>;
}

export function ProductSection({ id, title, icon = "package", products, carousel = false }) {
  const rail = useRef(null);
  const move = (direction) => rail.current?.scrollBy({ left: direction * Math.max(rail.current.clientWidth * 0.82, 300), behavior: "smooth" });
  return <section className="product-section" id={id}>
    <div className="section-heading">
      <div className="section-heading-title"><span className="section-icon"><Icon name={icon} size={22} /></span><span>{title}</span></div>
    </div>
    {carousel ? <div className="product-row-wrap">
      <button className="row-arrow row-arrow-left" onClick={() => move(-1)} aria-label={`Previous ${title}`}><Icon name="left" size={21} /></button>
      <div className="product-rail" ref={rail}>{products.map((product, index) => <ProductCard key={`${product.id}-${index}`} product={product} />)}</div>
      <button className="row-arrow row-arrow-right" onClick={() => move(1)} aria-label={`Next ${title}`}><Icon name="right" size={21} /></button>
    </div> : <div className="product-grid" ref={rail}>{products.map((product, index) => <ProductCard key={`${product.id}-${index}`} product={product} />)}</div>}
  </section>;
}


export default function Storefront({ children }) {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickProduct, setQuickProduct] = useState(null);
  const [kitAddons, setKitAddons] = useState({});
  const [wardrobe24Upgrade, setWardrobe24Upgrade] = useState(false);
  const [wishedIds, setWishedIds] = useState(new Set());
  const [showTop, setShowTop] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => setShowTop(window.scrollY > 320);
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const openQuickView = (product) => { setQuickProduct(product); setKitAddons({}); setWardrobe24Upgrade(false); };
  const addCartItems = (entries, message) => {
    setCart((current) => entries.reduce((items, { product, quantity }) => {
      const found = items.find((item) => item.id === product.id);
      return found ? items.map((item) => item.id === product.id ? { ...item, quantity: Math.min(999, item.quantity + quantity) } : item) : [...items, { ...product, quantity }];
    }, current));
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };
  const addToCart = (product, quantity = 1) => addCartItems([{ product, quantity: Math.min(999, Math.max(1, Math.floor(Number(quantity)) || 1)) }], `${productTitle(product)} added to cart`);
  const addConfiguredKit = () => {
    if (!quickProduct?.boxCount) return;
    const wardrobeCount = quickProduct.contents.find(([name]) => name === 'Wardrobe 20"')?.[1] || 0;
    const configuredKit = wardrobe24Upgrade ? {
      ...quickProduct,
      id: `${quickProduct.id}-wardrobe24`,
      price: quickProduct.price + wardrobeCount * (productsById["wardrobe-24"].price - productsById["wardrobe-20"].price),
      configurationLabel: 'Included wardrobe cartons upgraded to 24"',
      contents: quickProduct.contents.map(([name, quantity]) => [name === 'Wardrobe 20"' ? 'Wardrobe 24"' : name, quantity]),
    } : quickProduct;
    const addOns = boxProducts.filter((product) => kitAddons[product.id] > 0).map((product) => ({ product, quantity: kitAddons[product.id] }));
    addCartItems([{ product: configuredKit, quantity: 1 }, ...addOns], `${quickProduct.name} added to cart${addOns.length ? " with specialty boxes" : ""}`);
    setQuickProduct(null);
  };
  const changeAddonQuantity = (productId, amount) => setKitAddons((current) => {
    const quantity = Math.min(999, Math.max(0, (current[productId] || 0) + amount));
    const next = { ...current };
    if (quantity) next[productId] = quantity;
    else delete next[productId];
    return next;
  });
  const toggleWish = (id) => setWishedIds((old) => { const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartHasPendingPrice = cart.some((item) => item.price == null);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const allProducts = [...kits, ...boxProducts, ...supplies];
  const visibleSearch = allProducts.filter((product) => productTitle(product).toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 7);
  const selectedKitAddons = quickProduct?.boxCount ? boxProducts.filter((product) => kitAddons[product.id] > 0) : [];
  const includedWardrobeCount = quickProduct?.contents?.find(([name]) => name === 'Wardrobe 20"')?.[1] || 0;
  const wardrobeUpgradeCost = wardrobe24Upgrade ? includedWardrobeCount * (productsById["wardrobe-24"].price - productsById["wardrobe-20"].price) : 0;
  const kitPricePending = quickProduct?.price == null || selectedKitAddons.some((product) => product.price == null);
  const configuredKitPrice = (quickProduct?.price || 0) + wardrobeUpgradeCost + selectedKitAddons.reduce((sum, product) => sum + (product.price || 0) * kitAddons[product.id], 0);
  const [storageReady, setStorageReady] = useState(false);
  const noticeTimer = useRef(null);
  useEffect(() => {
    const restore = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("saveonboxes-cart") || "[]");
        setCart(Array.isArray(saved) ? saved.map((item) => {
          const baseId = String(item.id || "").replace(/-wardrobe24$/, "");
          const base = [...boxProducts, ...kits, ...supplies].find((product) => product.id === baseId);
          if (!base || !Number.isInteger(item.quantity) || item.quantity < 1) return null;
          if (item.id !== base.id && !base.boxCount) return null;
          if (item.id !== base.id) {
            const count = base.contents.find(([name]) => name === 'Wardrobe 20"')?.[1] || 0;
            return { ...base, id: item.id, price: base.price + count * (productsById["wardrobe-24"].price - productsById["wardrobe-20"].price), quantity: Math.min(999, item.quantity), configurationLabel: 'Included wardrobe cartons upgraded to 24"', contents: base.contents.map(([name, quantity]) => [name === 'Wardrobe 20"' ? 'Wardrobe 24"' : name, quantity]) };
          }
          return { ...base, quantity: Math.min(999, item.quantity) };
        }).filter(Boolean) : []);
        const savedWishes = JSON.parse(localStorage.getItem("saveonboxes-wishlist") || "[]");
        setWishedIds(new Set(Array.isArray(savedWishes) ? savedWishes : []));
      } catch { setCart([]); setWishedIds(new Set()); }
      setStorageReady(true);
    };
    restore();
    window.addEventListener("storage", restore);
    window.addEventListener("saveonboxes-storage-change", restore);
    return () => { window.removeEventListener("storage", restore); window.removeEventListener("saveonboxes-storage-change", restore); window.clearTimeout(noticeTimer.current); };
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem("saveonboxes-cart", JSON.stringify(cart)); } catch {}
  }, [cart, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem("saveonboxes-wishlist", JSON.stringify([...wishedIds])); } catch {}
  }, [wishedIds, storageReady]);
  const modalOpen = cartOpen || searchOpen || Boolean(quickProduct);
  useEffect(() => {
    if (!modalOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => document.querySelector('[role="dialog"] button, [role="dialog"] input')?.focus(), 0);
    const keydown = (event) => {
      if (event.key === "Escape") { setCartOpen(false); setSearchOpen(false); setQuickProduct(null); }
      if (event.key === "Tab") {
        const dialog = document.querySelector('[role="dialog"]');
        const elements = dialog ? [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]')].filter((element) => element.getClientRects().length) : [];
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", keydown); previousFocus?.focus?.(); };
  }, [modalOpen, cartOpen, searchOpen, quickProduct?.id]);
  const updateQuantity = (id, quantity) => setCart((items) => quantity <= 0 ? items.filter((item) => item.id !== id) : items.map((item) => item.id === id ? { ...item, quantity: Math.min(999, Math.max(1, Math.floor(quantity))) } : item));
  const pathname = usePathname();
  const nav = [["Home", "/"], ["Boxes", "/boxes"], ["Kits", "/kits"], ["Extras", "/extras"], ["Contact", "/contact"]].map(([label, href]) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenuOpen(false)}>{label}</Link>);
  return <StoreContext.Provider value={{ cart, cartCount, cartTotal, storageReady, addToCart, openProduct: openQuickView, toggleWishlist: toggleWish, wishedIds, updateQuantity, removeFromCart: (id) => setCart((items) => items.filter((item) => item.id !== id)), clearCart: () => setCart([]), openCart: () => setCartOpen(true), openSearch: () => setSearchOpen(true) }}>
    <header className="site-header">
      <div className="header-inner">
        <BrandMark />
        <nav className="desktop-nav" aria-label="Main navigation">{nav}</nav>
        <div className="header-tools">
          <button className="search-trigger" aria-label="Search store" onClick={() => setSearchOpen(true)}><Icon name="search" size={19} /></button>
          <a className="login-link" href="/account"><Icon name="user" size={17} /><span>Login</span></a>
          <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Shopping cart, ${cartCount} items`}><Icon name="cart" size={22} /><span className="cart-count">{cartCount}</span></button>
          <button className="mobile-menu-trigger" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close menu" : "Open menu"}><Icon name={menuOpen ? "close" : "menu"} size={27} /></button>
        </div>
      </div>
      {menuOpen && <div className="mobile-menu"><nav aria-label="Mobile navigation">{nav}<button onClick={() => { setSearchOpen(true); setMenuOpen(false); }}><Icon name="search" size={17} /> Search</button></nav></div>}
    </header>
    {children}
    <footer className="site-footer" id="contact">
      <div className="footer-content">
        <BrandMark />
        <div className="footer-links">
          <nav aria-label="Footer navigation"><a href="/">Home</a><a href="/boxes">Boxes</a><a href="/kits">Kits</a><a href="/extras">Packing supplies</a><a href="/contact">Contact</a></nav>
          <nav aria-label="Policies"><a href="/return-policy">Return Policy</a><a href="/delivery-policy">Delivery Policy</a><a href="/terms">Terms &amp; Conditions</a><a href="/tracking">Order Tracking</a><a href="/privacy">Privacy Policy</a><a href="/cookies">Cookies Policy</a></nav>
        </div>
        <p className="copyright">© {new Date().getFullYear()} SaveOnBoxes - All rights reserved</p>
      </div>
    </footer>    {showTop && <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top"><Icon name="top" size={20} /></button>}
    {notice && <div className="toast" role="status">{notice}</div>}

    {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}><aside className="side-panel cart-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="panel-heading"><h2>Shopping Cart</h2><button onClick={() => setCartOpen(false)} aria-label="Close cart"><Icon name="close" /></button></div>
      {cart.length === 0 ? <p className="empty-cart">No products in the cart.</p> : <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><img src={productImage(item)} alt="" /><div><strong>{productTitle(item)}</strong>{item.configurationLabel && <span>{item.configurationLabel}</span>}<span>{item.price == null ? "Price to be confirmed" : `${item.quantity} × ${formatPrice(item.price)}`}</span></div><button aria-label={`Remove ${productTitle(item)}`} onClick={() => setCart((items) => items.filter((entry) => entry.id !== item.id))}>×</button></div>)}</div><div className="cart-subtotal"><span>{cartHasPendingPrice ? "Total:" : "Subtotal:"}</span><strong>{cartHasPendingPrice ? "Pricing pending" : formatPrice(cartTotal)}</strong></div><Link className="checkout-button" href="/cart" onClick={() => setCartOpen(false)}>View cart</Link></>}
    </aside></div>}

    {searchOpen && <div className="overlay search-overlay" onClick={() => setSearchOpen(false)}><section className="search-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search store">
      <button className="search-close" onClick={() => setSearchOpen(false)} aria-label="Close search"><Icon name="close" /></button>
      <label htmlFor="store-search">Search boxes, kits and packing supplies</label>
      <div className="search-field"><input id="store-search" autoFocus placeholder="Search the box collection…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><Icon name="search" size={20} /></div>
      {searchTerm && <div className="search-results">{visibleSearch.length ? visibleSearch.map((product) => <button key={product.id} onClick={() => { setSearchOpen(false); openQuickView(product); }}>{productTitle(product)}<span>{formatPrice(product.price)}</span></button>) : <p>No products found.</p>}</div>}
    </section></div>}

    {quickProduct && <div className="overlay" onClick={() => setQuickProduct(null)}><section className={`quick-view${quickProduct.boxCount ? " quick-view-kit" : ""}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Quick view ${productTitle(quickProduct)}`}>
      <button className="quick-close" onClick={() => setQuickProduct(null)} aria-label="Close quick view"><Icon name="close" /></button>
      <img className="quick-product-image" src={productImage(quickProduct)} alt={productTitle(quickProduct)} />
      <div className="quick-detail"><h2>{productTitle(quickProduct)}</h2><strong className={quickProduct.price == null ? "price-pending" : ""}>{formatPrice(quickProduct.price)}</strong>
        {quickProduct.boxCount ? <>
          <section className="kit-included"><h3>Standard box contents</h3><p className="kit-box-count">{quickProduct.boxCount} boxes · box-only kit · {wardrobe24Upgrade ? "24-inch wardrobe upgrade selected" : "20-inch wardrobe boxes"}</p><ul>{quickProduct.contents.map(([name, quantity]) => { const shownName = wardrobe24Upgrade && name === 'Wardrobe 20"' ? 'Wardrobe 24"' : name; return <li key={name}><span>{shownName}</span><strong>{quantity}</strong></li>; })}</ul></section>
          <section className="kit-addon-section"><h3>Add boxes for special items</h3>
            <fieldset className="kit-addon-group wardrobe-upgrade-group"><legend>Wardrobe options</legend><label className="wardrobe-upgrade-option"><input type="checkbox" checked={wardrobe24Upgrade} onChange={(event) => setWardrobe24Upgrade(event.target.checked)} /><span><strong>Upgrade included wardrobe boxes to 24&quot;</strong><small>Replaces the 20&quot; wardrobes in this kit.</small></span></label></fieldset>
            {kitAddonGroups.map((group) => <fieldset className="kit-addon-group" key={group.title}><legend>{group.title}</legend>{group.products.map((product) => <div className="kit-addon-row" key={product.id}><span><strong>{product.name}</strong><small>{formatPrice(product.price)}</small></span><div className="quantity-control"><button onClick={() => changeAddonQuantity(product.id, -1)} aria-label={`Remove one ${product.name}`} disabled={!kitAddons[product.id]}>−</button><output>{kitAddons[product.id] || 0}</output><button onClick={() => changeAddonQuantity(product.id, 1)} aria-label={`Add one ${product.name}`}>+</button></div></div>)}</fieldset>)}
          </section>
          <div className="kit-price-summary"><span>{kitPricePending ? "Kit and selected box prices" : "Kit + selected boxes"}</span><strong>{kitPricePending ? "Pricing pending" : formatPrice(configuredKitPrice)}</strong></div>
          <button className="checkout-button" onClick={addConfiguredKit}>Add {quickProduct.name} to cart</button>
        </> : <>
          {quickProduct.purpose && <p className="quick-purpose">{quickProduct.purpose}</p>}
          {quickProduct.detail && <p className="quick-product-detail">{quickProduct.detail}</p>}
          {quickProduct.packQty && <p className="quick-product-detail">Pack of {quickProduct.packQty}</p>}
          <button className="checkout-button" onClick={() => { addToCart(quickProduct); setQuickProduct(null); }}>Add to cart</button>
        </>}
      </div>
    </section></div>}

  </StoreContext.Provider>;
}

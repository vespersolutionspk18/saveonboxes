"use client";

import { useEffect, useMemo, useState } from "react";
import { boxProducts, getRoomProducts, kitAddonGroups, kits, productsById, rooms, supplies, types } from "../catalog";
import { ProductCard, formatPrice, productImage, useStore } from "./Storefront";
import { Accordion, HelpCTA, PageIntro } from "./PageContent";
import styles from "./ShopPages.module.css";

const roomAdvice = {
  bedroom: "Keep clothes together with wardrobe cartons and protect mirrors before you pack the rest of the room.",
  kitchen: "Use small cartons for heavy items, dish cartons for tableware and dividers for delicate glasses.",
  "living-room": "Choose a screen box to suit your television, then add cartons for decor, soft furnishings and artwork.",
  "home-office": "Pack books in small cartons, keep documents in lidded file boxes and protect computers separately.",
  garage: "Keep heavy items manageable and use handled cartons, file boxes or a bicycle carton where needed.",
  "whole-home": "Mix small cartons for heavy items with larger cartons for everyday belongings, linen and bedding.",
  nursery: "Use everyday cartons for toys and clothing, with a bicycle / crib carton for the larger items.",
};

function SectionHeading({ eyebrow, title, description, action, id }) {
  return <div className={styles.sectionHeading}>
    <div><span className={styles.eyebrow}>{eyebrow}</span><h2 id={id}>{title}</h2></div>
    {description && <p>{description}</p>}
    {action}
  </div>;
}

function ShopBenefits({ items }) {
  return <div className={styles.benefits}>{items.map(([title, description], index) =>
    <div key={title}><span className={styles.benefitNumber}>0{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></div>
  )}</div>;
}

function BuyCard({ product }) {
  const { addToCart, openProduct } = useStore();
  return <div className={styles.buyCard}>
    <ProductCard product={product} />
    <div className={styles.cardButtons}>
      <button className={styles.primaryButton} onClick={() => addToCart(product)}>Add to cart <span aria-hidden="true">+</span></button>
      <button className={styles.detailsButton} onClick={() => openProduct(product)} aria-label={`View ${product.name} details`}>Details</button>
    </div>
  </div>;
}

export function BoxShopPage() {
  const [room, setRoom] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [packSize, setPackSize] = useState("all");
  const [sort, setSort] = useState("featured");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRoom = params.get("room");
    const requestedType = params.get("type");
    if (rooms.some((item) => item.id === requestedRoom)) setRoom(requestedRoom);
    const requestedProducts = rooms.some((item) => item.id === requestedRoom) ? getRoomProducts(requestedRoom) : boxProducts;
    if (types.some((item) => item.id === requestedType) && requestedProducts.some((product) => product.type === requestedType)) setType(requestedType);
  }, []);

  const roomProducts = useMemo(() => room === "all" ? boxProducts : getRoomProducts(room), [room]);
  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    const result = roomProducts.filter((product) =>
      (type === "all" || product.type === type) &&
      (packSize === "all" || (packSize === "single" ? !product.packQty : Boolean(product.packQty))) &&
      (!search || `${product.name} ${product.purpose} ${product.detail} ${product.packQty || ""}`.toLowerCase().includes(search))
    );
    if (sort === "price-low") result.sort((a, b) => a.price - b.price);
    if (sort === "price-high") result.sort((a, b) => b.price - a.price);
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name) || (a.packQty || 1) - (b.packQty || 1));
    return result;
  }, [roomProducts, type, query, packSize, sort]);

  const selectedRoom = rooms.find((item) => item.id === room);
  const selectedType = types.find((item) => item.id === type);
  const hasFilters = room !== "all" || type !== "all" || query || packSize !== "all";
  const selectRoom = (id) => { setRoom(id); setType("all"); setQuery(""); setPackSize("all"); };
  const clearFilters = () => { setRoom("all"); setType("all"); setQuery(""); setPackSize("all"); };

  return <main className={`page-container ${styles.shopPage}`}>
    <PageIntro eyebrow="MOVING BOXES" title="A box for everything." breadcrumb="Moving boxes" description="Everyday cartons, room-specific protection and packs for the whole move. Find what you’re packing, then choose your boxes." image="/boxes/medium.png" />
    <div className={styles.container}>
      <ShopBenefits items={[["Choose by room", "See the boxes that suit the belongings in each space."], ["Choose your quantity", "Buy individual boxes or packs of 10, 20, 30 and 50."], ["Pack unusual items", "Find cartons for screens, dishes, mirrors and more."]]} />
      <section className={styles.roomFilterSection} aria-labelledby="box-room-heading">
        <SectionHeading id="box-room-heading" eyebrow="START WITH A ROOM" title="What are you packing?" description="Select a room to show its matching boxes below. Change rooms at any time." />
        <div className={styles.roomFilters} aria-label="Filter boxes by room">
          <button className={room === "all" ? styles.activeRoom : ""} aria-pressed={room === "all"} onClick={() => selectRoom("all")}><span className={styles.allRoomIcon} aria-hidden="true">⌂</span><strong>All rooms</strong><span>Every moving box</span></button>
          {rooms.map((item) => <button key={item.id} className={room === item.id ? styles.activeRoom : ""} aria-pressed={room === item.id} onClick={() => selectRoom(item.id)}><img src={`/boxes/${encodeURIComponent(item.image)}`} alt="" /><strong>{item.tile}</strong><span>{getRoomProducts(item.id).filter((product) => !product.packQty).length} box types</span></button>)}
        </div>
      </section>
      <section className={styles.collection} aria-label="Moving box collection">
        <aside className={styles.filterSidebar}>
          <h2>Box categories</h2>
          <div className={styles.categoryFilters}>
            <button onClick={() => setType("all")} className={type === "all" ? styles.activeCategory : ""} aria-pressed={type === "all"}>All boxes <span>{roomProducts.length}</span></button>
            {types.map((item) => {
              const count = roomProducts.filter((product) => product.type === item.id).length;
              return <button key={item.id} onClick={() => setType(item.id)} disabled={!count} className={type === item.id ? styles.activeCategory : ""} aria-pressed={type === item.id}>{item.title}<span>{count}</span></button>;
            })}
          </div>
          <div className={styles.sidebarTip}><span className={styles.eyebrow}>PACKING TIP</span><h3>Small for heavy. Large for light.</h3><p>Pack books and dense items into smaller boxes. Save the larger cartons for clothing, bedding and bulky items.</p><a href="/kits">Moving a whole home? Explore kits <span aria-hidden="true">→</span></a></div>
        </aside>
        <div className={styles.collectionProducts}>
          <div className={styles.resultsHeading}><div><h2>{selectedRoom ? selectedRoom.title : selectedType ? selectedType.title : "All moving boxes"}</h2><p>{selectedRoom ? roomAdvice[room] : "Choose everyday boxes, specialty cartons and multipacks for your move."}</p></div>{hasFilters && <button className={styles.resetButton} onClick={clearFilters}>Clear filters ×</button>}</div>
          <div className={styles.toolbar}>
            <label className={styles.searchField}><span className={styles.fieldLabel}>Search boxes</span><input type="search" placeholder="Try wardrobe, TV, books…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label><span className={styles.fieldLabel}>Quantity</span><select value={packSize} onChange={(event) => setPackSize(event.target.value)}><option value="all">Singles & packs</option><option value="single">Individual boxes</option><option value="packs">Multipacks</option></select></label>
            <label><span className={styles.fieldLabel}>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label>
          </div>
          <div className={styles.resultCount} role="status" aria-live="polite"><strong>{visibleProducts.length}</strong> {visibleProducts.length === 1 ? "product" : "products"}{selectedRoom ? ` for ${selectedRoom.title}` : ""}{selectedType ? ` · ${selectedType.title}` : ""}</div>
          {visibleProducts.length ? <div className={styles.boxGrid}>{visibleProducts.map((product) => <BuyCard key={product.id} product={product} />)}</div> : <div className={styles.emptyResults}><span aria-hidden="true">⌕</span><h3>No boxes match these filters.</h3><p>Try another search or clear the filters to see the full collection.</p><button className={styles.primaryButton} onClick={clearFilters}>Show all boxes</button></div>}
        </div>
      </section>
      <section className={styles.guidanceSection}>
        <SectionHeading eyebrow="A SIMPLE SIZE GUIDE" title="Match the box to the job." description="Start with what goes inside. Dimensions appear on each product for a closer fit." />
        <div className={styles.sizeGuide}>{[["small", "Small", "Books & heavy items", "Keep dense items in small cartons so every box stays easier to carry."], ["medium", "Medium", "Everyday packing", "A versatile size for kitchenware, toys and everyday household belongings."], ["large", "Large", "Clothes & household items", "Use more space for lighter belongings, folded clothing and larger items."], ["xlarge", "X-Large", "Bedding & bulky items", "Fill with pillows, quilts and other bulky items that don’t weigh much."]].map(([id, title, subtitle, text]) => <article key={id}><img src={productImage(boxProducts.find((product) => product.id === id))} alt={`${title} moving box`} /><span className={styles.eyebrow}>{subtitle}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className={styles.faqSection}><SectionHeading eyebrow="BEFORE YOU PACK" title="Moving box questions." /><Accordion items={[
        { title: "Should I buy single boxes or a multipack?", content: "Single boxes let you top up exactly what you need. Multipacks give you 10, 20, 30 or 50 of one size. If you need a mix of sizes for a whole home, compare the moving kits." },
        { title: "How do I choose a TV or mirror box?", content: "Measure the item before ordering. Use the screen size guide on TV cartons and the dimensions on mirror cartons, leaving room for suitable cushioning. A TV’s diagonal screen measurement is different from its overall packed dimensions." },
        { title: "Can I add specialty boxes to a moving kit?", content: "Yes. Open any moving kit, choose the wardrobe upgrade if needed, and select extra TV, mirror, electronics, dish, bicycle, lamp or file cartons. Your selection is added with the kit." },
        { title: "Do boxes include tape and packing materials?", content: "The moving kits are box-only. Tape, bubble wrap, tools and protective covers are sold separately in Packing Supplies so you can choose the extras you need." },
      ]} /></section>
    </div>
    <HelpCTA title="Need a mix for the whole move?" description="Choose a ready-made box kit, then add protection for your special items." />
  </main>;
}

export function KitsShopPage() {
  const { addToCart, openProduct } = useStore();
  const wardrobeUpgrade = productsById["wardrobe-24"].price - productsById["wardrobe-20"].price;
  return <main className={`page-container ${styles.shopPage}`}>
    <PageIntro eyebrow="BOX-ONLY MOVING KITS" title="Your move, boxed up." breadcrumb="Moving kits" description="A clear mix of small, medium, large and specialty cartons for a studio or a one to five bedroom home. Choose your kit, then make it yours." image="/kits/2-bedroom.png" />
    <div className={styles.container}>
      <ShopBenefits items={[["Six easy choices", "From 17 boxes for a studio to 100 boxes for a five bedroom home."], ["Know what’s included", "Exact quantities, a clear price and 20-inch wardrobe cartons as standard."], ["Make it yours", "Upgrade wardrobes and add cartons for the items you actually own."]]} />
      <section className={styles.kitCollection} aria-labelledby="kit-collection-title">
        <SectionHeading id="kit-collection-title" eyebrow="CHOOSE YOUR STARTING POINT" title="One kit. The right mix." description="Use your home size as a starting point. The contents below make every bundle easy to compare." action={<a className={styles.textLink} href="#compare-kits">Compare all kits ↓</a>} />
        <div className={styles.kitGrid}>{kits.map((kit) => <article className={styles.kitCard} key={kit.id} id={kit.id}>
          <button className={styles.kitImage} onClick={() => openProduct(kit)} aria-label={`Configure ${kit.name}`}><img src={productImage(kit)} alt={`Save On Boxes ${kit.name} cardboard boxes`} /><div className={styles.kitBadge}>{kit.badge}<span>{kit.boxCount} BOXES</span></div></button>
          <div className={styles.kitBody}><span className={styles.kitCount}>{kit.boxCount} boxes</span><h2>{kit.name}</h2><p className={styles.kitDescription}>{kit.id === "kit-studio" ? "A practical starting point for a studio or compact space." : `A practical box mix for a typical ${kit.name.match(/\d/)[0]} bedroom home.`}</p><ul className={styles.kitContents}>{kit.contents.map(([name, quantity]) => <li key={name}><strong>{quantity}</strong><span>{name}</span></li>)}</ul><div className={styles.kitPrice}>{formatPrice(kit.price)}<span>Box-only bundle</span></div><button className={styles.primaryButton} onClick={() => openProduct(kit)}>Customise this kit <span aria-hidden="true">→</span></button><button className={styles.kitAddButton} onClick={() => addToCart(kit)}>Add standard kit to cart +</button></div>
        </article>)}</div>
      </section>
      <section id="compare-kits" className={styles.comparisonSection}>
        <SectionHeading eyebrow="EVERY BOX ACCOUNTED FOR" title="Compare your kits." description="Each bundle includes six box types. Wardrobe boxes are the 20-inch size as standard." />
        <div className={styles.tableScroll}><table className={styles.kitTable}><caption className={styles.srOnly}>Contents and prices of all SaveOnBoxes moving kits</caption><thead><tr><th scope="col">Included boxes</th>{kits.map((kit) => <th key={kit.id} scope="col">{kit.badge}<small>{kit.boxCount} boxes</small></th>)}</tr></thead><tbody>{kits[0].contents.map(([name], index) => <tr key={name}><th scope="row">{name}</th>{kits.map((kit) => <td key={kit.id}>{kit.contents[index][1]}</td>)}</tr>)}<tr className={styles.totalRow}><th scope="row">Total boxes</th>{kits.map((kit) => <td key={kit.id}>{kit.boxCount}</td>)}</tr><tr className={styles.priceRow}><th scope="row">Kit price</th>{kits.map((kit) => <td key={kit.id}>{formatPrice(kit.price)}</td>)}</tr><tr className={styles.chooseRow}><th scope="row">Make your selection</th>{kits.map((kit) => <td key={kit.id}><button onClick={() => openProduct(kit)} aria-label={`Choose ${kit.name}`}>Choose kit →</button></td>)}</tr></tbody></table></div>
      </section>
      <section className={styles.customiseSection}>
        <SectionHeading eyebrow="PACKING SOMETHING SPECIAL?" title="Build it around your belongings." description="Specialty boxes are optional. Add the sizes and quantities you need when customising your kit." />
        <div className={styles.wardrobeCallout}><img src={productImage(productsById["wardrobe-24"])} alt="24-inch wardrobe moving box" /><div><span className={styles.eyebrow}>MORE ROOM FOR HANGING CLOTHES</span><h3>Upgrade to 24-inch wardrobes.</h3><p>Every kit starts with 20-inch wardrobe cartons. Upgrade all included wardrobes to 24-inch cartons in the kit configurator, or add laydown wardrobes separately.</p><span className={styles.upgradePrice}>+{formatPrice(wardrobeUpgrade)} per included wardrobe</span></div></div>
        <div className={styles.addonGrid}>{kitAddonGroups.map((group) => <article key={group.title}><img src={productImage(group.products[0])} alt="" /><h3>{group.title}</h3><div>{group.products.map((product) => <button key={product.id} onClick={() => openProduct(product)}><span>{product.name}</span><strong>{formatPrice(product.price)} <span aria-hidden="true">+</span></strong></button>)}</div></article>)}</div>
      </section>
      <section className={styles.packingSteps}><SectionHeading eyebrow="FROM KIT TO MOVING DAY" title="Keep the move simple." /><div className={styles.stepGrid}>{[["Choose your kit", "Compare the exact contents against your home. Add extra everyday boxes if you have more belongings than a typical home."], ["Add special protection", "Pick TV and mirror sizes, extra dish cartons and other specialty boxes in the kit configurator."], ["Finish with supplies", "Add tape, bubble wrap and a marker. Seal, label and organise each carton by room before moving day."]].map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p>{index === 2 && <a href="/extras">Shop packing supplies →</a>}</article>)}</div></section>
      <section className={styles.faqSection}><SectionHeading eyebrow="A FEW HELPFUL DETAILS" title="Moving kit questions." /><Accordion items={[
        { title: "What is included in a moving kit?", content: "Each kit includes only the boxes listed in its contents: small, medium, large, X-Large, 20-inch wardrobe cartons and dish packs. Tape, bubble wrap, tools and protective covers are available separately." },
        { title: "Will a kit be enough for my home?", content: "Home size is a useful starting point. The number of belongings, storage spaces and fragile items will affect what you need. Compare the exact box counts and add extra cartons when your move calls for them." },
        { title: "How do I customise a kit?", content: "Select Customise this kit. The kit details show the standard contents, the option to upgrade included wardrobes to 24-inch cartons, and quantity controls for specialty boxes. The price updates as you choose, and the complete selection can be added to your cart." },
        { title: "Are TV and mirror boxes included automatically?", content: "No. Choose the screen or mirror box sizes you need as extras. This keeps the base kit useful whether you have no televisions or several, and avoids including cartons you won’t use." },
      ]} /></section>
    </div>
    <HelpCTA title="A few extras finish the job." description="Tape it, cushion it, cover it and label it. Get the packing supplies you need alongside your boxes." />
  </main>;
}

const supplyGroups = [
  { id: "all", label: "All supplies", productIds: supplies.map((product) => product.id) },
  { id: "seal", label: "Tape & sealing", productIds: ["packing-tape", "fragile-tape", "tape-dispenser"] },
  { id: "protect", label: "Wrap & covers", productIds: ["bubble-wrap", "mattress-cover", "sofa-cover"] },
  { id: "tools", label: "Tools & labels", productIds: ["cutter-knife", "marker-pen"] },
];

export function ExtrasShopPage() {
  const { addToCart } = useStore();
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const visibleSupplies = useMemo(() => {
    const selected = supplyGroups.find((item) => item.id === group);
    const search = query.trim().toLowerCase();
    const result = supplies.filter((product) => selected.productIds.includes(product.id) && (!search || `${product.name} ${product.purpose} ${product.detail}`.toLowerCase().includes(search)));
    if (sort === "price-low") result.sort((a, b) => a.price - b.price);
    if (sort === "price-high") result.sort((a, b) => b.price - a.price);
    return result;
  }, [group, sort, query]);
  const essentials = supplies.filter((product) => ["packing-tape", "bubble-wrap", "marker-pen", "cutter-knife"].includes(product.id));
  const essentialsTotal = essentials.reduce((total, product) => total + product.price, 0);

  return <main className={`page-container ${styles.shopPage}`}>
    <PageIntro eyebrow="PACKING SUPPLIES" title="The finishing touches." breadcrumb="Packing supplies" description="Seal your boxes, cushion fragile items, protect furniture and label each room. All the practical extras for a well-packed move." image="/images/tape-dispenser-2-500x625.jpg" />
    <div className={styles.container}>
      <ShopBenefits items={[["Seal it", "Packing tape and a dispenser keep cartons ready for the move."], ["Protect it", "Bubble wrap and covers help keep belongings cushioned and clean."], ["Label it", "A permanent marker makes unpacking room by room much easier."]]} />
      <section className={styles.supplyCollection}>
        <SectionHeading eyebrow="TAPE, TOOLS & PROTECTION" title="Everything beyond the box." description="Choose individual supplies for your move. All products show their price and can be added straight to your cart." />
        <div className={styles.supplyFilters} aria-label="Filter packing supplies">{supplyGroups.map((item) => <button key={item.id} aria-pressed={group === item.id} className={group === item.id ? styles.activeSupply : ""} onClick={() => setGroup(item.id)}>{item.label}<span>{item.productIds.length}</span></button>)}</div>
        <div className={`${styles.toolbar} ${styles.supplyToolbar}`}><label className={styles.searchField}><span className={styles.fieldLabel}>Search supplies</span><input type="search" placeholder="Try tape, covers, knife…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span className={styles.fieldLabel}>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
        <div className={styles.resultCount} role="status" aria-live="polite"><strong>{visibleSupplies.length}</strong> {visibleSupplies.length === 1 ? "supply" : "supplies"}</div>
        {visibleSupplies.length ? <div className={styles.suppliesGrid}>{visibleSupplies.map((product) => <BuyCard key={product.id} product={product} />)}</div> : <div className={styles.emptyResults}><h3>No supplies match your search.</h3><button className={styles.primaryButton} onClick={() => { setGroup("all"); setQuery(""); }}>Show all supplies</button></div>}
      </section>
      <section className={styles.essentialsSection}><div><span className={styles.eyebrow}>START WITH THE ESSENTIALS</span><h2>Your packing-day toolkit.</h2><p>One roll of packing tape, one 5 metre roll of bubble wrap, one marker pen and one cutter knife. Add them together, then top up the quantities in your cart.</p><ul>{essentials.map((product) => <li key={product.id}><span>{product.name}</span><strong>{formatPrice(product.price)}</strong></li>)}</ul><div className={styles.essentialsTotal}><span>4 individual supplies</span><strong>{formatPrice(essentialsTotal)}</strong></div><button className={styles.primaryButton} onClick={() => essentials.forEach((product) => addToCart(product))}>Add all four essentials <span aria-hidden="true">+</span></button></div><div className={styles.essentialsImages}>{essentials.map((product) => <div key={product.id}><img src={productImage(product)} alt={product.name} /><span>{product.name}</span></div>)}</div></section>
      <section className={styles.guidanceSection}><SectionHeading eyebrow="PACK WITH A PLAN" title="A little preparation goes a long way." description="Use the right supplies at each stage so your cartons are easier to move and unpack." /><div className={styles.stepGrid}>{[["Tape the base first", "Build each carton and seal the base before filling it. Once packed, tape the top seam and keep the box closed for the move."], ["Cushion fragile items", "Wrap delicate belongings individually, keep them separated and fill empty space so items don’t move around inside the carton."], ["Label every carton", "Write the destination room and a short contents list on each box. Mark fragile cartons clearly and keep essentials easy to find."]].map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className={styles.coverSection}><div><span className={styles.eyebrow}>DON’T FORGET THE BIG ITEMS</span><h2>Protect the pieces that don’t fit in a box.</h2><p>A king-size mattress cover and a sofa cover help keep upholstery clean while moving. Check the item size before choosing your cover and secure it for transport.</p><button className={styles.textButton} onClick={() => { setGroup("protect"); setQuery(""); document.querySelector(`.${styles.supplyCollection}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Shop wrap & covers →</button></div><div><img src="/images/matthress-cover-plastic-x1-1-500x625.jpg" alt="Mattress protective cover" /><img src="/images/sofa-cover-500x625.jpg" alt="Sofa protective cover" /></div></section>
      <section className={styles.faqSection}><SectionHeading eyebrow="FINISH YOUR PACKING LIST" title="Packing supply questions." /><Accordion items={[
        { title: "Do I need supplies if I buy a moving kit?", content: "Yes. The kits are box-only. Add tape to seal the cartons, a marker to label them and cushioning or covers for the belongings you want to protect." },
        { title: "What is the difference between packing tape and fragile tape?", content: "Packing tape seals cartons. Fragile tape adds a clear handling label to boxes containing delicate items. Wrap and cushion the contents as well; a fragile label does not replace protection inside the carton." },
        { title: "How much bubble wrap should I buy?", content: "The listed roll contains 5 metres. Think about the number and size of fragile items you need to wrap and add more rolls when needed. Items should be wrapped individually, with enough cushioning to keep them from contacting one another." },
        { title: "Can I change quantities after adding supplies?", content: "Yes. Open your cart to change the quantity of each item or remove anything you no longer need. You can continue browsing boxes and kits with the same cart." },
      ]} /></section>
    </div>
    <HelpCTA title="Still need the boxes?" description="Find everyday cartons, speciality protection and ready-made moving kits for every room." />
  </main>;
}

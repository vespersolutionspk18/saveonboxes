import Link from "next/link";

export function PageIntro({ eyebrow, title, description, image, breadcrumb }) {
  return <>
    <nav className="page-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span>{breadcrumb || title}</span></nav>
    <section className={`page-intro${image ? " page-intro-with-image" : ""}`}>
      <div className="page-intro-copy"><span className="eyebrow-label">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {image && <div className="page-intro-art" aria-hidden="true"><span /><img src={image.startsWith("/") ? image : `/boxes/${encodeURIComponent(image)}`} alt="" /></div>}
    </section>
  </>;
}

export function HelpCTA({ title = "A little help goes a long way.", description = "Tell us what you’re packing. We’ll help you choose boxes, quantities and the right protection." }) {
  return <section className="page-help-cta"><div><span className="eyebrow-label">LET’S GET YOU PACKED</span><h2>{title}</h2><p>{description}</p></div><div className="page-help-links"><Link className="orange-button" href="/contact">Get in touch <span aria-hidden="true">→</span></Link><Link className="text-link" href="/boxes">Browse boxes</Link></div></section>;
}

export function Accordion({ items }) {
  return <div className="page-accordion">{items.map(({ title, content }) => <details key={title}><summary>{title}<span aria-hidden="true">+</span></summary><div>{content}</div></details>)}</div>;
}

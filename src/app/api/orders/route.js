import { NextResponse } from "next/server";
import { boxProducts, kits, supplies } from "../../catalog";
import { cleanText, saveRecord, validEmail } from "../../../lib/store-records";

export const runtime = "nodejs";
const productLookup = new Map([...boxProducts, ...kits, ...supplies].map(product => [product.id, product]));

function findProduct(id) {
  if (productLookup.has(id)) return productLookup.get(id);
  if (!id.endsWith("-wardrobe24")) return null;
  const kit = productLookup.get(id.slice(0, -"-wardrobe24".length));
  if (!kit?.boxCount) return null;
  const wardrobeCount = kit.contents.find(([name]) => name === 'Wardrobe 20"')?.[1] || 0;
  const upgradePrice = (productLookup.get("wardrobe-24").price - productLookup.get("wardrobe-20").price) * wardrobeCount;
  return { ...kit, id, name: `${kit.name} · 24-inch wardrobe upgrade`, price: kit.price + upgradePrice };
}

export async function POST(request) {
  try {
    const bodyText = await request.text();
    if (bodyText.length > 32000) return NextResponse.json({ error: "Your order request is too large. Please review the items and try again." }, { status: 413 });
    let body;
    try { body = JSON.parse(bodyText); } catch { return NextResponse.json({ error: "Please submit a valid order request." }, { status: 400 }); }
    if (!body || typeof body !== "object" || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return NextResponse.json({ error: "Add at least one product to your cart before sending an order request." }, { status: 400 });
    const customer = {
      name: cleanText(body.customer?.name, 120), email: cleanText(body.customer?.email, 254).toLowerCase(), phone: cleanText(body.customer?.phone, 40),
      address: cleanText(body.customer?.address, 300), city: cleanText(body.customer?.city, 100), postcode: cleanText(body.customer?.postcode, 20),
    };
    if (!customer.name || !validEmail(customer.email) || !customer.address || !customer.city || !customer.postcode) return NextResponse.json({ error: "Enter your name, valid email and complete delivery address." }, { status: 400 });
    const quantities = new Map();
    for (const item of body.items) {
      const id = cleanText(item?.id, 100);
      const quantity = Number(item?.quantity);
      if (!id || !findProduct(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return NextResponse.json({ error: "Your cart contains an invalid product or quantity. Please review your items." }, { status: 400 });
      const totalQuantity = (quantities.get(id) || 0) + quantity;
      if (totalQuantity > 999) return NextResponse.json({ error: "Please keep each product quantity between 1 and 999." }, { status: 400 });
      quantities.set(id, totalQuantity);
    }
    const items = [...quantities].map(([id, quantity]) => {
      const product = findProduct(id);
      const unitCents = Math.round(product.price * 100);
      return { id, name: product.packQty ? `${product.packQty} × ${product.name}` : product.name, sku: product.sku || null, supplier: product.supplier || null, quantity, unitPrice: unitCents / 100, lineTotal: unitCents * quantity / 100, currency: "USD" };
    });
    const subtotal = items.reduce((sum, item) => sum + Math.round(item.lineTotal * 100), 0) / 100;
    const record = await saveRecord("orders.json", {
      status: "received", currency: "USD", customer, items, subtotal, notes: cleanText(body.notes, 2000),
      update: "Your order request has been recorded. Payment, stock availability and delivery are still to be confirmed. No payment has been taken and no courier booking has been made.",
    });
    return NextResponse.json({ reference: record.reference, receivedAt: record.createdAt, total: subtotal, currency: "USD" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Your order request could not be saved. Please try again in a moment." }, { status: 500 }); }
}

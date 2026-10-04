import { NextResponse } from "next/server";
import { cleanText, readRecords, safeTrackingUrl, validEmail } from "../../../lib/store-records";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    const bodyText = await request.text();
    if (bodyText.length > 2000) return NextResponse.json({ error: "Please check your order reference and email address." }, { status: 400 });
    let body;
    try { body = JSON.parse(bodyText); } catch { return NextResponse.json({ error: "Please check your order reference and email address." }, { status: 400 }); }
    const reference = cleanText(body?.orderNumber, 80);
    const email = cleanText(body?.email, 254).toLowerCase();
    if (!reference || !validEmail(email)) return NextResponse.json({ error: "Enter your order reference and a valid email address." }, { status: 400 });
    const orders = await readRecords("orders.json");
    const order = orders.find(record => String(record.reference || record.orderNumber || record.id || "").trim().toLowerCase() === reference.toLowerCase() && String(record.email || record.customer?.email || "").trim().toLowerCase() === email);
    if (!order) return NextResponse.json({ error: "We couldn’t find an order matching that reference and email. Check both details against your order confirmation and try again." }, { status: 404 });
    const dateValue = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;
    return NextResponse.json({ order: {
      reference: cleanText(String(order.reference || order.orderNumber || order.id), 80),
      status: cleanText(order.status, 80) === "received" ? "Order request received" : cleanText(order.status, 80) || "Recorded",
      currency: "USD",
      createdAt: dateValue(order.createdAt), updatedAt: dateValue(order.updatedAt),
      subtotal: Number.isFinite(order.subtotal) ? order.subtotal : null,
      carrier: cleanText(order.carrier, 120), trackingNumber: cleanText(order.trackingNumber, 120), trackingUrl: safeTrackingUrl(order.trackingUrl),
      update: cleanText(order.update || order.statusMessage, 600),
      items: (Array.isArray(order.items) ? order.items : []).slice(0, 200).map(item => ({ name: cleanText(item.name, 200) || "Packing item", quantity: Math.max(1, Math.trunc(Number(item.quantity || item.qty) || 1)) })),
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Order lookup is temporarily unavailable. Please try again or use the contact form for help." }, { status: 500 }); }
}

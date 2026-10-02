import { NextResponse } from "next/server";
import { cleanText, saveRecord, validEmail } from "../../../lib/store-records";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    const bodyText = await request.text();
    if (bodyText.length > 16000) return NextResponse.json({ error: "Your message is too long. Please keep it under 5,000 characters." }, { status: 413 });
    let body;
    try { body = JSON.parse(bodyText); } catch { return NextResponse.json({ error: "Please submit a valid enquiry." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Please submit a valid enquiry." }, { status: 400 });
    const values = { name: cleanText(body.name, 120), email: cleanText(body.email, 254).toLowerCase(), subject: cleanText(body.subject, 40), orderNumber: cleanText(body.orderNumber, 80), message: cleanText(body.message, 5000) };
    if (!values.name || !validEmail(values.email) || values.message.length < 10 || !["product-help", "order", "delivery", "returns", "bulk", "privacy", "other"].includes(values.subject) || body.consent !== "yes") return NextResponse.json({ error: "Please enter your name, a valid email and a message of at least 10 characters, then confirm the privacy checkbox." }, { status: 400 });
    const inquiry = await saveRecord("contact-inquiries.json", { ...values, status: "recorded" });
    return NextResponse.json({ reference: inquiry.reference }, { status: 201 });
  } catch { return NextResponse.json({ error: "Your enquiry could not be saved. Please try again in a moment." }, { status: 500 }); }
}

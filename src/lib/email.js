import nodemailer from "nodemailer";

let transport;

export function emailReady() {
  return Boolean(process.env.SMTP_URL && process.env.EMAIL_FROM);
}

export async function sendPasswordReset(email, url) {
  if (!emailReady()) throw new Error("Email delivery is not configured");
  transport ||= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your BoxSave password",
    text: `Use this one-time link to reset your BoxSave password. It expires in one hour.\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this one-time link to reset your BoxSave password. It expires in one hour.</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

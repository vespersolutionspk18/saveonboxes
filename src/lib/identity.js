export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizePhone(value) {
  if (typeof value !== "string") return "";
  const input = value.trim();
  const digits = input.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return input.startsWith("+") ? `+${digits}` : digits;
}

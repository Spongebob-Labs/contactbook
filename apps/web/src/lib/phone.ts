/** Builds E.164 from country calling code and local digits (strips spaces and leading 0). */
export function buildE164(dial: string, nationalRaw: string): string {
  const national = nationalDigits(nationalRaw);
  const normalizedDial = dial.startsWith("+") ? dial : `+${dial.replace(/\D/g, "")}`;
  if (!/^\+\d{1,4}$/.test(normalizedDial)) {
    throw new Error("Enter a valid country code.");
  }
  if (!/^\d{4,15}$/.test(national)) {
    throw new Error("Enter a valid phone number.");
  }
  return `${normalizedDial}${national}`;
}

export function nationalDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "");
}

/** Builds E.164 from country calling code and local digits (strips spaces and leading 0). */
export function buildE164(dial: string, nationalRaw: string): string {
  const national = nationalRaw.replace(/\D/g, "").replace(/^0+/, "");
  if (national.length < 6 || national.length > 15) {
    throw new Error("Enter a valid phone number (6–15 digits after country code).");
  }
  const normalizedDial = dial.startsWith("+") ? dial : `+${dial}`;
  return `${normalizedDial}${national}`;
}

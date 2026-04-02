/** Thai mobile: exactly 10 digits, leading 0. Strips non-digits. */
export function normalizeThaiMobile10Digits(input: string): string | null {
  const d = input.replace(/\D/g, "");
  return /^0\d{9}$/.test(d) ? d : null;
}

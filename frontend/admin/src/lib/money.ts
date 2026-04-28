export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function parseMoneyToCents(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Math.round(n * 100);
}

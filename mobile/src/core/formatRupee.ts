/** Format a value for display with the rupee symbol. */
export function formatRupee(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const raw = String(value).trim();
  if (!raw || raw === "—") return "—";

  const amount = raw.replace(/^[₹]\s*/, "").replace(/^[+-]\s*/, "").trim();
  if (!amount) return "—";

  return `₹ ${amount}`;
}

/** Prefix + or - before a formatted rupee amount. */
export function formatRupeeWithSign(
  value: string | number | null | undefined,
  sign: "+" | "-" | "",
): string {
  const formatted = formatRupee(value);
  if (formatted === "—" || !sign) return formatted;
  return `${sign} ${formatted}`;
}

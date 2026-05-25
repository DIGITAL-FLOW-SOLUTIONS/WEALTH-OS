let _currency = "KES";

export function setActiveCurrency(c: string) {
  _currency = c;
}

export function getActiveCurrency(): string {
  return _currency;
}

export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency ?? _currency;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyFull(amount: number, currency?: string): string {
  const cur = currency ?? _currency;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompact(amount: number): string {
  const cur = _currency;
  if (Math.abs(amount) >= 1_000_000) {
    return `${cur} ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${cur} ${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

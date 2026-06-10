import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "../i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Exchange rate: 1 USD = X CNY. Configurable via env var.
const CNY_RATE = Number(import.meta.env.VITE_CNY_EXCHANGE_RATE) || 7.3;

export function formatPrice(amount: number): string {
  const lng = i18n.language;
  if (lng === "zh") {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(amount * CNY_RATE);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateString: string): string {
  const lng = i18n.language;
  const date = new Date(dateString);
  if (lng === "zh") {
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

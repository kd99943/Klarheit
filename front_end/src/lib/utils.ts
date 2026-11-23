import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "../i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat(i18n.language === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const lng = i18n.language;
  const date = new Date(dateString);
  if (lng === "zh") {
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

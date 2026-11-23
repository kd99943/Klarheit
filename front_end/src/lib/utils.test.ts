import { afterEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { formatPrice } from "./utils";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("formatPrice", () => {
  it.each(["en", "zh"])("keeps the same CNY amount in %s", async (language) => {
    await i18n.changeLanguage(language);

    expect(formatPrice(850)).toContain("850.00");
    expect(formatPrice(850)).not.toContain("6,205");
  });
});

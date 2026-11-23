import { describe, expect, test } from "vitest";
import { normalizeRoutePath } from "./analytics";

describe("analytics privacy helpers", () => {
  test("normalizeRoutePath strips order numbers, ticket numbers, and numeric ids", () => {
    expect(normalizeRoutePath("/order/KL-20261122-9999")).toBe("/order/:orderNumber");
    expect(normalizeRoutePath("/admin/orders/KL-20261122-9999?tab=1")).toBe("/admin/orders/:orderNumber");
    expect(normalizeRoutePath("/product/42")).toBe("/product/:id");
    expect(normalizeRoutePath("/orders/KL-20261122-9999/after-sales/AS-12345")).toBe(
      "/orders/:orderNumber/after-sales/:ticketNumber",
    );
    expect(normalizeRoutePath("/addresses/19")).toBe("/addresses/:id");
  });
});

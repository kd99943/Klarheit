import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test } from "vitest";
import { CartProvider, useCart } from "./useCart";

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe("useCart order cleanup", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  test("viewing historical paid order A without cart mapping does NOT delete unpaid cart item B or its checkout draft", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({
        productId: 2,
        productName: "ORBIT T-4",
        productImageUrl: "/images/orbit.png",
        basePrice: 920,
        lensOptionTypes: ["HIGH_INDEX_174"],
        lensPrice: 215,
      });
    });

    expect(result.current.items).toHaveLength(1);
    const unpaidItemB = result.current.items[0];

    const draftState = JSON.stringify({
      product: { id: 2, name: "ORBIT T-4" },
      cartItemId: unpaidItemB.id,
    });
    sessionStorage.setItem("klarheit_checkout_state", draftState);

    // Simulate viewing historical paid order A on MyAccountPage
    act(() => {
      result.current.completeOrderCartCleanup("KL-HISTORICAL-ORDER-A");
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe(unpaidItemB.id);
    expect(sessionStorage.getItem("klarheit_checkout_state")).toBe(draftState);
  });

  test("completing payment for mapped order B removes only item B and clears matching checkout draft", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({
        productId: 1,
        productName: "AERO X1",
        productImageUrl: "/images/aero.png",
        basePrice: 850,
        lensOptionTypes: ["AR_ONYX"],
        lensPrice: 60,
      });
    });

    const itemBId = result.current.items[0].id;
    sessionStorage.setItem(
      "klarheit_checkout_state",
      JSON.stringify({
        product: { id: 1, name: "AERO X1" },
        cartItemId: itemBId,
      })
    );

    act(() => {
      result.current.linkOrderToCartItem("KL-ORDER-B", itemBId);
    });

    act(() => {
      result.current.completeOrderCartCleanup("KL-ORDER-B");
    });

    expect(result.current.items).toHaveLength(0);
    expect(sessionStorage.getItem("klarheit_checkout_state")).toBeNull();
  });

  test("clearPrivateData removes prescriptions and try-on snapshots while preserving frame selection", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    sessionStorage.setItem("klarheit_tryon_snapshot", "data:image/png;base64,abc");
    act(() => {
      result.current.addItem({
        productId: 1,
        productName: "AERO X1",
        productImageUrl: "/images/aero.png",
        basePrice: 850,
        lensOptionTypes: ["STANDARD_156"],
        lensPrice: 0,
        prescription: { sphOd: -3.25, sphOs: -3.0, cylOd: 0, cylOs: 0, axisOd: 0, axisOs: 0, pd: 63 },
      });
    });

    expect(result.current.items[0].prescription).toBeDefined();

    act(() => {
      result.current.clearPrivateData();
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].prescription).toBeUndefined();
    expect(sessionStorage.getItem("klarheit_tryon_snapshot")).toBeNull();
  });

  test("klarheit:logout event wipes in-memory cart items on shared devices", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({
        productId: 1,
        productName: "AERO X1",
        productImageUrl: "/images/aero.png",
        basePrice: 850,
        lensOptionTypes: ["STANDARD_156"],
        lensPrice: 0,
      });
    });

    expect(result.current.items).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new Event("klarheit:logout"));
    });

    expect(result.current.items).toHaveLength(0);
  });

  test("P0-09: prescriptions, wearerName, and tryOnSnapshot are NEVER persisted into shared localStorage", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem({
        productId: 1,
        productName: "AERO X1",
        productImageUrl: "/images/aero.png",
        basePrice: 850,
        finishId: "titanium",
        sizeSpec: "54-17-140",
        skuId: 101,
        lensOptionTypes: ["THIN_161"],
        lensPrice: 100,
        prescription: { sphOd: -5.25, sphOs: -4.75, cylOd: -1.0, cylOs: -0.5, axisOd: 180, axisOs: 90, pd: 64 },
        wearerName: "Secret Patient",
        tryOnSnapshot: "data:image/jpeg;base64,SENSITIVE_FACE_BYTES",
        savePrescriptionToProfile: true,
      });
    });

    // In-memory state preserves sensitive fields for the active session
    expect(result.current.items[0].prescription?.sphOd).toBe(-5.25);
    expect(result.current.items[0].wearerName).toBe("Secret Patient");
    expect(result.current.items[0].tryOnSnapshot).toContain("SENSITIVE_FACE_BYTES");

    // Shared localStorage MUST NEVER contain prescription, wearerName, or biometric face snapshot
    const rawLocal = localStorage.getItem("klarheit_cart_v1") || "";
    expect(rawLocal).not.toContain("-5.25");
    expect(rawLocal).not.toContain("Secret Patient");
    expect(rawLocal).not.toContain("SENSITIVE_FACE_BYTES");
    const parsedLocal = JSON.parse(rawLocal);
    expect(parsedLocal[0].prescription).toBeUndefined();
    expect(parsedLocal[0].tryOnSnapshot).toBeUndefined();
    expect(parsedLocal[0].wearerName).toBeUndefined();
    expect(parsedLocal[0].skuId).toBe(101);
    expect(parsedLocal[0].sizeSpec).toBe("54-17-140");

    // Session expiry (401) or cross-tab account switch wipes in-memory cart immediately
    act(() => {
      window.dispatchEvent(new Event("klarheit:session-expired"));
    });
    expect(result.current.items).toHaveLength(0);
  });
});

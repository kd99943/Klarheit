import { describe, expect, test } from "vitest";
import {
  FRAME_MODEL_URLS,
  FRAME_STYLES_MAP,
  getFrameConfigForProduct,
  getSpecsForProductName,
} from "./frameCatalog";
import type { Product } from "../services/api";
import { getARFrameConfig } from "./frameCatalog";

function product(name: string): Product {
  return {
    id: 1,
    name,
    material: "x",
    nameEn: name,
    nameZh: name,
    materialEn: "x",
    materialZh: "x",
    basePrice: 100,
    imageUrl: "/images/x.png",
    shape: "ROUND",
    specsSize: "50-20-145",
    detailImages: null,
  };
}

describe("frameCatalog product fidelity", () => {
  test("maps each hero product to a distinct silhouette", () => {
    expect(FRAME_STYLES_MAP["AERO X1"].styleName).toBe("panto-metal");
    expect(FRAME_STYLES_MAP["MONOLITH 02"].styleName).toBe("bold-acetate");
    expect(FRAME_STYLES_MAP["ORBIT T-4"].styleName).toBe("panto-wire");
    expect(FRAME_STYLES_MAP["LUCENT V1"].styleName).toBe("crystal-sun");
    expect(FRAME_STYLES_MAP["SOLARIS A1"].styleName).toBe("aviator-double");
    expect(FRAME_STYLES_MAP["VELVET C3"].styleName).toBe("cat-eye-acetate");
    expect(FRAME_STYLES_MAP["PRISM H6"].styleName).toBe("hex-wire");
    expect(FRAME_STYLES_MAP["AMBER R5"].styleName).toBe("narrow-rect-amber");
  });

  test("LUCENT V1 uses dark sun lenses, not clear optical", () => {
    const config = getFrameConfigForProduct(product("LUCENT V1"));
    expect(config.styleName).toBe("crystal-sun");
    // Dark grey-green sun lens from product photography
    expect(config.lensColor).not.toBe("#ffffff");
    expect(config.lensColor.startsWith("#1")).toBe(true);
  });

  test("ORBIT T-4 is full wire, not rimless", () => {
    const config = getFrameConfigForProduct(product("ORBIT T-4"));
    expect(config.styleName).toBe("panto-wire");
  });

  test("exposes lens-bridge-temple specs for fit guidance", () => {
    expect(getSpecsForProductName("MONOLITH 02")).toEqual({
      lens: 50,
      bridge: 20,
      temple: 145,
      faceWidthRange: [128, 142],
    });
  });

  test("unknown product falls back to AERO-like metal panto", () => {
    const config = getFrameConfigForProduct(product("UNKNOWN FRAME"));
    expect(config.styleName).toBe("panto-metal");
  });

  test("attaches local GLB for each hero product", () => {
    for (const name of [
      "AERO X1",
      "MONOLITH 02",
      "ORBIT T-4",
      "LUCENT V1",
      "SOLARIS A1",
      "VELVET C3",
      "PRISM H6",
      "AMBER R5",
    ]) {
      expect(getFrameConfigForProduct(product(name)).modelUrl).toBe(FRAME_MODEL_URLS[name]);
    }
  });

  test.each(["AERO X1", "CUSTOM FRAME"])("honors configured model and units for %s", (name) => {
    const config = getFrameConfigForProduct({ ...product(name), arConfigs: [{
      ...getARFrameConfig("titanium"), modelUrl: "/models/measured.glb", modelScaleMode: "real-meters", legacyMaterials: false,
    }] });
    expect(config.modelUrl).toBe("/models/measured.glb");
    expect(config.modelScaleMode).toBe("real-meters");
    expect(config.legacyMaterials).toBe(false);
  });

  test("inherits the default model's metadata when a color variant reuses it", () => {
    const config = getFrameConfigForProduct({ ...product("AERO X1"), arConfigs: [
      { ...getARFrameConfig("titanium"), modelUrl: "/models/measured.glb", modelScaleMode: "real-meters", legacyMaterials: false },
      { ...getARFrameConfig("rose-gold"), modelScaleMode: "normalized", legacyMaterials: true },
    ] }, "rose-gold");
    expect(config.modelUrl).toBe("/models/measured.glb");
    expect(config.modelScaleMode).toBe("real-meters");
    expect(config.legacyMaterials).toBe(false);
    expect(config.frameColor).toBe(getARFrameConfig("rose-gold").frameColor);
  });

  test("reuses a bundled model for color variants and honors an explicit replacement policy", () => {
    const value = { ...product("AERO X1"), arConfigs: [getARFrameConfig("titanium"), getARFrameConfig("rose-gold")] };
    expect(getFrameConfigForProduct(value, "rose-gold").modelUrl).toBe(FRAME_MODEL_URLS["AERO X1"]);
    value.arConfigs[1] = { ...value.arConfigs[1], modelUrl: FRAME_MODEL_URLS["AERO X1"], legacyMaterials: false, modelScaleMode: "real-meters" };
    const config = getFrameConfigForProduct(value, "rose-gold");
    expect(config.legacyMaterials).toBe(false);
    expect(config.modelScaleMode).toBe("real-meters");
  });
});

import type { ARFinishId, ARFrameConfig } from "./types";
import type { Product } from "../services/api";

export const FRAME_STYLES_MAP: Record<string, {
  styleName: "aviator" | "bold-acetate" | "round-wire" | "crystal-acetate";
  frameColor: string;
  lensColor: string;
  lensLabel: string;
}> = {
  "AERO X1": {
    styleName: "aviator",
    frameColor: "#a0a5ad", // Polished Titanium
    lensColor: "#e2f0fd",
    lensLabel: "Neutral Clear"
  },
  "MONOLITH 02": {
    styleName: "bold-acetate",
    frameColor: "#1c1c1e", // Deep Glossy Onyx Black
    lensColor: "#e2fbfd",
    lensLabel: "Onyx AR"
  },
  "ORBIT T-4": {
    styleName: "round-wire",
    frameColor: "#dfc17f", // 18K Champagne Gold
    lensColor: "#ffeedd",
    lensLabel: "Warm HEV"
  },
  "LUCENT V1": {
    styleName: "crystal-acetate",
    frameColor: "#ffffff", // Pure Transparent Crystal
    lensColor: "#ffffff",
    lensLabel: "Neutral Clear"
  }
};

export const AR_FRAME_CATALOG: Record<ARFinishId, ARFrameConfig> = {
  "matte-black": {
    id: "matte-black",
    productName: "Aero X1",
    finishLabelKey: "color.matteBlack",
    lensLabel: "Onyx AR",
    fitLabelKey: "fit.urbanContrast",
    frameColor: "#1c1c1e",
    lensColor: "#e2fbfd",
    modelUrl: null,
    transformOffset: {
      position: [0, -0.03, 0],
      rotation: [0, 0, 0],
      scale: 1,
    },
  },
  titanium: {
    id: "titanium",
    productName: "Aero X1",
    finishLabelKey: "color.titanium",
    lensLabel: "Neutral Clear",
    fitLabelKey: "fit.studioNeutral",
    frameColor: "#a0a5ad", // Polished Titanium
    lensColor: "#e2f0fd",
    modelUrl: null,
    transformOffset: {
      position: [0, -0.03, 0],
      rotation: [0, 0, 0],
      scale: 1,
    },
  },
  "rose-gold": {
    id: "rose-gold",
    productName: "Aero X1",
    finishLabelKey: "color.roseGold",
    lensLabel: "Warm HEV",
    fitLabelKey: "fit.softDaylight",
    frameColor: "#e0a899", // 18K Rose Gold
    lensColor: "#ffeedd",
    modelUrl: null,
    transformOffset: {
      position: [0, -0.03, 0],
      rotation: [0, 0, 0],
      scale: 1,
    },
  },
};

export const DEFAULT_AR_FINISH: ARFinishId = "matte-black";

export function getARFrameConfig(finishId: ARFinishId): ARFrameConfig {
  return AR_FRAME_CATALOG[finishId];
}

export function getFrameConfigForProduct(product: Product): ARFrameConfig {
  const nameUpper = product.name.toUpperCase();
  const styleConfig = FRAME_STYLES_MAP[nameUpper] || FRAME_STYLES_MAP["AERO X1"];
  return {
    id: product.name.toLowerCase().replace(/\s+/g, "-"),
    productName: product.name,
    finishLabelKey: `color.${product.name.toLowerCase().replace(/\s+/g, "")}`,
    lensLabel: styleConfig.lensLabel,
    fitLabelKey: "fit.urbanContrast",
    frameColor: styleConfig.frameColor,
    lensColor: styleConfig.lensColor,
    modelUrl: null,
    styleName: styleConfig.styleName,
    transformOffset: {
      position: [0, -0.03, 0],
      rotation: [0, 0, 0],
      scale: 1,
    }
  };
}

import type { ARFinishId, ARFrameConfig } from "./types";

export const AR_FRAME_CATALOG: Record<ARFinishId, ARFrameConfig> = {
  "matte-black": {
    id: "matte-black",
    productName: "Aero X1",
    finishLabelKey: "color.matteBlack",
    lensLabel: "Onyx AR",
    fitLabelKey: "fit.urbanContrast",
    frameColor: "#111827",
    lensColor: "#5eead4",
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
    frameColor: "#94a3b8",
    lensColor: "#dbeafe",
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
    frameColor: "#fb7185",
    lensColor: "#fed7aa",
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

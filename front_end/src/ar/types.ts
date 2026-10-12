export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";

export type TrackingStatus = "initializing" | "tracking" | "no-face" | "low-confidence" | "error";

export type ARExperienceStatus =
  | "initializing"
  | "permission-denied"
  | "unsupported"
  | "tracking"
  | "no-face"
  | "low-confidence"
  | "captured"
  | "error";

export type ARFinishId = string;

/** Product-faithful frame silhouettes used by the procedural mesh builders. */
export type ARFrameStyleName =
  | "panto-metal" // AERO X1 — thin round-oval titanium wire
  | "bold-acetate" // MONOLITH 02 — thick rectangular acetate
  | "panto-wire" // ORBIT T-4 — thin full-rim wire with tortoise tips
  | "crystal-sun"; // LUCENT V1 — crystal acetate with dark sun lenses

export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface ARTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  confidence: number;
}

/** Manual user nudge applied on top of face tracking. */
export interface ARUserAdjust {
  x: number;
  y: number;
  scale: number;
}

export interface ARFrameConfig {
  id: ARFinishId;
  productName: string;
  finishLabelKey: string;
  lensLabel: string;
  fitLabelKey: string;
  frameColor: string;
  lensColor: string;
  modelUrl: string | null;
  /** Lens width + bridge width, used to keep the model at the product's measured scale. */
  lensCenterDistanceMm?: number;
  styleName?: ARFrameStyleName;
  transformOffset: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}

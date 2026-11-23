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
  | "crystal-sun" // LUCENT V1 — crystal acetate with dark sun lenses
  | "aviator-double" // SOLARIS A1 — champagne gold double-bridge teardrop aviator
  | "cat-eye-acetate" // VELVET C3 — burgundy sculpted upswept cat-eye acetate
  | "hex-wire" // PRISM H6 — gunmetal slim hexagonal geometric wire
  | "narrow-rect-amber"; // AMBER R5 — translucent amber narrow rectangular acetate

export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

/** Pixels and landmarks published together after synchronous detection of this exact image. */
export interface ARTrackedFrame {
  image: HTMLCanvasElement;
  landmarks: FaceLandmark[] | null;
  timestampMs: number;
  mediaTime: number;
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
  /** Legacy assets use lens centers at ±0.24; authored glTF may use meters. */
  modelScaleMode?: "normalized" | "real-meters";
  /** Only the bundled, generated GLBs need their old transmissive materials rebuilt. */
  legacyMaterials?: boolean | null;
  /** Lens width + bridge width, used to keep the model at the product's measured scale. */
  lensCenterDistanceMm?: number;
  styleName?: ARFrameStyleName;
  transformOffset: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}

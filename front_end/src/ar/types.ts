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

export interface ARFrameConfig {
  id: ARFinishId;
  productName: string;
  finishLabelKey: string;
  lensLabel: string;
  fitLabelKey: string;
  frameColor: string;
  lensColor: string;
  modelUrl: string | null;
  styleName?: "aviator" | "bold-acetate" | "round-wire" | "crystal-acetate";
  transformOffset: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}

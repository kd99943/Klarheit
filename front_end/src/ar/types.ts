export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error";

export type TrackingStatus = "initializing" | "tracking" | "no-face" | "low-confidence" | "error";

export type ArExperienceStatus =
  | "initializing"
  | "permission-denied"
  | "unsupported"
  | "tracking"
  | "no-face"
  | "low-confidence"
  | "captured"
  | "error";

export type ArFinishId = "matte-black" | "titanium" | "rose-gold";

export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface ArTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  confidence: number;
}

export interface ArFrameConfig {
  id: ArFinishId;
  productName: string;
  finishLabelKey: string;
  lensLabel: string;
  fitLabelKey: string;
  frameColor: string;
  lensColor: string;
  modelUrl: string | null;
  transformOffset: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}

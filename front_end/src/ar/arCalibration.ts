import type { ARTransform, FaceLandmark } from "./types";

const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_OUTER = 263;
const RIGHT_EYE_INNER = 362;
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;
const NOSE_BRIDGE = 168;
const NOSE_TIP = 1;

function hasPoint(landmarks: FaceLandmark[], index: number): boolean {
  const point = landmarks[index];
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function distance(a: FaceLandmark, b: FaceLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function eyeCenter(
  landmarks: FaceLandmark[],
  irisIndex: number,
  outerIndex: number,
  innerIndex: number
): FaceLandmark | null {
  const iris = landmarks[irisIndex];
  if (iris && Number.isFinite(iris.x) && Number.isFinite(iris.y)) return iris;
  if (!hasPoint(landmarks, outerIndex)) return null;
  const outer = landmarks[outerIndex];
  if (!hasPoint(landmarks, innerIndex)) return outer;
  const inner = landmarks[innerIndex];
  return { x: (outer.x + inner.x) / 2, y: (outer.y + inner.y) / 2 };
}

export function calculateGlassesTransform(landmarks: FaceLandmark[]): ARTransform | null {
  if (![NOSE_BRIDGE, NOSE_TIP].every((index) => hasPoint(landmarks, index))) {
    return null;
  }

  const leftEye = eyeCenter(landmarks, LEFT_IRIS, LEFT_EYE_OUTER, LEFT_EYE_INNER);
  const rightEye = eyeCenter(landmarks, RIGHT_IRIS, RIGHT_EYE_OUTER, RIGHT_EYE_INNER);
  if (!leftEye || !rightEye) return null;
  const noseBridge = landmarks[NOSE_BRIDGE];
  const noseTip = landmarks[NOSE_TIP];
  const eyeDistance = distance(leftEye, rightEye);

  if (eyeDistance < 0.05) {
    return null;
  }

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const pitch = clamp((noseTip.y - noseBridge.y) * 2.5, -0.45, 0.45);
  const yaw = clamp((noseBridge.x - eyeCenterX) * 3, -0.35, 0.35);
  const scale = clamp(eyeDistance * 7.2, 0.8, 2.4);
  const confidence = clamp((eyeDistance - 0.05) / 0.18, 0, 1);

  return {
    position: [(eyeCenterX - 0.5) * 2, (0.5 - eyeCenterY) * 2 - 0.02, -1.15],
    rotation: [pitch, yaw, roll],
    scale: [scale, scale, scale],
    confidence,
  };
}

# Phase 2 WebAR Try-On Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Klarheit's first self-owned WebAR try-on foundation with camera access, MediaPipe face landmarks, Three.js overlay rendering, product/finish switching, screenshot capture, and robust fallback states.

**Architecture:** Add a focused `front_end/src/ar/` module that isolates camera lifecycle, face tracking, calibration math, render configuration, and Three.js rendering from the AR page. Refactor `ARVirtualStudio.tsx` into an orchestration page that displays truthful runtime states while preserving the existing premium visual direction.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, MediaPipe Tasks Vision, Three.js, Tailwind CSS 4.

---

## File Structure

- Create `front_end/src/ar/types.ts`: shared AR status, landmark, transform, and render configuration types.
- Create `front_end/src/ar/frameCatalog.ts`: product/finish render configurations and fallback geometry metadata.
- Create `front_end/src/ar/arCalibration.ts`: pure landmark-to-transform math.
- Create `front_end/src/ar/arCalibration.test.ts`: calibration unit tests.
- Create `front_end/src/ar/useCameraStream.ts`: camera permission and media stream lifecycle hook.
- Create `front_end/src/ar/useCameraStream.test.tsx`: hook tests for unsupported, denied, ready, and cleanup states.
- Create `front_end/src/ar/faceLandmarker.ts`: lazy MediaPipe Tasks Vision adapter.
- Create `front_end/src/ar/useFaceLandmarks.ts`: animation loop and landmark tracking hook.
- Create `front_end/src/ar/useFaceLandmarks.test.tsx`: hook tests with fake detector and fake video.
- Create `front_end/src/ar/ArTryOnCanvas.tsx`: Three.js renderer component.
- Create `front_end/src/ar/ArTryOnCanvas.test.tsx`: render lifecycle and screenshot callback tests with mocked Three.js adapter surface.
- Modify `front_end/src/pages/ARVirtualStudio.tsx`: replace mock AR state with real camera/tracking/canvas orchestration.
- Modify `front_end/src/i18n/locales/en/ar-studio.json`: add truthful AR runtime copy.
- Modify `front_end/src/i18n/locales/zh/ar-studio.json`: add Chinese AR runtime copy.
- Modify `front_end/package.json` and `front_end/package-lock.json`: add `three`, `@types/three`, and `@mediapipe/tasks-vision`.

## Task 1: Add AR Runtime Dependencies

**Files:**
- Modify: `front_end/package.json`
- Modify: `front_end/package-lock.json`

- [ ] **Step 1: Install Three.js and MediaPipe Tasks Vision**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm install three @types/three @mediapipe/tasks-vision
```

Expected: `package.json` and `package-lock.json` update with these packages.

- [ ] **Step 2: Verify dependency metadata**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm ls three @types/three @mediapipe/tasks-vision
```

Expected: output lists installed versions without `UNMET DEPENDENCY`.

- [ ] **Step 3: Commit dependency change**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/package.json front_end/package-lock.json
git commit -m "chore(ar): add webar runtime dependencies"
```

Expected: commit succeeds.

## Task 2: Define AR Types and Frame Catalog

**Files:**
- Create: `front_end/src/ar/types.ts`
- Create: `front_end/src/ar/frameCatalog.ts`
- Test: use TypeScript lint in this task; no behavior test is needed for static data.

- [ ] **Step 1: Create shared AR types**

Create `front_end/src/ar/types.ts` with:

```ts
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
```

- [ ] **Step 2: Create frame catalog**

Create `front_end/src/ar/frameCatalog.ts` with:

```ts
import type { ArFinishId, ArFrameConfig } from "./types";

export const AR_FRAME_CATALOG: Record<ArFinishId, ArFrameConfig> = {
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

export const DEFAULT_AR_FINISH: ArFinishId = "matte-black";

export function getArFrameConfig(finishId: ArFinishId): ArFrameConfig {
  return AR_FRAME_CATALOG[finishId];
}
```

- [ ] **Step 3: Run TypeScript lint**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm run lint
```

Expected: `tsc --noEmit` passes.

- [ ] **Step 4: Commit types and catalog**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/src/ar/types.ts front_end/src/ar/frameCatalog.ts
git commit -m "feat(ar): define try-on frame catalog"
```

Expected: commit succeeds.

## Task 3: Build Calibration Math With TDD

**Files:**
- Create: `front_end/src/ar/arCalibration.test.ts`
- Create: `front_end/src/ar/arCalibration.ts`

- [ ] **Step 1: Write failing calibration tests**

Create `front_end/src/ar/arCalibration.test.ts` with:

```ts
import { describe, expect, test } from "vitest";
import { calculateGlassesTransform } from "./arCalibration";
import type { FaceLandmark } from "./types";

function landmarksWithFace(): FaceLandmark[] {
  const points = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[33] = { x: 0.38, y: 0.42, z: -0.02 };
  points[263] = { x: 0.62, y: 0.43, z: -0.02 };
  points[168] = { x: 0.5, y: 0.49, z: -0.04 };
  points[1] = { x: 0.5, y: 0.53, z: -0.06 };
  return points;
}

describe("calculateGlassesTransform", () => {
  test("computes a centered glasses transform from eye and nose landmarks", () => {
    const transform = calculateGlassesTransform(landmarksWithFace());

    expect(transform).not.toBeNull();
    expect(transform?.position[0]).toBeCloseTo(0, 3);
    expect(transform?.position[1]).toBeCloseTo(0.13, 2);
    expect(transform?.scale[0]).toBeGreaterThan(1);
    expect(transform?.scale[0]).toBeCloseTo(transform?.scale[1] ?? 0, 5);
    expect(transform?.confidence).toBeGreaterThan(0.8);
  });

  test("returns null when required landmarks are missing", () => {
    expect(calculateGlassesTransform([])).toBeNull();
  });

  test("captures roll rotation from uneven eye landmarks", () => {
    const transform = calculateGlassesTransform(landmarksWithFace());

    expect(transform?.rotation[2]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/arCalibration.test.ts
```

Expected: FAIL because `./arCalibration` does not exist.

- [ ] **Step 3: Implement minimal calibration**

Create `front_end/src/ar/arCalibration.ts` with:

```ts
import type { ArTransform, FaceLandmark } from "./types";

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;
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

export function calculateGlassesTransform(landmarks: FaceLandmark[]): ArTransform | null {
  if (![LEFT_EYE_OUTER, RIGHT_EYE_OUTER, NOSE_BRIDGE, NOSE_TIP].every((index) => hasPoint(landmarks, index))) {
    return null;
  }

  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
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
```

- [ ] **Step 4: Run calibration tests and verify GREEN**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/arCalibration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit calibration**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/src/ar/arCalibration.ts front_end/src/ar/arCalibration.test.ts
git commit -m "feat(ar): add face landmark calibration"
```

Expected: commit succeeds.

## Task 4: Build Camera Stream Hook With TDD

**Files:**
- Create: `front_end/src/ar/useCameraStream.test.tsx`
- Create: `front_end/src/ar/useCameraStream.ts`

- [ ] **Step 1: Write failing camera hook tests**

Create `front_end/src/ar/useCameraStream.test.tsx` with:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useCameraStream } from "./useCameraStream";

const originalMediaDevices = navigator.mediaDevices;

function setMediaDevices(value: MediaDevices | undefined) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setMediaDevices(originalMediaDevices);
  vi.restoreAllMocks();
});

describe("useCameraStream", () => {
  test("reports unsupported when getUserMedia is unavailable", async () => {
    setMediaDevices(undefined);
    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("unsupported");
    expect(result.current.stream).toBeNull();
  });

  test("reports denied when the browser rejects camera permission", async () => {
    setMediaDevices({
      getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" })),
    } as unknown as MediaDevices);
    const { result } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("denied");
  });

  test("stores ready stream and stops tracks on cleanup", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    setMediaDevices({
      getUserMedia: vi.fn().mockResolvedValue(stream),
    } as unknown as MediaDevices);
    const { result, unmount } = renderHook(() => useCameraStream());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.stream).toBe(stream);

    unmount();

    expect(stop).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/useCameraStream.test.tsx
```

Expected: FAIL because `./useCameraStream` does not exist.

- [ ] **Step 3: Implement camera hook**

Create `front_end/src/ar/useCameraStream.ts` with:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "./types";

export function useCameraStream() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    stop();

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus("ready");
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : (error as { name?: string }).name;
      setStatus(errorName === "NotAllowedError" || errorName === "PermissionDeniedError" ? "denied" : "error");
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { status, stream, start, stop };
}
```

- [ ] **Step 4: Run camera hook tests and verify GREEN**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/useCameraStream.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit camera hook**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/src/ar/useCameraStream.ts front_end/src/ar/useCameraStream.test.tsx
git commit -m "feat(ar): add camera stream lifecycle hook"
```

Expected: commit succeeds.

## Task 5: Build MediaPipe Face Tracking Adapter With TDD

**Files:**
- Create: `front_end/src/ar/faceLandmarker.ts`
- Create: `front_end/src/ar/useFaceLandmarks.test.tsx`
- Create: `front_end/src/ar/useFaceLandmarks.ts`

- [ ] **Step 1: Create MediaPipe adapter**

Create `front_end/src/ar/faceLandmarker.ts` with:

```ts
import type { FaceLandmark } from "./types";

export interface FaceLandmarkerDetector {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceLandmarks?: FaceLandmark[][] };
  close?: () => void;
}

export async function createFaceLandmarker(): Promise<FaceLandmarkerDetector> {
  const vision = await import("@mediapipe/tasks-vision");
  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  return vision.FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}
```

- [ ] **Step 2: Write failing face tracking hook tests**

Create `front_end/src/ar/useFaceLandmarks.test.tsx` with:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FaceLandmarkerDetector } from "./faceLandmarker";
import { useFaceLandmarks } from "./useFaceLandmarks";

const video = document.createElement("video");
Object.defineProperty(video, "readyState", { configurable: true, value: 4 });

beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(100);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFaceLandmarks", () => {
  test("tracks the first face returned by the detector", async () => {
    const detector: FaceLandmarkerDetector = {
      detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] }),
      close: vi.fn(),
    };
    const createDetector = vi.fn().mockResolvedValue(detector);
    const { result, unmount } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: true, createDetector }));

    await waitFor(() => expect(result.current.status).toBe("tracking"));

    expect(result.current.landmarks).toEqual([{ x: 0.5, y: 0.5, z: 0 }]);
    expect(detector.detectForVideo).toHaveBeenCalledWith(video, 100);

    unmount();

    expect(detector.close).toHaveBeenCalledOnce();
  });

  test("reports no-face when detector returns no landmarks", async () => {
    const createDetector = vi.fn().mockResolvedValue({
      detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [] }),
    });
    const { result } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: true, createDetector }));

    await waitFor(() => expect(result.current.status).toBe("no-face"));

    expect(result.current.landmarks).toBeNull();
  });

  test("stays initializing when disabled", async () => {
    const createDetector = vi.fn();
    const { result } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: false, createDetector }));

    await act(async () => undefined);

    expect(result.current.status).toBe("initializing");
    expect(createDetector).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/useFaceLandmarks.test.tsx
```

Expected: FAIL because `./useFaceLandmarks` does not exist.

- [ ] **Step 4: Implement face tracking hook**

Create `front_end/src/ar/useFaceLandmarks.ts` with:

```ts
import { type RefObject, useEffect, useState } from "react";
import { createFaceLandmarker, type FaceLandmarkerDetector } from "./faceLandmarker";
import type { FaceLandmark, TrackingStatus } from "./types";

interface UseFaceLandmarksOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  createDetector?: () => Promise<FaceLandmarkerDetector>;
}

export function useFaceLandmarks({
  videoRef,
  enabled,
  createDetector = createFaceLandmarker,
}: UseFaceLandmarksOptions) {
  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [landmarks, setLandmarks] = useState<FaceLandmark[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("initializing");
      setLandmarks(null);
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let detector: FaceLandmarkerDetector | null = null;

    async function run() {
      try {
        detector = await createDetector();
        const tick = (timestampMs: number) => {
          if (cancelled || !detector) {
            return;
          }

          const video = videoRef.current;
          if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const result = detector.detectForVideo(video, timestampMs);
            const firstFace = result.faceLandmarks?.[0] ?? null;
            setLandmarks(firstFace);
            setStatus(firstFace ? "tracking" : "no-face");
          }

          frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setLandmarks(null);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      detector?.close?.();
    };
  }, [createDetector, enabled, videoRef]);

  return { status, landmarks };
}
```

- [ ] **Step 5: Run face tracking hook tests and verify GREEN**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/useFaceLandmarks.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit face tracking adapter**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/src/ar/faceLandmarker.ts front_end/src/ar/useFaceLandmarks.ts front_end/src/ar/useFaceLandmarks.test.tsx
git commit -m "feat(ar): add mediapipe face tracking hook"
```

Expected: commit succeeds.

## Task 6: Build Three.js Try-On Canvas

**Files:**
- Create: `front_end/src/ar/ArTryOnCanvas.test.tsx`
- Create: `front_end/src/ar/ArTryOnCanvas.tsx`

- [ ] **Step 1: Write failing render component tests**

Create `front_end/src/ar/ArTryOnCanvas.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ArTryOnCanvas } from "./ArTryOnCanvas";
import { getArFrameConfig } from "./frameCatalog";

describe("ArTryOnCanvas", () => {
  test("renders video and canvas layers for the AR scene", () => {
    const stream = { id: "stream-1" } as MediaStream;

    render(
      <ArTryOnCanvas
        stream={stream}
        frame={getArFrameConfig("matte-black")}
        transform={null}
        onCaptureReady={vi.fn()}
      />
    );

    expect(screen.getByTestId("ar-video-layer")).toBeInTheDocument();
    expect(screen.getByTestId("ar-canvas-layer")).toBeInTheDocument();
  });

  test("exposes a capture function when the canvas is ready", () => {
    const onCaptureReady = vi.fn();

    render(
      <ArTryOnCanvas
        stream={{ id: "stream-1" } as MediaStream}
        frame={getArFrameConfig("titanium")}
        transform={null}
        onCaptureReady={onCaptureReady}
      />
    );

    expect(onCaptureReady).toHaveBeenCalledWith(expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/ArTryOnCanvas.test.tsx
```

Expected: FAIL because `./ArTryOnCanvas` does not exist.

- [ ] **Step 3: Implement Three.js canvas**

Create `front_end/src/ar/ArTryOnCanvas.tsx` with:

```tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ArFrameConfig, ArTransform } from "./types";

interface ArTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ArFrameConfig;
  transform: ArTransform | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
}

function createProceduralGlasses(frame: ArFrameConfig) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: frame.frameColor, roughness: 0.36, metalness: 0.72 });
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: frame.lensColor,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    transmission: 0.35,
  });

  const rimGeometry = new THREE.TorusGeometry(0.22, 0.018, 16, 48);
  const leftRim = new THREE.Mesh(rimGeometry, material);
  leftRim.position.x = -0.24;
  const rightRim = new THREE.Mesh(rimGeometry, material);
  rightRim.position.x = 0.24;

  const lensGeometry = new THREE.CircleGeometry(0.19, 48);
  const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
  leftLens.position.set(-0.24, 0, -0.01);
  const rightLens = new THREE.Mesh(lensGeometry, lensMaterial);
  rightLens.position.set(0.24, 0, -0.01);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.028), material);
  const leftTemple = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.022, 0.022), material);
  leftTemple.position.set(-0.5, 0.02, -0.06);
  leftTemple.rotation.y = -0.55;
  const rightTemple = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.022, 0.022), material);
  rightTemple.position.set(0.5, 0.02, -0.06);
  rightTemple.rotation.y = 0.55;

  group.add(leftRim, rightRim, leftLens, rightLens, bridge, leftTemple, rightTemple);
  return group;
}

export function ArTryOnCanvas({ stream, frame, transform, onCaptureReady }: ArTryOnCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glassesRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 2.8;
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(0, 1, 2);
    scene.add(keyLight);

    const glasses = createProceduralGlasses(frame);
    glassesRef.current = glasses;
    scene.add(glasses);

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / Math.max(bounds.height, 1);
      camera.updateProjectionMatrix();
    };

    let frameId = 0;
    const renderFrame = () => {
      resize();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    onCaptureReady(() => canvas.toDataURL("image/png"));
    renderFrame();

    return () => {
      window.cancelAnimationFrame(frameId);
      onCaptureReady(null);
      scene.remove(glasses);
      glasses.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [frame, onCaptureReady]);

  useEffect(() => {
    const glasses = glassesRef.current;
    if (!glasses || !transform) {
      return;
    }

    const offset = frame.transformOffset;
    glasses.position.set(
      transform.position[0] + offset.position[0],
      transform.position[1] + offset.position[1],
      transform.position[2] + offset.position[2]
    );
    glasses.rotation.set(
      transform.rotation[0] + offset.rotation[0],
      transform.rotation[1] + offset.rotation[1],
      transform.rotation[2] + offset.rotation[2]
    );
    glasses.scale.setScalar(transform.scale[0] * offset.scale);
  }, [frame.transformOffset, transform]);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-[#050B16]">
      <video
        ref={videoRef}
        data-testid="ar-video-layer"
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        autoPlay
        muted
        playsInline
      />
      <canvas ref={canvasRef} data-testid="ar-canvas-layer" className="absolute inset-0 h-full w-full scale-x-[-1]" />
    </div>
  );
}
```

- [ ] **Step 4: Run canvas tests and verify GREEN**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/ar/ArTryOnCanvas.test.tsx
```

Expected: PASS. If jsdom lacks WebGL support, mock `THREE.WebGLRenderer` in this test file before changing production code.

- [ ] **Step 5: Commit canvas**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/src/ar/ArTryOnCanvas.tsx front_end/src/ar/ArTryOnCanvas.test.tsx
git commit -m "feat(ar): render procedural try-on canvas"
```

Expected: commit succeeds.

## Task 7: Refactor AR Studio Into Real Runtime States

**Files:**
- Modify: `front_end/src/pages/ARVirtualStudio.tsx`
- Modify: `front_end/src/i18n/locales/en/ar-studio.json`
- Modify: `front_end/src/i18n/locales/zh/ar-studio.json`
- Test: existing and new page tests if introduced during implementation.

- [ ] **Step 1: Add AR runtime copy**

Modify `front_end/src/i18n/locales/en/ar-studio.json` by adding these keys:

```json
{
  "status.initializing": "Preparing camera and face tracking",
  "status.permission-denied": "Camera access is blocked",
  "status.unsupported": "Live try-on needs a camera-capable browser",
  "status.tracking": "Live AR Try-On Active",
  "status.no-face": "Position your face inside the camera view",
  "status.low-confidence": "Hold steady while tracking stabilizes",
  "status.error": "Live try-on is temporarily unavailable",
  "fallback.continue": "Continue with product preview",
  "camera.start": "Start Camera",
  "camera.retry": "Retry Camera",
  "capture.ready": "Still captured from live try-on.",
  "capture.unavailable": "Start live try-on before capturing a still."
}
```

Modify `front_end/src/i18n/locales/zh/ar-studio.json` by adding these keys:

```json
{
  "status.initializing": "正在准备摄像头和面部追踪",
  "status.permission-denied": "摄像头访问已被阻止",
  "status.unsupported": "实时试戴需要支持摄像头的现代浏览器",
  "status.tracking": "AR 实时试戴中",
  "status.no-face": "请将面部置于摄像头画面中",
  "status.low-confidence": "请保持稳定，等待追踪校准",
  "status.error": "实时试戴暂时不可用",
  "fallback.continue": "继续使用产品预览",
  "camera.start": "开启摄像头",
  "camera.retry": "重试摄像头",
  "capture.ready": "已从实时试戴中捕获静帧。",
  "capture.unavailable": "请先开启实时试戴再捕获静帧。"
}
```

- [ ] **Step 2: Write failing AR Studio state test**

Create `front_end/src/pages/ARVirtualStudio.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { ARVirtualStudio } from "./ARVirtualStudio";

vi.mock("../ar/useCameraStream", () => ({
  useCameraStream: () => ({
    status: "unsupported",
    stream: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../ar/useFaceLandmarks", () => ({
  useFaceLandmarks: () => ({
    status: "initializing",
    landmarks: null,
  }),
}));

vi.mock("../ar/ArTryOnCanvas", () => ({
  ArTryOnCanvas: () => <div data-testid="ar-try-on-canvas" />,
}));

describe("ARVirtualStudio", () => {
  test("shows unsupported fallback instead of claiming live tracking", () => {
    render(
      <BrowserRouter>
        <ARVirtualStudio />
      </BrowserRouter>
    );

    expect(screen.getByText(/camera-capable browser/i)).toBeInTheDocument();
    expect(screen.queryByText("Live AR Try-On Active")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test and verify RED**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/pages/ARVirtualStudio.test.tsx
```

Expected: FAIL because the page still uses mocked live AR copy.

- [ ] **Step 4: Refactor ARVirtualStudio**

Replace `front_end/src/pages/ARVirtualStudio.tsx` with a version that:

```tsx
import { useCallback, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle, Repeat, Share2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArTryOnCanvas } from "../ar/ArTryOnCanvas";
import { calculateGlassesTransform } from "../ar/arCalibration";
import { DEFAULT_AR_FINISH, getArFrameConfig } from "../ar/frameCatalog";
import type { ArExperienceStatus, ArFinishId } from "../ar/types";
import { useCameraStream } from "../ar/useCameraStream";
import { useFaceLandmarks } from "../ar/useFaceLandmarks";
import { Button } from "../components/ui/Button";
import { GlassPanel } from "../components/ui/GlassPanel";
import { cn } from "../lib/utils";

function resolveExperienceStatus(cameraStatus: string, trackingStatus: string, captured: boolean): ArExperienceStatus {
  if (captured) return "captured";
  if (cameraStatus === "unsupported") return "unsupported";
  if (cameraStatus === "denied") return "permission-denied";
  if (cameraStatus === "error" || trackingStatus === "error") return "error";
  if (cameraStatus !== "ready") return "initializing";
  if (trackingStatus === "tracking") return "tracking";
  if (trackingStatus === "low-confidence") return "low-confidence";
  return "no-face";
}

export function ARVirtualStudio() {
  const { t } = useTranslation("ar-studio");
  const [activeFinish, setActiveFinish] = useState<ArFinishId>(DEFAULT_AR_FINISH);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const camera = useCameraStream();
  const tracking = useFaceLandmarks({ videoRef, enabled: camera.status === "ready" });
  const frame = getArFrameConfig(activeFinish);
  const transform = useMemo(() => (tracking.landmarks ? calculateGlassesTransform(tracking.landmarks) : null), [tracking.landmarks]);
  const experienceStatus = resolveExperienceStatus(camera.status, transform && tracking.status === "tracking" ? "tracking" : tracking.status, Boolean(captureMessage));

  const handleCapture = useCallback(() => {
    const capture = captureRef.current?.();
    setCaptureMessage(capture ? t("capture.ready") : t("capture.unavailable"));
  }, [t]);

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-[#0A1121]">
      <div className="absolute inset-0 z-0">
        <ArTryOnCanvas stream={camera.stream} frame={frame} transform={transform} onCaptureReady={(capture) => (captureRef.current = capture)} />
      </div>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />

      <div className="relative z-30 mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] flex-col justify-between px-4 pb-6 pt-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none flex justify-between gap-4">
          <GlassPanel className="pointer-events-auto max-w-sm px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-cyan font-semibold">{t("studioStatus")}</p>
                <h1 className="mt-2 text-xl font-display font-medium text-white">{t("liveFaceMapping")}</h1>
                <p className="mt-2 text-sm text-slate-300 font-light">{t(`status.${experienceStatus}`)}</p>
              </div>
              <Sparkles className="w-5 h-5 text-brand-cyan shrink-0" />
            </div>
          </GlassPanel>
        </div>

        <div className="mt-auto flex flex-col items-center justify-end pointer-events-none">
          <GlassPanel className="p-5 sm:p-8 mb-4 w-full max-w-4xl pointer-events-auto flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-white text-xl md:text-2xl tracking-wide font-light">{frame.productName}</h2>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold tracking-widest flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full", experienceStatus === "tracking" ? "bg-emerald-400 animate-pulse" : "bg-amber-300")} />
                  {t(`status.${experienceStatus}`)}
                </p>
              </div>
              <Button variant="outline-dark" onClick={camera.start}>
                <Camera className="w-4 h-4" />
                {camera.status === "idle" ? t("camera.start") : t("camera.retry")}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-center sm:gap-12 py-2">
              {(["matte-black", "titanium", "rose-gold"] as const).map((finish) => {
                const option = getArFrameConfig(finish);
                return (
                  <button key={finish} onClick={() => setActiveFinish(finish)} className="group flex flex-col items-center gap-3 rounded-2xl px-2 py-1">
                    <div className={cn("w-12 h-12 rounded-full p-1 relative transition-colors duration-300", activeFinish === finish ? "border-2 border-white" : "border border-white/20 group-hover:border-white/50")}>
                      <div className="w-full h-full rounded-full shadow-inner" style={{ background: option.frameColor }} />
                      {activeFinish === finish ? <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-white bg-[#050B16] rounded-full" /> : null}
                    </div>
                    <span className={cn("text-[9px] text-center uppercase tracking-widest font-semibold transition-colors duration-300", activeFinish === finish ? "text-white" : "text-slate-500 group-hover:text-slate-300")}>
                      {t(option.finishLabelKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{t("liveReadout")}</p>
                <p className="mt-2">{t("lensProfile")}: {frame.lensLabel}. {experienceStatus === "tracking" ? t("captureInstruction") : t("fallback.continue")}</p>
              </div>
              <Link to="/config-lab" className="w-full">
                <Button variant="outline-dark" className="w-full">
                  <SlidersHorizontal className="w-4 h-4" />
                  {t("configurePrecisionLenses")}
                </Button>
              </Link>
            </div>
          </GlassPanel>

          <div className="flex flex-wrap justify-center gap-3 pointer-events-auto">
            <button onClick={camera.start} className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300">
              <Repeat className="w-4 h-4" />
            </button>
            <button onClick={handleCapture} className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300">
              <Camera className="w-4 h-4" />
            </button>
            <button className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          {captureMessage ? <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold pointer-events-auto">{captureMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run AR Studio test and verify GREEN**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test -- src/pages/ARVirtualStudio.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit AR Studio refactor**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end/src/pages/ARVirtualStudio.tsx front_end/src/pages/ARVirtualStudio.test.tsx front_end/src/i18n/locales/en/ar-studio.json front_end/src/i18n/locales/zh/ar-studio.json
git commit -m "feat(ar): wire real try-on runtime states"
```

Expected: commit succeeds.

## Task 8: Final Verification and Browser Check

**Files:**
- Modify only if verification reveals issues.

- [ ] **Step 1: Run frontend unit tests**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run TypeScript lint**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm run lint
```

Expected: `tsc --noEmit` passes.

- [ ] **Step 3: Build frontend**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Run local dev server**

Run:

```powershell
cd C:\Users\17761\Desktop\Klarheit\front_end
npm run dev
```

Expected: Vite serves the app on `http://localhost:3000`.

- [ ] **Step 5: Manual browser verification**

Open `http://localhost:3000/virtual-studio`.

Expected:

- The page no longer shows a fake static background as the core AR layer.
- Clicking `Start Camera` asks for camera permission in a supported browser.
- Permission denial shows the camera-blocked state.
- Unsupported camera APIs show the unsupported-browser state in tests or browser emulation.
- The finish selector updates the rendered frame color without navigation.
- The Config Lab link remains usable.

- [ ] **Step 6: Commit verification fixes if needed**

If fixes were required, run:

```powershell
cd C:\Users\17761\Desktop\Klarheit
git add front_end
git commit -m "fix(ar): stabilize webar verification"
```

Expected: commit succeeds only if verification changed files.

## Plan Self-Review

Spec coverage:

- Camera lifecycle is covered by Task 4.
- MediaPipe face tracking is covered by Task 5.
- Calibration math is covered by Task 3.
- Three.js overlay and screenshot capture are covered by Task 6.
- Product/finish switching and truthful AR states are covered by Task 7.
- Final verification is covered by Task 8.

Placeholder scan:

- The plan intentionally mentions placeholder 3D assets only as the approved first-milestone asset strategy.
- The plan has no placeholder markers or unspecified future work required for completion.

Type consistency:

- `CameraStatus`, `TrackingStatus`, `ArExperienceStatus`, `ArFinishId`, `FaceLandmark`, `ArTransform`, and `ArFrameConfig` are defined in Task 2 and reused consistently in later tasks.

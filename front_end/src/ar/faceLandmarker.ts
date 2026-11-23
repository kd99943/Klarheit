import type { FaceLandmark } from "./types";

export interface FaceLandmarkerDetector {
  detectForVideo(image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap, timestampMs: number): { faceLandmarks?: FaceLandmark[][] };
  close?: () => void;
}

export async function createFaceLandmarker(): Promise<FaceLandmarkerDetector> {
  const vision = await import("@mediapipe/tasks-vision");
  const inWorker = typeof document === "undefined";
  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    // Absolute worker URLs keep Vite from rewriting the public loader as a source import.
    inWorker ? new URL("/wasm", self.location.href).href : "/wasm", inWorker
  );

  const sharedOptions = {
    runningMode: "VIDEO" as const,
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    ...(inWorker ? { canvas: new OffscreenCanvas(1, 1) } : {}),
  };

  try {
    return await vision.FaceLandmarker.createFromOptions(filesetResolver, {
      ...sharedOptions,
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "GPU",
      },
    });
  } catch {
    // Module loaders clear ModuleFactory after use; a fallback must execute the loader again.
    const fallbackFileset = inWorker
      ? { ...filesetResolver, wasmLoaderPath: `${filesetResolver.wasmLoaderPath}?fallback=cpu` }
      : filesetResolver;
    return await vision.FaceLandmarker.createFromOptions(fallbackFileset, {
      ...sharedOptions,
      baseOptions: {
        modelAssetPath: "/models/face_landmarker.task",
        delegate: "CPU",
      },
    });
  }
}

import type { FaceLandmark } from "./types";

export interface FaceLandmarkerDetector {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { faceLandmarks?: FaceLandmark[][] };
  close?: () => void;
}

export async function createFaceLandmarker(): Promise<FaceLandmarkerDetector> {
  const vision = await import("@mediapipe/tasks-vision");
  const filesetResolver = await vision.FilesetResolver.forVisionTasks(
    "/wasm"
  );

  return vision.FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

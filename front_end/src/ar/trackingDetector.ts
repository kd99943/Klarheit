import { createFaceLandmarker, type FaceLandmarkerDetector } from "./faceLandmarker";

type DetectionResult = ReturnType<FaceLandmarkerDetector["detectForVideo"]>;
export interface TrackingDetector {
  readonly execution?: "worker" | "main";
  detectForVideo(image: HTMLCanvasElement, timestampMs: number): DetectionResult | Promise<DetectionResult>;
  close?: () => void;
}
export type TrackingWorkerRequest = { image: ImageBitmap; timestampMs: number };
export type TrackingWorkerResponse = { type: "ready" } | { type: "result"; result: DetectionResult } | { type: "error"; message: string };

async function createWorkerDetector(): Promise<TrackingDetector> {
  const worker = new Worker(new URL("./faceLandmarker.worker.ts", import.meta.url), { type: "module" });
  let closed = false;
  let pending: { resolve: (result: DetectionResult) => void; reject: (error: Error) => void } | null = null;
  let timeout: ReturnType<typeof setTimeout>;
  const stop = (error: Error) => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    pending?.reject(error);
    pending = null;
    worker.terminate();
  };
  await new Promise<void>((resolve, reject) => {
    timeout = setTimeout(() => { stop(new Error("Face worker initialization timed out")); reject(new Error("Face worker initialization timed out")); }, 30000);
    worker.onerror = (event) => {
      const error = new Error(event.message || "Face worker failed");
      stop(error); reject(error);
    };
    worker.onmessage = (event: MessageEvent<TrackingWorkerResponse>) => {
      const message = event.data;
      if (message.type === "ready") { clearTimeout(timeout); resolve(); }
      else if (message.type === "error") { const error = new Error(message.message); stop(error); reject(error); }
      else { clearTimeout(timeout); pending?.resolve(message.result); pending = null; }
    };
  });
  return {
    execution: "worker",
    async detectForVideo(image, timestampMs) {
      if (closed) throw new Error("Face worker is closed");
      const bitmap = await createImageBitmap(image);
      if (closed) { bitmap.close(); throw new Error("Face worker is closed"); }
      return new Promise<DetectionResult>((resolve, reject) => {
        pending = { resolve, reject };
        timeout = setTimeout(() => stop(new Error("Face detection timed out")), 5000);
        try { worker.postMessage({ image: bitmap, timestampMs } satisfies TrackingWorkerRequest, [bitmap]); }
        catch (error) { bitmap.close(); stop(error instanceof Error ? error : new Error(String(error))); }
      });
    },
    close: () => stop(new Error("Face worker is closed")),
  };
}

export async function createTrackingDetector(): Promise<TrackingDetector> {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
    try { return await createWorkerDetector(); }
    catch (error) { if (import.meta.env.DEV) console.warn("Face worker unavailable; using main thread", error); }
  }
  const detector = await createFaceLandmarker();
  return { execution: "main", detectForVideo: detector.detectForVideo.bind(detector), close: () => detector.close?.() };
}

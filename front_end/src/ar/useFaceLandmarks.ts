import { type RefObject, useEffect, useRef, useState } from "react";
import { createTrackingDetector, type TrackingDetector } from "./trackingDetector";
import type { ARTrackedFrame, FaceLandmark, TrackingStatus } from "./types";

interface UseFaceLandmarksOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  createDetector?: () => Promise<TrackingDetector>;
}

/** Freeze one decoded frame, detect that image, then publish pixels and pose atomically. */
export function useFaceLandmarks({ videoRef, enabled, createDetector = createTrackingDetector }: UseFaceLandmarksOptions) {
  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [landmarks, setLandmarks] = useState<FaceLandmark[] | null>(null);
  const landmarksRef = useRef<FaceLandmark[] | null>(null);
  const trackedFrameRef = useRef<ARTrackedFrame | null>(null);

  useEffect(() => {
    setStatus("initializing");
    setLandmarks(null);
    landmarksRef.current = null;
    trackedFrameRef.current = null;
    if (!enabled) return;

    let cancelled = false;
    let animationId = 0;
    let videoFrameId: number | null = null;
    let scheduledVideo: HTMLVideoElement | null = null;
    let detector: TrackingDetector | null = null;
    let tickCount = 0;
    let lastStatus: TrackingStatus = "initializing";
    let lastMediaTime = -1;
    let lastCurrentTime = -1;
    let lastTimestamp = -1;
    let lastVideo: HTMLVideoElement | null = null;
    let lastStream: MediaProvider | null = null;
    let detecting = false;
    let pendingFrame = false;
    let pendingMediaTime: number | undefined;
    const buffers = Array.from({ length: 2 }, () => {
      const image = document.createElement("canvas");
      return { image, context: image.getContext("2d") };
    });

    const cancelScheduled = () => {
      window.cancelAnimationFrame(animationId);
      animationId = 0;
      if (videoFrameId !== null) scheduledVideo?.cancelVideoFrameCallback(videoFrameId);
      videoFrameId = null;
      scheduledVideo = null;
    };
    const fail = () => {
      cancelScheduled();
      detector?.close?.();
      detector = null;
      setStatus("error");
      setLandmarks(null);
      landmarksRef.current = null;
      trackedFrameRef.current = null;
    };
    const schedule = () => {
      if (cancelled || document.hidden || videoFrameId !== null || animationId !== 0) return;
      const video = videoRef.current;
      if (video && typeof video.requestVideoFrameCallback === "function") {
        scheduledVideo = video;
        videoFrameId = video.requestVideoFrameCallback((time, metadata) => { void tick(time, metadata.mediaTime); });
      } else {
        animationId = window.requestAnimationFrame((time) => { void tick(time); });
      }
    };
    const tick = async (timestampMs: number, mediaTime?: number) => {
      videoFrameId = null;
      animationId = 0;
      if (cancelled || !detector || document.hidden) return;
      if (detecting) {
        pendingFrame = true;
        pendingMediaTime = mediaTime;
        return;
      }
      pendingFrame = false;
      pendingMediaTime = undefined;
      const { image, context } = buffers.find((buffer) => buffer.image !== trackedFrameRef.current?.image)!;
      const video = videoRef.current;
      try {
        if (video && context && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          if (video !== lastVideo || video.srcObject !== lastStream) {
            lastMediaTime = -1;
            lastCurrentTime = -1;
            lastVideo = video;
            lastStream = video.srcObject;
          }
          const currentTime = video.currentTime;
          const time = mediaTime ?? currentTime;
          if (time !== lastMediaTime || currentTime !== lastCurrentTime) {
            if (image.width !== video.videoWidth || image.height !== video.videoHeight) {
              image.width = video.videoWidth;
              image.height = video.videoHeight;
            }
            context.drawImage(video, 0, 0, image.width, image.height);
            // MediaPipe requires strictly increasing timestamps, including after playback restarts.
            const timestamp = Math.max(timestampMs, lastTimestamp + 0.001);
            detecting = true;
            const stream = video.srcObject;
            const detection = detector.detectForVideo(image, timestamp);
            // Reserve the next decoded frame while the worker runs. If it arrives
            // early, process the latest video pixels as soon as the worker finishes.
            if (detection instanceof Promise) schedule();
            const result = detection instanceof Promise ? await detection : detection;
            detecting = false;
            if (cancelled) return;
            if (video !== videoRef.current || stream !== video.srcObject) { schedule(); return; }
            const firstFace = result.faceLandmarks?.[0] ?? null;
            trackedFrameRef.current = { image, landmarks: firstFace, timestampMs: timestamp, mediaTime: time };
            landmarksRef.current = firstFace;
            lastMediaTime = time;
            lastCurrentTime = currentTime;
            lastTimestamp = timestamp;
            const nextStatus: TrackingStatus = firstFace ? "tracking" : "no-face";
            if (nextStatus !== lastStatus || ++tickCount % 2 === 0) {
              lastStatus = nextStatus;
              setStatus(nextStatus);
              setLandmarks(firstFace);
            }
          }
        }
      } catch {
        detecting = false;
        if (!cancelled) fail();
        return;
      }
      if (pendingFrame) {
        const nextMediaTime = pendingMediaTime;
        pendingFrame = false;
        pendingMediaTime = undefined;
        void tick(performance.now(), nextMediaTime);
      } else {
        schedule();
      }
    };
    const onVisibilityChange = () => {
      cancelScheduled();
      if (!document.hidden && detector) schedule();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    void (async () => {
      try {
        if (buffers.some((buffer) => !buffer.context)) throw new Error("2D canvas unavailable");
        const ready = await createDetector();
        if (cancelled) { ready.close?.(); return; }
        detector = ready;
        schedule();
      } catch {
        if (!cancelled) fail();
      }
    })();

    return () => {
      cancelled = true;
      cancelScheduled();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      detector?.close?.();
      landmarksRef.current = null;
      trackedFrameRef.current = null;
      buffers.forEach(({ image }) => { image.width = image.height = 0; });
    };
  }, [createDetector, enabled, videoRef]);

  return { status, landmarks, landmarksRef, trackedFrameRef };
}

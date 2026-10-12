import { type RefObject, useEffect, useRef, useState } from "react";
import { createFaceLandmarker, type FaceLandmarkerDetector } from "./faceLandmarker";
import type { FaceLandmark, TrackingStatus } from "./types";

interface UseFaceLandmarksOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  createDetector?: () => Promise<FaceLandmarkerDetector>;
}

/**
 * Face landmark tracker.
 *
 * Landmarks update every rAF into `landmarksRef` so the Three.js render loop
 * can read them without forcing React re-renders. The `landmarks` state is a
 * throttled mirror for UI hints (fit tips, PD estimate).
 */
export function useFaceLandmarks({
  videoRef,
  enabled,
  createDetector = createFaceLandmarker,
}: UseFaceLandmarksOptions) {
  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [landmarks, setLandmarks] = useState<FaceLandmark[] | null>(null);
  const landmarksRef = useRef<FaceLandmark[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("initializing");
      setLandmarks(null);
      landmarksRef.current = null;
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let detector: FaceLandmarkerDetector | null = null;
    let tickCount = 0;
    let lastStatus: TrackingStatus = "initializing";
    let paused = false;

    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    async function run() {
      try {
        detector = await createDetector();
        const tick = (timestampMs: number) => {
          if (cancelled || !detector) {
            return;
          }

          // Skip detection when page is hidden to avoid GC pressure
          if (paused) {
            frameId = window.requestAnimationFrame(tick);
            return;
          }

          const video = videoRef.current;
          if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const result = detector.detectForVideo(video, timestampMs);
            const firstFace = result.faceLandmarks?.[0] ?? null;
            landmarksRef.current = firstFace;

            const nextStatus: TrackingStatus = firstFace ? "tracking" : "no-face";
            if (nextStatus !== lastStatus) {
              lastStatus = nextStatus;
              setStatus(nextStatus);
              setLandmarks(firstFace);
            } else {
              tickCount += 1;
              // ~15fps UI sync at 60fps rAF — enough for hints, cheap for React
              if (tickCount % 4 === 0) {
                setLandmarks(firstFace);
              }
            }
          }

          frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setLandmarks(null);
          landmarksRef.current = null;
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      detector?.close?.();
    };
  }, [createDetector, enabled, videoRef]);

  return { status, landmarks, landmarksRef };
}

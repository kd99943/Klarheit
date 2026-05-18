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

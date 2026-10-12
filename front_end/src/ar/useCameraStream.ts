import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "./types";
import { track } from "../services/analytics";

const CAMERA_PROMPT_TIMEOUT_MS = 12000;

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
    track("ar_camera_permission_requested", {});

    try {
      const nextStream = await Promise.race([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new DOMException("Camera prompt timed out", "TimeoutError")),
            CAMERA_PROMPT_TIMEOUT_MS
          );
        }),
      ]);
      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus("ready");
      track("ar_camera_permission_granted", {});
    } catch (error) {
      const errorName =
        error instanceof DOMException
          ? error.name
          : (error as { name?: string }).name;
      setStatus(
        errorName === "NotAllowedError" ||
          errorName === "PermissionDeniedError" ||
          errorName === "TimeoutError"
          ? "denied"
          : "error",
      );
      track("ar_camera_permission_denied", {});
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { status, stream, start, stop };
}

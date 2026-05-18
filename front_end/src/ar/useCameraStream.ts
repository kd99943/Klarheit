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
      const errorName =
        error instanceof DOMException
          ? error.name
          : (error as { name?: string }).name;
      setStatus(
        errorName === "NotAllowedError" ||
          errorName === "PermissionDeniedError"
          ? "denied"
          : "error",
      );
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { status, stream, start, stop };
}

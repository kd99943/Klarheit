import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "./types";
import { track } from "../services/analytics";

const CAMERA_PROMPT_TIMEOUT_MS = 12000;

function stopStreamTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((trackItem) => trackItem.stop());
}

export function useCameraStream() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRequestIdRef = useRef(0);
  const unmountedRef = useRef(false);

  const stop = useCallback(() => {
    // Invalidate any in-flight getUserMedia promise so late user approval immediately closes tracks
    activeRequestIdRef.current += 1;
    stopStreamTracks(streamRef.current);
    streamRef.current = null;
    if (!unmountedRef.current) {
      setStream(null);
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    stop();
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setStatus("requesting");
    track("ar_camera_permission_requested", {});

    const mediaPromise = navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    // Always attach cleanup directly onto getUserMedia so even if Promise.race rejects
    // (timeout, stop(), unmount, or superseded start()), a late-resolving stream is stopped immediately.
    let lateStopped = false;
    const stopOnce = (s: MediaStream) => {
      if (lateStopped) return;
      lateStopped = true;
      stopStreamTracks(s);
    };
    mediaPromise.then(
      (resolvedStream) => {
        if (unmountedRef.current || activeRequestIdRef.current !== requestId) {
          stopOnce(resolvedStream);
        }
      },
      () => {
        // Handled by the main try/catch below when request is still active
      }
    );

    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        // Mark request stale BEFORE rejecting so late approval cannot attach stream
        if (activeRequestIdRef.current === requestId) {
          activeRequestIdRef.current += 1;
        }
        reject(new DOMException("Camera prompt timed out", "TimeoutError"));
      }, CAMERA_PROMPT_TIMEOUT_MS);
    });

    try {
      const nextStream = await Promise.race([mediaPromise, timeoutPromise]);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);

      if (unmountedRef.current || activeRequestIdRef.current !== requestId) {
        stopOnce(nextStream);
        return;
      }

      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus("ready");
      track("ar_camera_permission_granted", {});
    } catch (error) {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (unmountedRef.current) return;

      const errorName =
        error instanceof DOMException
          ? error.name
          : (error as { name?: string })?.name;
      // Ignore errors from superseded requests unless this was our own timeout
      if (activeRequestIdRef.current !== requestId && errorName !== "TimeoutError") {
        return;
      }
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

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      activeRequestIdRef.current += 1;
      stopStreamTracks(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  return { status, stream, start, stop };
}

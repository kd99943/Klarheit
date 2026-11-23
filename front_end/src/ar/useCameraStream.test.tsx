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

  test("P0-09: stops tracks immediately if getUserMedia resolves AFTER timeout", async () => {
    vi.useFakeTimers();
    try {
      let resolveMedia: (s: MediaStream) => void = () => {};
      const stop = vi.fn();
      const lateStream = {
        getTracks: () => [{ stop }],
      } as unknown as MediaStream;

      setMediaDevices({
        getUserMedia: vi.fn().mockImplementation(
          () => new Promise<MediaStream>((resolve) => { resolveMedia = resolve; })
        ),
      } as unknown as MediaDevices);

      const { result } = renderHook(() => useCameraStream());

      let startPromise!: Promise<void>;
      act(() => {
        startPromise = result.current.start();
      });

      await act(async () => {
        vi.advanceTimersByTime(12500);
        await startPromise;
      });

      expect(result.current.status).toBe("denied");
      expect(result.current.stream).toBeNull();

      // User clicks "Allow" in browser prompt AFTER our timeout already fired
      await act(async () => {
        resolveMedia(lateStream);
        await Promise.resolve();
      });

      expect(stop).toHaveBeenCalledOnce();
      expect(result.current.stream).toBeNull();
      expect(result.current.status).toBe("denied");
    } finally {
      vi.useRealTimers();
    }
  });

  test("P0-09: stops tracks immediately if getUserMedia resolves AFTER unmount", async () => {
    let resolveMedia: (s: MediaStream) => void = () => {};
    const stop = vi.fn();
    const lateStream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;

    setMediaDevices({
      getUserMedia: vi.fn().mockImplementation(
        () => new Promise<MediaStream>((resolve) => { resolveMedia = resolve; })
      ),
    } as unknown as MediaDevices);

    const { result, unmount } = renderHook(() => useCameraStream());

    act(() => {
      void result.current.start();
    });

    unmount();

    await act(async () => {
      resolveMedia(lateStream);
      await Promise.resolve();
    });

    expect(stop).toHaveBeenCalledOnce();
  });
});

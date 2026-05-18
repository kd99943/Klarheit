import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FaceLandmarkerDetector } from "./faceLandmarker";
import { useFaceLandmarks } from "./useFaceLandmarks";

const video = document.createElement("video");
Object.defineProperty(video, "readyState", { configurable: true, value: 4 });

beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    setTimeout(() => callback(100), 0);
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFaceLandmarks", () => {
  test("tracks the first face returned by the detector", async () => {
    const detector: FaceLandmarkerDetector = {
      detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] }),
      close: vi.fn(),
    };
    const createDetector = vi.fn().mockResolvedValue(detector);
    const { result, unmount } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: true, createDetector }));

    await waitFor(() => expect(result.current.status).toBe("tracking"));

    expect(result.current.landmarks).toEqual([{ x: 0.5, y: 0.5, z: 0 }]);
    expect(detector.detectForVideo).toHaveBeenCalledWith(video, 100);

    // Reset close mock after StrictMode's double-effect cycle is stable,
    // so we only assert the real unmount cleanup.
    vi.mocked(detector.close).mockClear();

    unmount();

    expect(detector.close).toHaveBeenCalledOnce();
  });

  test("reports no-face when detector returns no landmarks", async () => {
    const createDetector = vi.fn().mockResolvedValue({
      detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [] }),
    });
    const { result } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: true, createDetector }));

    await waitFor(() => expect(result.current.status).toBe("no-face"));

    expect(result.current.landmarks).toBeNull();
  });

  test("stays initializing when disabled", async () => {
    const createDetector = vi.fn();
    const { result } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: false, createDetector }));

    await act(async () => undefined);

    expect(result.current.status).toBe("initializing");
    expect(createDetector).not.toHaveBeenCalled();
  });
});

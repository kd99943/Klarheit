import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FaceLandmarkerDetector } from "./faceLandmarker";
import { useFaceLandmarks } from "./useFaceLandmarks";

let video: HTMLVideoElement;
let raf: FrameRequestCallback;
let videoFrame: VideoFrameRequestCallback;
const drawImage = vi.fn();
const face = [{ x: 0.5, y: 0.5, z: 0 }];
function detector() {
  return { detectForVideo: vi.fn().mockReturnValue({ faceLandmarks: [face] }), close: vi.fn() };
}
async function mount(value = detector()) {
  const videoRef = { current: video };
  const hook = renderHook(() => useFaceLandmarks({ videoRef, enabled: true, createDetector: create }));
  function create() { return Promise.resolve(value); }
  await act(async () => undefined);
  return { ...hook, detector: value };
}
beforeEach(() => {
  video = document.createElement("video");
  Object.defineProperties(video, {
    readyState: { configurable: true, value: 4 },
    videoWidth: { configurable: true, value: 640 },
    videoHeight: { configurable: true, value: 480 },
  });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { raf = cb; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  drawImage.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("useFaceLandmarks frame synchronization", () => {
  test("detects the frozen image and publishes its pixels with the matching landmarks", async () => {
    const { result, detector } = await mount();
    act(() => raf(100));
    const frame = result.current.trackedFrameRef.current!;
    expect(frame.image).toBeInstanceOf(HTMLCanvasElement);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 480);
    expect(detector.detectForVideo).toHaveBeenCalledWith(frame.image, 100);
    expect(frame.landmarks).toBe(face);
    expect(result.current.status).toBe("tracking");
    expect(drawImage.mock.invocationCallOrder[0]).toBeLessThan(detector.detectForVideo.mock.invocationCallOrder[0]);
  });

  test("does not run detection repeatedly for the same decoded frame in the rAF fallback", async () => {
    const { detector } = await mount();
    act(() => { raf(100); raf(116); raf(132); });
    expect(detector.detectForVideo).toHaveBeenCalledOnce();
    video.currentTime = 0.033;
    act(() => raf(150));
    expect(detector.detectForVideo).toHaveBeenCalledTimes(2);
  });

  test("uses and cancels requestVideoFrameCallback when available", async () => {
    video.requestVideoFrameCallback = vi.fn((cb) => { videoFrame = cb; return 9; });
    video.cancelVideoFrameCallback = vi.fn();
    const { result, unmount } = await mount();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    act(() => videoFrame(120, { mediaTime: 1.25 } as VideoFrameCallbackMetadata));
    expect(result.current.trackedFrameRef.current?.mediaTime).toBe(1.25);
    unmount();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(9);
    expect(result.current.trackedFrameRef.current).toBeNull();
  });

  test("clears stale landmarks when a frame has no face", async () => {
    const { result, detector } = await mount();
    act(() => raf(100));
    detector.detectForVideo.mockReturnValue({ faceLandmarks: [] });
    video.currentTime = 0.033;
    act(() => raf(133));
    expect(result.current.status).toBe("no-face");
    expect(result.current.trackedFrameRef.current?.landmarks).toBeNull();
    expect(result.current.landmarksRef.current).toBeNull();
  });

  test("handles errors inside frame callbacks and stops scheduling", async () => {
    const value = detector();
    value.detectForVideo.mockImplementation(() => { throw new Error("GPU failed"); });
    const { result } = await mount(value);
    const count = vi.mocked(window.requestAnimationFrame).mock.calls.length;
    act(() => raf(100));
    expect(result.current.status).toBe("error");
    expect(result.current.trackedFrameRef.current).toBeNull();
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(count);
    expect(value.close).toHaveBeenCalledOnce();
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(count);
  });

  test("closes a detector that resolves after unmount", async () => {
    const value = detector();
    let resolve!: (value: FaceLandmarkerDetector) => void;
    const createDetector = () => new Promise<FaceLandmarkerDetector>((done) => { resolve = done; });
    const { unmount } = renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: true, createDetector }));
    unmount();
    await act(async () => resolve(value));
    expect(value.close).toHaveBeenCalledOnce();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  test("keeps timestamps increasing when camera playback restarts", async () => {
    const { result } = await mount();
    video.currentTime = 1;
    act(() => raf(100));
    video.currentTime = 0;
    act(() => raf(100));
    expect(result.current.trackedFrameRef.current?.timestampMs).toBeGreaterThan(100);
  });

  test("stays initializing when disabled", async () => {
    const createDetector = vi.fn();
    renderHook(() => useFaceLandmarks({ videoRef: { current: video }, enabled: false, createDetector }));
    await act(async () => undefined);
    expect(createDetector).not.toHaveBeenCalled();
  });

  test("keeps the published image untouched while the next asynchronous detection is pending", async () => {
    let resolve!: (result: { faceLandmarks: typeof face[] }) => void;
    const inputs: HTMLCanvasElement[] = [];
    const detectForVideo = vi.fn((image: HTMLCanvasElement) => {
      inputs.push(image);
      return inputs.length === 1 ? { faceLandmarks: [face] } : new Promise<{ faceLandmarks: typeof face[] }>((done) => { resolve = done; });
    });
    const createDetector = async () => ({ detectForVideo });
    const videoRef = { current: video };
    const { result } = renderHook(() => useFaceLandmarks({ videoRef, enabled: true, createDetector }));
    await act(async () => undefined);
    await act(async () => raf(100));
    const published = result.current.trackedFrameRef.current;
    video.currentTime = 0.033;
    act(() => raf(133));
    expect(inputs[1]).not.toBe(published?.image);
    expect(result.current.trackedFrameRef.current).toBe(published);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(detectForVideo).toHaveBeenCalledTimes(2);
    await act(async () => resolve({ faceLandmarks: [face] }));
    expect(result.current.trackedFrameRef.current?.image).toBe(inputs[1]);
  });

  test("discards an in-flight result after the video source changes", async () => {
    let resolve!: (result: { faceLandmarks: typeof face[] }) => void;
    const createDetector = async () => ({ detectForVideo: () => new Promise<{ faceLandmarks: typeof face[] }>((done) => { resolve = done; }) });
    const videoRef = { current: video };
    const { result } = renderHook(() => useFaceLandmarks({ videoRef, enabled: true, createDetector }));
    await act(async () => undefined);
    act(() => raf(100));
    videoRef.current = document.createElement("video");
    await act(async () => resolve({ faceLandmarks: [face] }));
    expect(result.current.trackedFrameRef.current).toBeNull();
  });

  test("coalesces frames arriving during detection and processes the latest pixels without an extra frame wait", async () => {
    let resolve!: (result: { faceLandmarks: typeof face[] }) => void;
    const detectForVideo = vi.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
      .mockReturnValue({ faceLandmarks: [face] });
    const createDetector = async () => ({ detectForVideo });
    const videoRef = { current: video };
    const { result } = renderHook(() => useFaceLandmarks({ videoRef, enabled: true, createDetector }));
    await act(async () => undefined);
    act(() => raf(100));
    video.currentTime = 0.033;
    act(() => raf(133));
    expect(detectForVideo).toHaveBeenCalledOnce();
    video.currentTime = 0.066;
    await act(async () => resolve({ faceLandmarks: [face] }));
    expect(detectForVideo).toHaveBeenCalledTimes(2);
    expect(result.current.trackedFrameRef.current?.mediaTime).toBe(0.066);
    expect(result.current.trackedFrameRef.current?.image).toBe(detectForVideo.mock.calls[1][0]);
  });

  test("does not publish a late result or schedule work after unmount", async () => {
    let resolve!: (result: { faceLandmarks: typeof face[] }) => void;
    const close = vi.fn();
    const createDetector = async () => ({ close, detectForVideo: () => new Promise<{ faceLandmarks: typeof face[] }>((done) => { resolve = done; }) });
    const videoRef = { current: video };
    const { result, unmount } = renderHook(() => useFaceLandmarks({ videoRef, enabled: true, createDetector }));
    await act(async () => undefined);
    act(() => raf(100));
    unmount();
    vi.mocked(window.requestAnimationFrame).mockClear();
    await act(async () => resolve({ faceLandmarks: [face] }));
    expect(close).toHaveBeenCalledOnce();
    expect(result.current.trackedFrameRef.current).toBeNull();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});

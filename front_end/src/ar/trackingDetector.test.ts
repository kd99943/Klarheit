import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createTrackingDetector } from "./trackingDetector";

const main = vi.hoisted(() => ({ detectForVideo: vi.fn(), close: vi.fn() }));
vi.mock("./faceLandmarker", () => ({ createFaceLandmarker: vi.fn(async () => main) }));
class MockWorker {
  static instances: MockWorker[] = [];
  static fail = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    MockWorker.instances.push(this);
    queueMicrotask(() => this.onmessage?.({ data: MockWorker.fail ? { type: "error", message: "OffscreenCanvas unavailable" } : { type: "ready" } }));
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  MockWorker.instances = []; MockWorker.fail = false;
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("transfers the frozen bitmap and returns the matching worker result", async () => {
  const detector = await createTrackingDetector();
  expect(detector.execution).toBe("worker");
  const promise = detector.detectForVideo(document.createElement("canvas"), 123);
  await Promise.resolve();
  const worker = MockWorker.instances[0];
  const bitmap = (await vi.mocked(createImageBitmap).mock.results[0].value);
  expect(worker.postMessage).toHaveBeenCalledWith({ image: bitmap, timestampMs: 123 }, [bitmap]);
  worker.onmessage?.({ data: { type: "result", result: { faceLandmarks: [] } } });
  await expect(promise).resolves.toEqual({ faceLandmarks: [] });
  detector.close?.();
  expect(worker.terminate).toHaveBeenCalledOnce();
});

test("falls back when the browser cannot initialize the worker", async () => {
  MockWorker.fail = true;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const detector = await createTrackingDetector();
  expect(detector.execution).toBe("main");
  expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();
  detector.close?.(); expect(main.close).toHaveBeenCalledOnce();
});

test("rejects in-flight detection and terminates the worker on close", async () => {
  const detector = await createTrackingDetector();
  const promise = detector.detectForVideo(document.createElement("canvas"), 1);
  await Promise.resolve();
  detector.close?.();
  await expect(promise).rejects.toThrow("closed");
  expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();
});

test("closes a bitmap created after its detector has been closed", async () => {
  let resolve!: (image: ImageBitmap) => void;
  vi.stubGlobal("createImageBitmap", () => new Promise<ImageBitmap>((done) => { resolve = done; }));
  const detector = await createTrackingDetector();
  const promise = detector.detectForVideo(document.createElement("canvas"), 1);
  detector.close?.();
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  resolve(bitmap);
  await expect(promise).rejects.toThrow("closed");
  expect(bitmap.close).toHaveBeenCalledOnce();
  expect(MockWorker.instances[0].postMessage).not.toHaveBeenCalled();
});

test("surfaces worker runtime failures instead of leaving detection pending", async () => {
  const detector = await createTrackingDetector();
  const promise = detector.detectForVideo(document.createElement("canvas"), 1);
  await Promise.resolve();
  MockWorker.instances[0].onerror?.({ message: "GPU context lost" });
  await expect(promise).rejects.toThrow("GPU context lost");
});

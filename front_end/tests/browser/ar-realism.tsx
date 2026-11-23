import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ARTryOnCanvas } from "../../src/ar/ARTryOnCanvas";
import { FrameShowcase } from "../../src/ar/FrameShowcase";
import { createFaceLandmarker } from "../../src/ar/faceLandmarker";
import { createTrackingDetector, type TrackingDetector } from "../../src/ar/trackingDetector";
import { useFaceLandmarks } from "../../src/ar/useFaceLandmarks";
import { getARFrameConfig, getFrameConfigForProduct, FRAME_MODEL_URLS } from "../../src/ar/frameCatalog";
import type { Product } from "../../src/services/api";
import { buildEnhancedMaterials } from "../../src/ar/frameTextures";
import { enhanceGlbMaterials } from "../../src/ar/enhanceGlbMaterials";
import { disposeModel } from "../../src/ar/arRendering";
import { prepareModelForShadows } from "../../src/ar/glassesGeometry";
import type { ARTrackedFrame } from "../../src/ar/types";
import "../../src/index.css";

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function sample(renderer: THREE.WebGLRenderer) {
  const pixels = new Uint8Array(4);
  const gl = renderer.getContext();
  gl.readPixels(renderer.domElement.width / 2, renderer.domElement.height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return Array.from(pixels);
}

function testProduct(name: string): Product {
  return { id: 1, name, nameEn: name, nameZh: name, material: "test", materialEn: "test", materialZh: "test",
    basePrice: 100, imageUrl: "", shape: "ROUND", specsSize: null, detailImages: null };
}

/** Uses production tracking with a generated video stream; no webcam permission is needed. */
function SyncProbe({ done }: { done: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [enabled, setEnabled] = useState(false);
  const detect = useRef(async () => ({ detectForVideo: (image: HTMLCanvasElement | HTMLVideoElement) => {
    const pixel = (image as HTMLCanvasElement).getContext("2d")!.getImageData(10, 10, 1, 1).data[0];
    return { faceLandmarks: [[{ x: pixel / 255, y: 0.5, z: 0 }]] };
  } }));
  const tracking = useFaceLandmarks({ videoRef, enabled, createDetector: detect.current });
  useEffect(() => {
    const image = document.createElement("canvas");
    image.width = image.height = 64;
    const ctx = image.getContext("2d")!;
    ctx.fillStyle = "rgb(40,100,80)";
    ctx.fillRect(0, 0, 64, 64);
    const media = image.captureStream(30);
    videoRef.current!.srcObject = media;
    setStream(media);
    let stopped = false;
    let id = 0;
    let count = 0;
    let last: ARTrackedFrame | null = null;
    let verified = 0;
    const tick = () => {
      if (stopped) return;
      const frame = tracking.trackedFrameRef.current;
      if (frame && frame !== last) {
        const pixel = frame.image.getContext("2d")!.getImageData(10, 10, 1, 1).data[0];
        if (Math.abs(frame.landmarks![0].x * 255 - pixel) > 1) {
          done("FAIL: 图像与关键点不属于同一帧"); return;
        }
        last = frame;
        videoRef.current!.dataset.verified = String(verified + 1);
        if (++verified === 20) { done(`PASS: ${verified} 个连续解码帧，像素与关键点一致`); return; }
      }
      ctx.fillStyle = `rgb(${40 + (count++ % 10) * 20},100,80)`;
      ctx.fillRect(0, 0, 64, 64);
      videoRef.current!.dataset.probeTicks = String(count);
      id = requestAnimationFrame(tick);
    };
    tick();
    void videoRef.current!.play().then(() => setEnabled(true)).catch((error) => done(`FAIL: ${error}`));
    return () => { stopped = true; cancelAnimationFrame(id); media.getTracks().forEach((track) => track.stop()); };
  }, [done, tracking.trackedFrameRef]);
  return <video ref={videoRef} muted playsInline autoPlay style={{ width: 64, height: 64 }} data-stream-ready={!!stream} data-tracking-status={tracking.status} />;
}

const liveFrame = getFrameConfigForProduct(testProduct("AERO X1"));

/** Exercise the production hook and renderer together with a moving, public portrait. */
function LiveProbe({ portrait, done }: { portrait: HTMLImageElement; done: (message: string, image: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const tracking = useFaceLandmarks({ videoRef, enabled });
  const captureRef = useRef<(() => string | null) | null>(null);
  const modelReadyRef = useRef(false);
  useEffect(() => {
    const source = document.createElement("canvas"); source.width = source.height = 480;
    const ctx = source.getContext("2d")!;
    ctx.fillStyle = "#ddd"; ctx.fillRect(0, 0, 480, 480);
    ctx.drawImage(portrait, portrait.width * 0.18, 0, portrait.width * 0.64, portrait.width * 0.64, 0, 0, 480, 480);
    const stream = source.captureStream(60);
    videoRef.current!.srcObject = stream;
    let id = 0;
    let cancelled = false;
    let tickCount = 0;
    let last: ARTrackedFrame | null = null;
    const times: number[] = [];
    const tick = (timestamp: number) => {
      if (cancelled) return;
      const snapshot = tracking.trackedFrameRef.current;
      if (modelReadyRef.current && snapshot && snapshot !== last && snapshot.landmarks) {
        last = snapshot;
        if (++tickCount > 5) {
          times.push(timestamp);
        }
        if (times.length === 300) {
          const fps = (times.length - 1) * 1000 / (times.at(-1)! - times[0]);
          done(`PASS: 实际视频→MediaPipe→生产渲染持续处理 300 帧；有效追踪 ${fps.toFixed(1)}fps（480×480 合成输入）`, captureRef.current?.() ?? "");
          return;
        }
      }
      ctx.fillStyle = "#ddd"; ctx.fillRect(0, 0, 480, 480);
      ctx.drawImage(portrait, portrait.width * 0.18, 0, portrait.width * 0.64, portrait.width * 0.64,
        Math.sin(timestamp / 500) * 4, 0, 480, 480);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    void videoRef.current!.play().then(() => setEnabled(true));
    return () => { cancelled = true; cancelAnimationFrame(id); stream.getTracks().forEach((track) => track.stop()); };
  }, [done, portrait, tracking.trackedFrameRef]);
  return <div style={{ position: "relative", width: 480, height: 480 }}>
    <video ref={videoRef} muted playsInline autoPlay style={{ opacity: 0, position: "absolute", width: 1, height: 1 }} />
    <ARTryOnCanvas stream={null} frame={liveFrame} transform={null} sourceVideoRef={videoRef} trackedFrameRef={tracking.trackedFrameRef}
      onCaptureReady={(fn) => { captureRef.current = fn; }} onModelLoad={({ status }) => {
        if (status === "error") done("FAIL: 实际视频管线 GLB 加载失败", "");
        else modelReadyRef.current = true;
      }} />
  </div>;
}

function App() {
  const [rows, setRows] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const log = (message: string) => setRows((old) => [...old, message]);

  async function run() {
    setRunning(true); setRows([]); setImages([]);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args) => { errors.push(args.map(String).join(" ")); originalError(...args); };
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let stageRoot: ReturnType<typeof createRoot> | null = null;
    let probeRoot: ReturnType<typeof createRoot> | null = null;
    let detector: Awaited<ReturnType<typeof createFaceLandmarker>> | null = null;
    let trackingDetector: TrackingDetector | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(256, 256);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const gl = renderer.getContext();
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      log(`WebGL2: ${info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`);
      scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
      camera.position.z = 2;
      const image = document.createElement("canvas"); image.width = image.height = 128;
      const ctx = image.getContext("2d")!;
      ctx.fillStyle = "#408060"; ctx.fillRect(0, 0, 128, 128);
      const background = new THREE.CanvasTexture(image); background.colorSpace = THREE.SRGBColorSpace;
      scene.background = background;
      renderer.render(scene, camera);
      const original = sample(renderer);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), buildEnhancedMaterials().opticalLens());
      scene.add(lens);
      renderer.render(scene, camera);
      const transmitted = sample(renderer);
      assert(transmitted[1] > transmitted[0] * 1.3 && transmitted[1] < 235, `镜片发白或丢失背景: ${transmitted}`);
      log(`PASS: 真实透射 pass 保留背景色 RGB ${original.slice(0, 3)} → ${transmitted.slice(0, 3)}`);
      scene.remove(lens); disposeModel(lens);

      const temple = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ color: "red", toneMapped: false }));
      const occluder = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ colorWrite: false }));
      occluder.position.z = 0.1; occluder.renderOrder = -1;
      scene.add(temple); renderer.render(scene, camera);
      assert(sample(renderer)[0] > 240, "遮挡对照物未绘制");
      scene.add(occluder); renderer.render(scene, camera);
      assert(sample(renderer).every((value, index) => Math.abs(value - original[index]) < 3), "深度遮挡没有保留背景");
      log("PASS: 深度遮挡挡住后方模型，背景无黑洞");
      scene.remove(temple, occluder); disposeModel(temple); disposeModel(occluder);
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      for (const [name, url] of Object.entries(FRAME_MODEL_URLS)) {
        const model = (await loader.loadAsync(url)).scene;
        enhanceGlbMaterials(model, { legacyMaterials: true }); prepareModelForShadows(model);
        scene.add(model); renderer.render(scene, camera);
        let meshes = 0; let triangles = 0;
        model.traverse((obj) => { if (obj instanceof THREE.Mesh) { meshes++; triangles += (obj.geometry.index?.count ?? obj.geometry.getAttribute("position").count) / 3; } });
        assert(meshes > 0, `${name} GLB 为空`);
        log(`PASS: ${name} GLB 加载与着色器编译，${meshes} 网格 / ${Math.round(triangles)} 三角面`);
        scene.remove(model); disposeModel(model, true);
      }
      background.dispose();
      renderer.dispose(); renderer = null;

      detector = await createFaceLandmarker();
      const portrait = new Image(); portrait.src = "./portrait.jpg"; await portrait.decode();
      const pixels = document.createElement("canvas");
      pixels.width = 640; pixels.height = Math.round(640 * portrait.height / portrait.width);
      pixels.getContext("2d")!.drawImage(portrait, 0, 0, pixels.width, pixels.height);
      const start = performance.now();
      const result = detector.detectForVideo(pixels, start);
      const landmarks = result.faceLandmarks?.[0];
      assert(landmarks && landmarks.length >= 468, "MediaPipe 未检测到公开测试人像");
      log(`PASS: 实际 MediaPipe 模型检测到 ${landmarks.length} 个点；首帧 ${Math.round(performance.now() - start)}ms（含预热）`);
      const timing: number[] = [];
      for (let i = 0; i < 6; i++) {
        await nextFrame(); const t = performance.now(); detector.detectForVideo(pixels, t); timing.push(performance.now() - t);
      }
      log(`本机静态图检测耗时：中位数 ${timing.sort((a, b) => a - b)[3].toFixed(1)}ms；不代表手机或端到端 FPS`);
      detector.close?.(); detector = null;
      trackingDetector = await createTrackingDetector();
      const workerResult = await trackingDetector.detectForVideo(pixels, performance.now());
      assert((workerResult.faceLandmarks?.[0]?.length ?? 0) >= 468, "异步检测器未返回关键点");
      log(`PASS: 追踪检测器执行位置 ${trackingDetector.execution}，实际模型返回关键点`);
      trackingDetector.close?.(); trackingDetector = null;
      stageRoot = createRoot(stageRef.current!);
      const videoRef = { current: document.createElement("video") };
      const trackedFrameRef = { current: { image: pixels, landmarks, timestampMs: performance.now(), mediaTime: 0 } };
      let capture: (() => string | null) | null = null;
      const cases = Object.keys(FRAME_MODEL_URLS).map((name) => ({ name, frame: getFrameConfigForProduct(testProduct(name)) }));
      const variantProduct = { ...testProduct("AERO X1"), arConfigs: [getARFrameConfig("titanium"), getARFrameConfig("matte-black"), getARFrameConfig("rose-gold")] };
      for (const finish of ["matte-black", "rose-gold"]) {
        const frame = getFrameConfigForProduct(variantProduct, finish);
        assert(frame.modelUrl === FRAME_MODEL_URLS["AERO X1"], "配色未复用同一 GLB");
        cases.push({ name: `AERO X1 ${finish}`, frame });
      }
      for (const { name, frame } of cases) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error(`${name} GLB 加载/渲染超时`)), 15000);
          flushSync(() => stageRoot!.render(<ARTryOnCanvas stream={null} frame={frame} transform={null}
            sourceVideoRef={videoRef} trackedFrameRef={trackedFrameRef} onCaptureReady={(fn) => { capture = fn; }}
            onModelLoad={({ url, status }) => {
              if (url !== frame.modelUrl) return;
              clearTimeout(timeout);
              if (status === "loaded") resolve();
              else reject(new Error(`${name} GLB 加载失败，程序模型不能代替验收`));
            }} />));
        });
        assert(capture, "截图函数未注册");
        const url = capture(); assert(url?.startsWith("data:image/jpeg"), "截图失败");
        setImages((old) => [...old, { name, url }]);
        log(`PASS: ${name} GLB 已替换回退模型并完成渲染及 JPEG 截图`);
      }
      // Verify FrameShowcase 3D turntable with studio backdrop & RoomEnvironment
      const showcaseImage = await new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("FrameShowcase GLB 加载/渲染超时")), 15000);
        flushSync(() => stageRoot!.render(<FrameShowcase frame={liveFrame} className="w-full h-full"
          onModelLoad={({ url, status }) => {
            if (url !== liveFrame.modelUrl) return;
            clearTimeout(timeout);
            if (status === "error") { reject(new Error("FrameShowcase GLB 加载失败，程序模型不能代替验收")); return; }
            try {
              // Read inside the render callback, before the default WebGL buffer is cleared.
              const canvas = stageRef.current!.querySelector("canvas")!;
              const copy = document.createElement("canvas");
              copy.width = canvas.width; copy.height = canvas.height;
              const context = copy.getContext("2d")!;
              context.drawImage(canvas, 0, 0);
              const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
              let modelPixels = 0;
              let clippedPixels = 0;
              for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] > 0 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 130) {
                  modelPixels++;
                  const x = (i / 4) % copy.width, y = Math.floor(i / 4 / copy.width);
                  if (x < 2 || x >= copy.width - 2 || y < 2 || y >= copy.height - 2) clippedPixels++;
                }
              }
              assert(modelPixels > 20, "FrameShowcase 只有背景或没有可见模型");
              assert(clippedPixels === 0, "FrameShowcase 模型被画布边缘裁切");
              resolve(copy.toDataURL("image/jpeg", 0.92));
            } catch (error) { reject(error); }
          }} />));
      });
      setImages((old) => [...old, { name: "AERO X1 3D 展台", url: showcaseImage }]);
      log("PASS: FrameShowcase GLB 已加载并完成渲染；画面包含可见模型，JPEG 截图成功");

      flushSync(() => stageRoot!.unmount()); stageRoot = null;
      assert(capture === null, "卸载未清理截图回调");
      log("PASS: 连续切换四款模型、两种复用配色、3D 展台和卸载");
      probeRoot = createRoot(probeRef.current!);
      const sync = await new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          const video = probeRef.current?.querySelector("video");
          reject(new Error(`视频同步测试超时: ${JSON.stringify({ visibility: document.visibilityState, ready: video?.readyState, time: video?.currentTime, paused: video?.paused, ...video?.dataset })}`));
        }, 15000);
        const done = (message: string) => { clearTimeout(timeout); resolve(message); };
        flushSync(() => probeRoot!.render(<SyncProbe done={done} />));
      });
      log(sync); assert(sync.startsWith("PASS"), sync);
      flushSync(() => probeRoot!.unmount()); probeRoot = createRoot(probeRef.current!);
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("实际视频管线测试超时")), 30000);
        const done = (message: string, url: string) => {
          clearTimeout(timeout); log(message);
          if (!message.startsWith("PASS") || !url.startsWith("data:image/jpeg")) { reject(new Error(message)); return; }
          setImages((old) => [...old, { name: "实际视频管线", url }]);
          resolve();
        };
        flushSync(() => probeRoot!.render(<LiveProbe portrait={portrait} done={done} />));
      });
      const runtimeErrors = errors.filter((message) => message !== "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
      assert(runtimeErrors.length === 0, runtimeErrors.join("\n"));
      log("完成：真实 WebGL、MediaPipe、帧同步检查通过；无着色器或运行时错误。");
      if (errors.length) log("MediaPipe 向 stderr 输出 XNNPACK 初始化 INFO，已单独识别为初始化信息。");
    } catch (error) {
      log(`FAIL: ${error instanceof Error ? error.stack : error}`);
    } finally {
      stageRoot?.unmount(); probeRoot?.unmount(); detector?.close?.(); trackingDetector?.close?.();
      if (scene) disposeModel(scene, true);
      renderer?.dispose(); console.error = originalError; setRunning(false);
    }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("autorun")) {
      void run();
    }
  }, []);
  return <main style={{ padding: 24, fontFamily: "system-ui", background: "#edf1f4", minHeight: "100vh" }}>
    <h1 style={{ fontSize: 26, fontWeight: 700 }}>AR WebGL 验证</h1>
    <p>公开测试人像与合成视频；不访问摄像头。结果不代表实物精度或手机性能。</p>
    <button onClick={run} disabled={running} style={{ background: "#173b41", color: "white", padding: "10px 20px", margin: "16px 0" }}>{running ? "验证运行中" : "运行浏览器检查"}</button>
    <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "white", padding: 16 }}>{rows.join("\n") || "等待运行"}</pre>
    <div ref={stageRef} style={{ position: "relative", width: 480, height: running ? 480 : 0, overflow: "hidden" }} />
    {/* Keep the probe visible while diagnosing the source video and its composite. */}
    <div ref={probeRef} style={{ position: "fixed", right: 16, bottom: 16, zIndex: 10 }} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
      {images.map(({ name, url }) => <figure key={name}><figcaption>{name}</figcaption><img src={url} alt={`${name} 合成截图`} style={{ width: "100%" }} /></figure>)}
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);

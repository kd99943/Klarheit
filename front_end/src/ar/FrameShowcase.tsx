import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ARFrameConfig } from "./types";
import { createProceduralGlasses, prepareModelForShadows } from "./glassesGeometry";
import { enhanceGlbMaterials } from "./enhanceGlbMaterials";
import { disposeModel, wrapFrameModel } from "./arRendering";

if (THREE.Cache) {
  THREE.Cache.enabled = true;
}

interface FrameShowcaseProps {
  frame: ARFrameConfig;
  className?: string;
  compact?: boolean;
  onModelLoad?: (result: { url: string; status: "loaded" | "error" }) => void;
}

interface StageController {
  readonly disposed: boolean;
  placeModel: (raw: THREE.Object3D, ownsTextures: boolean, targetFrame: ARFrameConfig) => void;
  markModelReadyPending: (url: string) => void;
  clearModelReadyPending: () => void;
}

function buildStudioBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#f8fafc");
    grad.addColorStop(0.58, "#f1f5f9");
    grad.addColorStop(1, "#e2e8f0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle architectural grid lines so lens/crystal IOR refraction is perceptible
    ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
    ctx.lineWidth = 1;
    for (let x = 32; x < canvas.width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 24; y < canvas.height; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Turntable product preview — no camera required. Loads GLB when available. */
export function FrameShowcase({ frame, className, compact = false, onModelLoad }: FrameShowcaseProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<StageController | null>(null);
  const onModelLoadRef = useRef(onModelLoad);
  onModelLoadRef.current = onModelLoad;

  // Mount-only WebGL stage setup so switching frames/finishes or toggling Compare A/B
  // swaps only the 3D model without recreating WebGL contexts or blanking the canvas.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let pendingReadyUrl: string | null = null;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.transmissionResolutionScale = 0.75;
    renderer.setClearColor(0xf1f5f9, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const backdropTex = buildStudioBackdropTexture();
    scene.background = backdropTex;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envRT = pmrem.fromScene(room, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.95;
    room.dispose();
    pmrem.dispose();

    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xfff6ea, 1.15);
    key.position.set(1.4, 2.0, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8f8, 0.45);
    fill.position.set(-1.8, 0.6, 1.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 1.2, -2);
    scene.add(rim);

    const showcase = new THREE.Group();
    showcase.rotation.x = 0.1;
    scene.add(showcase);

    let activeModel: THREE.Object3D | null = null;
    let activeOwnsTextures = false;
    let modelRadius = 0;
    const fitCamera = () => {
      if (modelRadius <= 0) return;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      // A sphere around the centered model stays in view throughout the turntable rotation.
      const distance = modelRadius / Math.sin(Math.min(verticalFov, horizontalFov) / 2);
      camera.position.set(0, 0, distance * 1.08);
      camera.lookAt(0, 0, 0);
    };

    const placeModel = (raw: THREE.Object3D, ownsTextures: boolean, targetFrame: ARFrameConfig) => {
      if (disposed) {
        disposeModel(raw, ownsTextures);
        return;
      }
      if (activeModel) {
        showcase.remove(activeModel);
        disposeModel(activeModel, activeOwnsTextures);
      }
      const wrapped = wrapFrameModel(raw, targetFrame);
      prepareModelForShadows(wrapped);
      activeModel = wrapped;
      activeOwnsTextures = ownsTextures;
      showcase.add(wrapped);

      const box = new THREE.Box3().setFromObject(wrapped);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      wrapped.position.sub(center);

      modelRadius = size.length() / 2;
      fitCamera();
    };

    stageRef.current = {
      get disposed() {
        return disposed;
      },
      placeModel,
      markModelReadyPending: (url: string) => {
        pendingReadyUrl = url;
      },
      clearModelReadyPending: () => {
        pendingReadyUrl = null;
      },
    };

    const resize = () => {
      // Keep minimum canvas dimensions >= 8px so Three.js transmission FBOs (scaled by 0.75)
      // never allocate a zero-size framebuffer attachment during layout transitions.
      const w = Math.max(host.clientWidth, 8);
      const h = Math.max(host.clientHeight, 8);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fitCamera();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let t = 0;
    let paused = false;
    let hasInteracted = false;
    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startYaw = 0;
    let startPitch = 0;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (activePointerId !== null) return;
      activePointerId = event.pointerId;
      hasInteracted = true;
      startX = event.clientX;
      startY = event.clientY;
      startYaw = showcase.rotation.y;
      startPitch = showcase.rotation.x;
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Ignore synthetic events in tests without an active browser pointer
      }
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      showcase.rotation.y = startYaw + (event.clientX - startX) * 0.008;
      showcase.rotation.x = startPitch + (event.clientY - startY) * 0.008;
    };
    const endDrag = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      try {
        if (renderer.domElement.hasPointerCapture?.(activePointerId)) {
          renderer.domElement.releasePointerCapture?.(activePointerId);
        }
      } catch {
        // Ignore if capture was already released
      }
      activePointerId = null;
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const tick = () => {
      if (!paused && !disposed) {
        if (activePointerId === null && !hasInteracted) {
          if (prefersReducedMotion) {
            showcase.rotation.y = 0.28;
          } else {
            t += 0.012;
            showcase.rotation.y = Math.sin(t) * 0.55;
          }
        }
        renderer.render(scene, camera);
        if (pendingReadyUrl) {
          const readyUrl = pendingReadyUrl;
          pendingReadyUrl = null;
          onModelLoadRef.current?.({ url: readyUrl, status: "loaded" });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      stageRef.current = null;
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("lostpointercapture", endDrag);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ro.disconnect();
      if (activeModel) disposeModel(activeModel, activeOwnsTextures);
      backdropTex.dispose();
      envRT?.dispose?.();
      renderer.dispose();
      (renderer as { forceContextLoss?: () => void }).forceContextLoss?.();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load or swap frame geometry inside the existing WebGL stage.
  // THREE.Cache.enabled caches fetched GLB buffers across toggles so A/B switching issues zero repeat HTTP requests.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || stage.disposed) return;

    let cancelled = false;
    stage.clearModelReadyPending();

    // Prefer high-fidelity GLB; fall back to procedural immediately, then swap
    const procedural = createProceduralGlasses(frame);
    stage.placeModel(procedural, false, frame);

    if (frame.modelUrl) {
      const targetUrl = frame.modelUrl;
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        targetUrl,
        (gltf) => {
          if (cancelled || stage.disposed) {
            disposeModel(gltf.scene, true);
            return;
          }
          enhanceGlbMaterials(gltf.scene, frame);
          stage.placeModel(gltf.scene, true, frame);
          stage.markModelReadyPending(targetUrl);
        },
        undefined,
        () => {
          if (!cancelled && !stage.disposed) {
            onModelLoadRef.current?.({ url: targetUrl, status: "error" });
          }
        }
      );
    }

    return () => {
      cancelled = true;
      stage.clearModelReadyPending();
    };
  }, [frame]);

  return (
    <div
      ref={hostRef}
      data-testid="frame-showcase"
      className={className ?? (compact ? "h-28 w-full" : "h-48 w-full")}
      aria-label={`3D preview ${frame.productName}`}
    />
  );
}

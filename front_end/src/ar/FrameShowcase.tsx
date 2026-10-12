import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ARFrameConfig } from "./types";
import { buildIndoorEnvTexture, createProceduralGlasses } from "./glassesGeometry";
import { enhanceGlbMaterials } from "./enhanceGlbMaterials";

interface FrameShowcaseProps {
  frame: ARFrameConfig;
  className?: string;
  compact?: boolean;
}

function stripOccluders(root: THREE.Object3D) {
  const helpers: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material;
      if (mat instanceof THREE.MeshBasicMaterial || mat instanceof THREE.ShadowMaterial) {
        helpers.push(child);
      }
    }
  });
  helpers.forEach((h) => h.parent?.remove(h));
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose?.();
      const mat = obj.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    }
  });
}

/** Turntable product preview — no camera required. Loads GLB when available. */
export function FrameShowcase({ frame, className, compact = false }: FrameShowcaseProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = buildIndoorEnvTexture();
    const envRT = pmrem.fromEquirectangular(envTex);
    scene.environment = envRT.texture;
    envTex.dispose();
    pmrem.dispose();

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xfff6ea, 1.4);
    key.position.set(1.4, 2.0, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdce8f8, 0.75);
    fill.position.set(-1.8, 0.6, 1.4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(0, 1.2, -2);
    scene.add(rim);

    const showcase = new THREE.Group();
    scene.add(showcase);

    let activeModel: THREE.Object3D | null = null;

    const placeModel = (raw: THREE.Object3D) => {
      if (disposed) {
        disposeObject(raw);
        return;
      }
      if (activeModel) {
        showcase.remove(activeModel);
        disposeObject(activeModel);
      }
      stripOccluders(raw);
      activeModel = raw;
      showcase.add(raw);

      const box = new THREE.Box3().setFromObject(raw);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      raw.position.sub(center);

      const maxDim = Math.max(size.x * 0.95, size.y);
      const fitDistance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
      camera.position.set(0, size.y * 0.08, fitDistance * 0.92);
      camera.lookAt(0, 0, 0);
    };

    // Prefer high-fidelity GLB; fall back to procedural immediately, then swap
    const procedural = createProceduralGlasses(frame);
    placeModel(procedural);

    if (frame.modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        frame.modelUrl,
        (gltf) => {
          if (disposed) {
            disposeObject(gltf.scene);
            return;
          }
          enhanceGlbMaterials(gltf.scene);
          placeModel(gltf.scene);
        },
        undefined,
        () => {
          // keep procedural
        }
      );
    }

    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let t = 0;
    let paused = false;
    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const tick = () => {
      if (!paused && !disposed) {
        t += 0.012;
        showcase.rotation.y = Math.sin(t) * 0.55;
        showcase.rotation.x = 0.1;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ro.disconnect();
      if (activeModel) disposeObject(activeModel);
      envRT?.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
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

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { ARFrameConfig, ARTransform } from "./types";

interface ARTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ARFrameConfig;
  transform: ARTransform | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
}

function createProceduralGlasses(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: frame.frameColor, roughness: 0.36, metalness: 0.72 });
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: frame.lensColor,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    transmission: 0.35,
  });

  const rimGeometry = new THREE.TorusGeometry(0.22, 0.018, 16, 48);
  const leftRim = new THREE.Mesh(rimGeometry, material);
  leftRim.position.x = -0.24;
  const rightRim = new THREE.Mesh(rimGeometry, material);
  rightRim.position.x = 0.24;

  const lensGeometry = new THREE.CircleGeometry(0.19, 48);
  const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
  leftLens.position.set(-0.24, 0, -0.01);
  const rightLens = new THREE.Mesh(lensGeometry, lensMaterial);
  rightLens.position.set(0.24, 0, -0.01);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.028), material);
  const leftTemple = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.022, 0.022), material);
  leftTemple.position.set(-0.5, 0.02, -0.06);
  leftTemple.rotation.y = -0.55;
  const rightTemple = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.022, 0.022), material);
  rightTemple.position.set(0.5, 0.02, -0.06);
  rightTemple.rotation.y = 0.55;

  group.add(leftRim, rightRim, leftLens, rightLens, bridge, leftTemple, rightTemple);
  return group;
}

export function ARTryOnCanvas({ stream, frame, transform, onCaptureReady }: ARTryOnCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glassesRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 2.8;
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(0, 1, 2);
    scene.add(keyLight);

    const glasses = createProceduralGlasses(frame);
    glassesRef.current = glasses;
    scene.add(glasses);

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(bounds.width, bounds.height, false);
      camera.aspect = bounds.width / Math.max(bounds.height, 1);
      camera.updateProjectionMatrix();
    };

    let frameId = 0;
    const renderFrame = () => {
      resize();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    onCaptureReady(() => canvas.toDataURL("image/png"));
    renderFrame();

    return () => {
      window.cancelAnimationFrame(frameId);
      onCaptureReady(null);
      scene.remove(glasses);
      glasses.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [frame, onCaptureReady]);

  useEffect(() => {
    const glasses = glassesRef.current;
    if (!glasses || !transform) {
      return;
    }

    const offset = frame.transformOffset;
    glasses.position.set(
      transform.position[0] + offset.position[0],
      transform.position[1] + offset.position[1],
      transform.position[2] + offset.position[2]
    );
    glasses.rotation.set(
      transform.rotation[0] + offset.rotation[0],
      transform.rotation[1] + offset.rotation[1],
      transform.rotation[2] + offset.rotation[2]
    );
    glasses.scale.setScalar(transform.scale[0] * offset.scale);
  }, [frame.transformOffset, transform]);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-[#050B16]">
      <video
        ref={videoRef}
        data-testid="ar-video-layer"
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        autoPlay
        muted
        playsInline
      />
      <canvas ref={canvasRef} data-testid="ar-canvas-layer" className="absolute inset-0 h-full w-full scale-x-[-1]" />
    </div>
  );
}

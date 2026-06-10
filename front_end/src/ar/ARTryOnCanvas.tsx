import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ARFrameConfig, ARTransform } from "./types";

interface ARTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ARFrameConfig;
  transform: ARTransform | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
  showOverlay?: boolean;
}

function createProceduralGlasses(frame: ARFrameConfig) {
  const group = new THREE.Group();
  
  // Premium frame material with metallic luster
  const material = new THREE.MeshPhysicalMaterial({ 
    color: frame.frameColor, 
    roughness: 0.15, 
    metalness: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });

  // Advanced physical lens material with refractive characteristics
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: frame.lensColor,
    transparent: true,
    opacity: 0.18,
    roughness: 0.02,
    metalness: 0.05,
    ior: 1.74,             // High index refractive glass
    transmission: 0.99,    // Maximum light transmission
    clearcoat: 1.0,        // High-end glossy reflections
    clearcoatRoughness: 0.0,
    reflectivity: 0.9,
    thickness: 0.3         // Physical glass thickness
  });

  const rimGeometry = new THREE.TorusGeometry(0.22, 0.016, 32, 64);
  const leftRim = new THREE.Mesh(rimGeometry, material);
  leftRim.position.x = -0.24;
  const rightRim = new THREE.Mesh(rimGeometry, material);
  rightRim.position.x = 0.24;

  const lensGeometry = new THREE.CircleGeometry(0.20, 64);
  const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
  leftLens.position.set(-0.24, 0, -0.005);
  const rightLens = new THREE.Mesh(lensGeometry, lensMaterial);
  rightLens.position.set(0.24, 0, -0.005);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.024, 0.024), material);
  bridge.position.set(0, 0.02, 0);

  // Curved temples wrapping cleanly around ears
  const templeGeo = new THREE.BoxGeometry(0.4, 0.016, 0.016);
  
  const leftTemple = new THREE.Mesh(templeGeo, material);
  leftTemple.position.set(-0.43, 0.01, -0.19);
  leftTemple.rotation.y = -0.25;
  
  const rightTemple = new THREE.Mesh(templeGeo, material);
  rightTemple.position.set(0.43, 0.01, -0.19);
  rightTemple.rotation.y = 0.25;

  // Invisible face depth occluder sphere so temples wrap cleanly behind ears/cheeks
  const occluderGeo = new THREE.SphereGeometry(0.45, 64, 64);
  const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false }); // depth mask only
  const faceOccluder = new THREE.Mesh(occluderGeo, occluderMat);
  faceOccluder.position.set(0, -0.1, -0.45); // offset behind nose bridge

  group.add(leftRim, rightRim, leftLens, rightLens, bridge, leftTemple, rightTemple, faceOccluder);
  return group;
}

export function ARTryOnCanvas({ stream, frame, transform, onCaptureReady, showOverlay = true }: ARTryOnCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glassesGroupRef = useRef<THREE.Group | null>(null);
  
  // Interpolation targets for EMA smoothing
  const targetPos = useRef<THREE.Vector3>(new THREE.Vector3());
  const targetQuat = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const targetScale = useRef<THREE.Vector3>(new THREE.Vector3(1, 1, 1));
  const hasTransform = useRef<boolean>(false);

  useEffect(() => {
    if (glassesGroupRef.current) {
      glassesGroupRef.current.visible = showOverlay;
    }
  }, [showOverlay]);

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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 2.8;

    // Advanced Studio Lighting for Luxury Aesthetics
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.9);
    rimLight.position.set(0, 3, -4);
    scene.add(rimLight);

    // Container group to hold either procedural or 3D GLTF model
    const glassesGroup = new THREE.Group();
    glassesGroup.visible = showOverlay;
    scene.add(glassesGroup);
    glassesGroupRef.current = glassesGroup;

    let activeModel = createProceduralGlasses(frame);
    glassesGroup.add(activeModel);

    // GLTFLoader infrastructure exposed for modular models
    const gltfLoader = new GLTFLoader();
    let isDisposed = false;

    if (frame.modelUrl) {
      console.info("Loading high-fidelity WebAR 3D model from:", frame.modelUrl);
      gltfLoader.load(
        frame.modelUrl,
        (gltf) => {
          if (isDisposed) {
            gltf.scene.traverse((obj) => {
              if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
                else obj.material.dispose();
              }
            });
            return;
          }
          // Remove procedural glasses and switch to GLTF
          glassesGroup.remove(activeModel);
          activeModel.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
              else object.material.dispose();
            }
          });
          activeModel = gltf.scene;
          glassesGroup.add(activeModel);
          console.info("WebAR 3D model successfully loaded and rendered.");
        },
        undefined,
        (error) => {
          console.error("Failed to load custom WebAR 3D model. Falling back to high-fidelity procedural glass renderer.", error);
        }
      );
    }

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

      // Exponential Moving Average (EMA) tracking smoother inside render loop
      if (hasTransform.current) {
        glassesGroup.position.lerp(targetPos.current, 0.28);
        glassesGroup.quaternion.slerp(targetQuat.current, 0.28);
        glassesGroup.scale.lerp(targetScale.current, 0.28);
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(renderFrame);
    };

    onCaptureReady(() => canvas.toDataURL("image/png"));
    renderFrame();

    return () => {
      window.cancelAnimationFrame(frameId);
      onCaptureReady(null);
      isDisposed = true;
      glassesGroupRef.current = null;
      scene.remove(glassesGroup);
      activeModel.traverse((object) => {
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

  // Update target tracking inputs when face orientation is updated
  useEffect(() => {
    if (!transform) {
      hasTransform.current = false;
      return;
    }

    const offset = frame.transformOffset;
    targetPos.current.set(
      transform.position[0] + offset.position[0],
      transform.position[1] + offset.position[1],
      transform.position[2] + offset.position[2]
    );

    const euler = new THREE.Euler(
      transform.rotation[0] + offset.rotation[0],
      transform.rotation[1] + offset.rotation[1],
      transform.rotation[2] + offset.rotation[2],
      "XYZ"
    );
    targetQuat.current.setFromEuler(euler);
    targetScale.current.setScalar(transform.scale[0] * offset.scale);
    
    hasTransform.current = true;
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

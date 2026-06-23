import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ARFrameConfig, ARTransform, FaceLandmark } from "./types";

interface ARTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ARFrameConfig;
  transform: ARTransform | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
  showOverlay?: boolean;
}

function drawRoundedRect(path: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

function drawSilhouetteOctagon(path: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  const c = h * 0.28;
  path.moveTo(x + c, y);
  path.lineTo(x + w - c, y);
  path.lineTo(x + w, y + c);
  path.lineTo(x + w, y + h - c);
  path.lineTo(x + w - c, y + h);
  path.lineTo(x + c, y + h);
  path.lineTo(x, y + h - c);
  path.lineTo(x, y + c);
  path.closePath();
}

interface ARTransform3D {
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  scale: [number, number, number];
}

function calculateGlassesTransform3D(
  landmarks: any[],
  aspect: number,
  fov: number,
  cameraZ: number
): ARTransform3D | null {
  const LEFT_EYE_OUTER = 33;
  const RIGHT_EYE_OUTER = 263;
  const NOSE_BRIDGE = 168;
  const NOSE_TIP = 1;

  const lmLeft = landmarks[LEFT_EYE_OUTER];
  const lmRight = landmarks[RIGHT_EYE_OUTER];
  const lmBridge = landmarks[NOSE_BRIDGE];
  const lmNose = landmarks[NOSE_TIP];

  if (!lmLeft || !lmRight || !lmBridge || !lmNose) {
    return null;
  }

  const eyeDistScreen = Math.hypot(lmRight.x - lmLeft.x, lmRight.y - lmLeft.y);
  if (eyeDistScreen < 0.02) {
    return null;
  }

  const D = Math.max(0.7, Math.min(3.0, 0.165 / eyeDistScreen));
  const Z_face = cameraZ - D;

  const frustumHeight = 2 * Math.tan((fov / 2) * Math.PI / 180) * D;
  const frustumWidth = frustumHeight * aspect;
  const scaleZ = frustumWidth;

  const L = new THREE.Vector3((lmLeft.x - 0.5) * frustumWidth, (0.5 - lmLeft.y) * frustumHeight, Z_face - (lmLeft.z || 0) * scaleZ);
  const R = new THREE.Vector3((lmRight.x - 0.5) * frustumWidth, (0.5 - lmRight.y) * frustumHeight, Z_face - (lmRight.z || 0) * scaleZ);
  const B = new THREE.Vector3((lmBridge.x - 0.5) * frustumWidth, (0.5 - lmBridge.y) * frustumHeight, Z_face - (lmBridge.z || 0) * scaleZ);
  const N = new THREE.Vector3((lmNose.x - 0.5) * frustumWidth, (0.5 - lmNose.y) * frustumHeight, Z_face - (lmNose.z || 0) * scaleZ);

  const dirX = R.clone().sub(L).normalize();
  const dirY_temp = B.clone().sub(N).normalize();
  const dirZ = dirX.clone().cross(dirY_temp).normalize();
  const dirY = dirZ.clone().cross(dirX).normalize();

  const rotMatrix = new THREE.Matrix4();
  rotMatrix.makeBasis(dirX, dirY, dirZ);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

  const eyeDistWorld = L.distanceTo(R);
  const scaleVal = eyeDistWorld / 0.48;

  return {
    position: [B.x, B.y, B.z],
    quaternion,
    scale: [scaleVal, scaleVal, scaleVal]
  };
}

function createProceduralGlasses(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const style = frame.styleName || "aviator";

  // 1. Resolve Frame Material based on styleName with dynamic envMap reflections
  let material: THREE.MeshPhysicalMaterial;
  if (style === "crystal-acetate") {
    material = new THREE.MeshPhysicalMaterial({ 
      color: frame.frameColor, 
      roughness: 0.01, 
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      transparent: true,
      opacity: 0.35,
      transmission: 0.98,
      thickness: 0.04,
      ior: 1.49,
      envMapIntensity: 2.0
    });
  } else if (style === "bold-acetate") {
    material = new THREE.MeshPhysicalMaterial({ 
      color: frame.frameColor, 
      roughness: 0.05, 
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.0
    });
  } else if (style === "round-wire") {
    // 18K Gold plated finish for rimless details
    material = new THREE.MeshPhysicalMaterial({ 
      color: frame.frameColor, 
      roughness: 0.12, 
      metalness: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.2
    });
  } else {
    // aviator (AERO X1) Grade 5 Titanium finish
    material = new THREE.MeshPhysicalMaterial({ 
      color: frame.frameColor, 
      roughness: 0.15, 
      metalness: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.2
    });
  }

  // 2. Resolve Lens Material with anti-reflective coating sheen
  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: frame.lensColor,
    transparent: true,
    opacity: style === "bold-acetate" ? 0.20 : 0.10,
    roughness: 0.0,
    metalness: 0.0,
    ior: 1.56,
    transmission: 0.95,
    clearcoat: 1.0,
    reflectivity: 0.8,
    sheen: 1.0,
    sheenColor: new THREE.Color("#06b6d4"), // Premium cyan anti-reflective multi-coating reflection
    sheenRoughness: 0.15,
    envMapIntensity: 2.0
  });

  // Common silicone nose pad material
  const nosePadMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    roughness: 0.2,
    metalness: 0.1,
    transmission: 0.7,
    envMapIntensity: 1.5
  });

  // Common Gold Core Wire Material
  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd4af37, // gold
    roughness: 0.1,
    metalness: 1.0,
    envMapIntensity: 2.0
  });

  // 3. Build Geometries and Meshes based on styleName
  if (style === "bold-acetate" || style === "crystal-acetate") {
    const isCrystal = style === "crystal-acetate";
    
    // Rims: Outer rounded rect, inner rounded rect hole
    const outerShape = new THREE.Shape();
    if (isCrystal) {
      drawRoundedRect(outerShape, 0.22, 0.17, 0.045);
    } else {
      drawRoundedRect(outerShape, 0.24, 0.18, 0.030);
    }

    const innerHole = new THREE.Path();
    if (isCrystal) {
      drawRoundedRect(innerHole, 0.17, 0.12, 0.025);
    } else {
      drawRoundedRect(innerHole, 0.18, 0.12, 0.015);
    }
    outerShape.holes.push(innerHole);

    const extrudeSettings = {
      depth: isCrystal ? 0.022 : 0.024,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.003
    };

    const rimGeom = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
    
    const leftRim = new THREE.Mesh(rimGeom, material);
    leftRim.position.set(-0.24, 0, 0);
    const rightRim = new THREE.Mesh(rimGeom, material);
    rightRim.position.set(0.24, 0, 0);

    // Lenses (extruded with bevel settings for realistic glass edges)
    const lensShape = new THREE.Shape();
    if (isCrystal) {
      drawRoundedRect(lensShape, 0.172, 0.122, 0.025);
    } else {
      drawRoundedRect(lensShape, 0.182, 0.122, 0.015);
    }
    const lensGeom = new THREE.ExtrudeGeometry(lensShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.001,
      bevelThickness: 0.001
    });

    const leftLens = new THREE.Mesh(lensGeom, lensMaterial);
    leftLens.position.set(-0.24, 0, isCrystal ? 0.008 : 0.01);
    const rightLens = new THREE.Mesh(lensGeom, lensMaterial);
    rightLens.position.set(0.24, 0, isCrystal ? 0.008 : 0.01);

    // Premium keyhole bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, isCrystal ? 0.022 : 0.024), material);
    bridge.position.set(0, 0.01, isCrystal ? 0.008 : 0.010);

    // Temples (Acetate Blocks: Extruded rounded rectangles for curved highlight capture)
    const templeLength = 0.45;
    const templeW = isCrystal ? 0.012 : 0.016;
    const templeH = isCrystal ? 0.020 : 0.024;
    
    const templeCrossSection = new THREE.Shape();
    drawRoundedRect(templeCrossSection, templeW, templeH, 0.004);
    const templeGeom = new THREE.ExtrudeGeometry(templeCrossSection, {
      depth: templeLength,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.001,
      bevelThickness: 0.001
    });
    // Center geometry so it rotates and positions from hinges cleanly
    templeGeom.translate(0, 0, -templeLength / 2);

    const leftTemple = new THREE.Mesh(templeGeom, material);
    leftTemple.position.set(-0.355, 0.01, -templeLength / 2);
    leftTemple.rotation.set(0, -0.08, 0);

    const rightTemple = new THREE.Mesh(templeGeom, material);
    rightTemple.position.set(0.355, 0.01, -templeLength / 2);
    rightTemple.rotation.set(0, 0.08, 0);

    // Add gold stud accents for Monolith 02 (bold-acetate)
    if (style === "bold-acetate") {
      const studGeom = new THREE.CylinderGeometry(0.003, 0.003, 0.003, 16);
      studGeom.rotateX(Math.PI / 2);

      const leftStud1 = new THREE.Mesh(studGeom, goldMaterial);
      leftStud1.position.set(-0.33, 0.05, 0.025);
      const leftStud2 = new THREE.Mesh(studGeom, goldMaterial);
      leftStud2.position.set(-0.31, 0.05, 0.025);

      const rightStud1 = new THREE.Mesh(studGeom, goldMaterial);
      rightStud1.position.set(0.33, 0.05, 0.025);
      const rightStud2 = new THREE.Mesh(studGeom, goldMaterial);
      rightStud2.position.set(0.31, 0.05, 0.025);

      group.add(leftStud1, leftStud2, rightStud1, rightStud2);
    }

    // Add golden core wire inside Lucent V1 (crystal-acetate) temples
    if (isCrystal) {
      const coreGeom = new THREE.CylinderGeometry(0.002, 0.002, templeLength - 0.02, 16);
      coreGeom.rotateX(Math.PI / 2);

      const leftCore = new THREE.Mesh(coreGeom, goldMaterial);
      leftCore.position.set(0, 0, 0);
      leftTemple.add(leftCore);

      const rightCore = new THREE.Mesh(coreGeom, goldMaterial);
      rightCore.position.set(0, 0, 0);
      rightTemple.add(rightCore);
    }

    // Nose pads (acetate molded extension)
    const padGeom = new THREE.BoxGeometry(0.015, 0.03, 0.015);
    const leftPad = new THREE.Mesh(padGeom, material);
    leftPad.position.set(-0.15, -0.04, 0.005);
    leftPad.rotation.z = -0.3;

    const rightPad = new THREE.Mesh(padGeom, material);
    rightPad.position.set(0.15, -0.04, 0.005);
    rightPad.rotation.z = 0.3;

    group.add(leftRim, rightRim, leftLens, rightLens, bridge, leftTemple, rightTemple, leftPad, rightPad);

  } else if (style === "round-wire") {
    // === Round Wire Style (Orbit T-4 Luxury Rimless Gold) ===
    // 100% Rimless design matching Silhouette "The Refined"
    // Lenses are octagonal shapes connected directly by thin gold bridge and temples
    
    // 1. Octagonal lenses
    const lensShape = new THREE.Shape();
    drawSilhouetteOctagon(lensShape, 0.22, 0.17, 0.02);
    const lensGeom = new THREE.ExtrudeGeometry(lensShape, {
      depth: 0.010,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.001,
      bevelThickness: 0.001
    });

    const leftLens = new THREE.Mesh(lensGeom, lensMaterial);
    leftLens.position.set(-0.24, 0, 0);
    const rightLens = new THREE.Mesh(lensGeom, lensMaterial);
    rightLens.position.set(0.24, 0, 0);

    // 2. Gold clamping brackets directly on the glass edges (essential rimless detail)
    const outerBracketGeom = new THREE.BoxGeometry(0.014, 0.012, 0.014);
    outerBracketGeom.translate(0, 0, 0.005);
    const leftOuterBracket = new THREE.Mesh(outerBracketGeom, material);
    leftOuterBracket.position.set(-0.34, 0.01, 0.0);
    const rightOuterBracket = new THREE.Mesh(outerBracketGeom, material);
    rightOuterBracket.position.set(0.34, 0.01, 0.0);

    const innerBracketGeom = new THREE.BoxGeometry(0.012, 0.010, 0.012);
    innerBracketGeom.translate(0, 0, 0.005);
    const leftInnerBracket = new THREE.Mesh(innerBracketGeom, material);
    leftInnerBracket.position.set(-0.14, 0.01, 0.0);
    const rightInnerBracket = new THREE.Mesh(innerBracketGeom, material);
    rightInnerBracket.position.set(0.14, 0.01, 0.0);

    // 3. Delicate arched bridge connecting inner brackets
    const bridgeGeom = new THREE.CylinderGeometry(0.0025, 0.0025, 0.28, 24);
    const bridge = new THREE.Mesh(bridgeGeom, material);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.01, 0.006);

    // 4. Nose pad wire loops and pads
    const connectorGeom = new THREE.CylinderGeometry(0.0016, 0.0016, 0.04, 16);
    
    const leftConnector = new THREE.Mesh(connectorGeom, material);
    leftConnector.rotation.set(0.2, 0, -0.4);
    leftConnector.position.set(-0.08, -0.045, -0.015);

    const rightConnector = new THREE.Mesh(connectorGeom, material);
    rightConnector.rotation.set(0.2, 0, 0.4);
    rightConnector.position.set(0.08, -0.045, -0.015);

    const padGeom = new THREE.SphereGeometry(0.014, 16, 16);

    const leftPad = new THREE.Mesh(padGeom, nosePadMaterial);
    leftPad.scale.set(0.4, 1.0, 0.3);
    leftPad.position.set(-0.086, -0.06, -0.024);

    const rightPad = new THREE.Mesh(padGeom, nosePadMaterial);
    rightPad.scale.set(0.4, 1.0, 0.3);
    rightPad.position.set(0.086, -0.06, -0.024);

    // 5. Ultra-thin gold temples
    const templeLength = 0.45;
    const templeGeom = new THREE.CylinderGeometry(0.0028, 0.0028, templeLength, 24);
    templeGeom.translate(0, 0, -templeLength / 2);

    const leftTemple = new THREE.Mesh(templeGeom, material);
    leftTemple.rotation.set(0, -0.08, 0);
    leftTemple.position.set(-0.34, 0.01, 0.0);

    const rightTemple = new THREE.Mesh(templeGeom, material);
    rightTemple.rotation.set(0, 0.08, 0);
    rightTemple.position.set(0.34, 0.01, 0.0);

    group.add(
      leftLens, rightLens,
      leftOuterBracket, rightOuterBracket,
      leftInnerBracket, rightInnerBracket,
      bridge,
      leftConnector, rightConnector, leftPad, rightPad,
      leftTemple, rightTemple
    );

  } else {
    // === Aviator Style (Aero X1 Thin Titanium Wire) ===
    // Beautiful, ultra-delicate double-bridge aviator wire rims
    const outerShape = new THREE.Shape();
    outerShape.absellipse(0, 0, 0.115, 0.095, 0, Math.PI * 2);

    const innerHole = new THREE.Path();
    innerHole.absellipse(0, 0, 0.108, 0.088, 0, Math.PI * 2, true); // Extremely thin wire
    outerShape.holes.push(innerHole);

    const extrudeSettings = {
      depth: 0.008,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.001,
      bevelThickness: 0.001
    };

    const rimGeom = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);

    const leftRim = new THREE.Mesh(rimGeom, material);
    leftRim.position.set(-0.24, 0, 0);
    const rightRim = new THREE.Mesh(rimGeom, material);
    rightRim.position.set(0.24, 0, 0);

    // Lenses (extruded for depth refraction)
    const lensShape = new THREE.Shape();
    lensShape.absellipse(0, 0, 0.109, 0.089, 0, Math.PI * 2);
    const lensGeom = new THREE.ExtrudeGeometry(lensShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.001,
      bevelThickness: 0.001
    });

    const leftLens = new THREE.Mesh(lensGeom, lensMaterial);
    leftLens.position.set(-0.24, 0, 0.003);
    const rightLens = new THREE.Mesh(lensGeom, lensMaterial);
    rightLens.position.set(0.24, 0, 0.003);

    // Double bridge: top bridge and bottom bridge (24 segments for perfect roundness)
    const topBridgeGeom = new THREE.CylinderGeometry(0.0025, 0.0025, 0.15, 24);
    const topBridge = new THREE.Mesh(topBridgeGeom, material);
    topBridge.rotation.z = Math.PI / 2;
    topBridge.position.set(0, 0.065, 0.003);

    const bottomBridgeGeom = new THREE.CylinderGeometry(0.0025, 0.0025, 0.15, 24);
    const bottomBridge = new THREE.Mesh(bottomBridgeGeom, material);
    bottomBridge.rotation.z = Math.PI / 2;
    bottomBridge.position.set(0, 0.015, 0.003);

    // Nose pads
    const connectorGeom = new THREE.CylinderGeometry(0.0016, 0.0016, 0.035, 16);
    const leftConnector = new THREE.Mesh(connectorGeom, material);
    leftConnector.rotation.set(0.2, 0, -0.4);
    leftConnector.position.set(-0.075, -0.045, -0.015);

    const rightConnector = new THREE.Mesh(connectorGeom, material);
    rightConnector.rotation.set(0.2, 0, 0.4);
    rightConnector.position.set(0.075, -0.045, -0.015);

    const padGeom = new THREE.SphereGeometry(0.014, 16, 16);

    const leftPad = new THREE.Mesh(padGeom, nosePadMaterial);
    leftPad.scale.set(0.4, 1.0, 0.3);
    leftPad.position.set(-0.082, -0.055, -0.024);

    const rightPad = new THREE.Mesh(padGeom, nosePadMaterial);
    rightPad.scale.set(0.4, 1.0, 0.3);
    rightPad.position.set(0.082, -0.055, -0.024);

    // Temples (24 segments)
    const templeLength = 0.45;
    const templeGeom = new THREE.CylinderGeometry(0.003, 0.003, templeLength, 24);
    templeGeom.translate(0, 0, -templeLength / 2);

    const leftTemple = new THREE.Mesh(templeGeom, material);
    leftTemple.rotation.set(Math.PI / 2, -0.08, 0);
    leftTemple.position.set(-0.355, 0.01, -templeLength / 2);

    const rightTemple = new THREE.Mesh(templeGeom, material);
    rightTemple.rotation.set(Math.PI / 2, 0.08, 0);
    rightTemple.position.set(0.355, 0.01, -templeLength / 2);

    group.add(
      leftRim, rightRim, leftLens, rightLens,
      topBridge, bottomBridge,
      leftConnector, rightConnector, leftPad, rightPad,
      leftTemple, rightTemple
    );
  }

  // 4. Add common depth occluder (so temples wrap around ears cleanly)
  const occluderGeo = new THREE.SphereGeometry(0.44, 32, 32);
  
  const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const faceOccluder = new THREE.Mesh(occluderGeo, occluderMat);
  faceOccluder.scale.set(1.0, 1.25, 0.9); // Approximate human head shape
  faceOccluder.position.set(0, -0.08, -0.42);
  group.add(faceOccluder);

  // 5. Add invisible face shadow receiver to catch soft shadows on the face
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.22 }); // Softened opacity
  const shadowReceiver = new THREE.Mesh(occluderGeo, shadowMat);
  shadowReceiver.scale.set(1.0, 1.25, 0.9);
  shadowReceiver.position.set(0, -0.08, -0.42);
  shadowReceiver.receiveShadow = true;
  group.add(shadowReceiver);

  // 6. Set shadow properties on all meshes in the group
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material !== shadowMat && child.material !== occluderMat) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    }
  });

  return group
}

interface ARTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ARFrameConfig;
  transform: ARTransform | null;
  landmarks?: FaceLandmark[] | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
  showOverlay?: boolean;
}

export function ARTryOnCanvas({ stream, frame, transform, landmarks, onCaptureReady, showOverlay = true }: ARTryOnCanvasProps) {
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 2.8;

    // Generate a simple procedural studio environment map for photorealistic reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const canvasEnv = document.createElement("canvas");
    canvasEnv.width = 1024;
    canvasEnv.height = 512;
    const ctxEnv = canvasEnv.getContext("2d");
    if (ctxEnv) {
      // 1. Dark elegant studio background gradient
      const grad = ctxEnv.createLinearGradient(0, 0, 0, canvasEnv.height);
      grad.addColorStop(0, "#0d1527");
      grad.addColorStop(0.3, "#050814");
      grad.addColorStop(0.5, "#010205");
      grad.addColorStop(0.7, "#050814");
      grad.addColorStop(1, "#000000");
      ctxEnv.fillStyle = grad;
      ctxEnv.fillRect(0, 0, canvasEnv.width, canvasEnv.height);

      // Helper to draw soft, diffused spotlights
      const drawSoftbox = (x: number, y: number, w: number, h: number, color: string) => {
        const radGrad = ctxEnv.createRadialGradient(
          x + w / 2, y + h / 2, 0,
          x + w / 2, y + h / 2, Math.max(w, h) / 2
        );
        radGrad.addColorStop(0, color);
        radGrad.addColorStop(0.3, color);
        radGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctxEnv.fillStyle = radGrad;
        ctxEnv.fillRect(x, y, w, h);
      };

      // 2. Large overhead softbox (simulating studio ceiling light panel)
      drawSoftbox(256, 0, 512, 100, "rgba(255, 255, 255, 0.95)");

      // 3. Left vertical strip softbox (side fill lighting)
      drawSoftbox(40, 100, 160, 320, "rgba(235, 243, 255, 0.9)");

      // 4. Right vertical strip softbox
      drawSoftbox(824, 100, 160, 320, "rgba(235, 243, 255, 0.9)");

      // 5. Warm accent lights (soft golden sheens for luxury metal)
      drawSoftbox(280, 120, 140, 200, "rgba(254, 240, 138, 0.45)");
      drawSoftbox(604, 120, 140, 200, "rgba(254, 240, 138, 0.45)");
    }
    const envTexture = new THREE.CanvasTexture(canvasEnv);
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
    const envRT = pmremGenerator.fromEquirectangular(envTexture);
    scene.environment = envRT.texture;

    envTexture.dispose();
    pmremGenerator.dispose();

    // Advanced Studio Lighting for Luxury Aesthetics
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    // Tight focus Directional Light casting high definition shadows onto the face
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(1.5, 3.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.radius = 4; // Enabling PCF soft shadow map filtering for feathered shadows
    
    // Concentrate shadow resolution tightly around the face area
    keyLight.shadow.camera.left = -0.4;
    keyLight.shadow.camera.right = 0.4;
    keyLight.shadow.camera.top = 0.4;
    keyLight.shadow.camera.bottom = -0.4;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 6.0;
    keyLight.shadow.camera.updateProjectionMatrix();
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.85);
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
                if (obj.material) {
                  if (Array.isArray(obj.material)) obj.material.forEach((m) => m?.dispose());
                  else obj.material.dispose();
                }
              }
            });
            return;
          }
          // Remove procedural glasses and switch to GLTF
          glassesGroup.remove(activeModel);
          activeModel.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              if (object.material) {
                if (Array.isArray(object.material)) object.material.forEach((m) => m?.dispose());
                else object.material.dispose();
              }
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
          if (material) {
            if (Array.isArray(material)) {
              material.forEach((item) => item?.dispose());
            } else {
              material.dispose();
            }
          }
        }
      });
      renderer.dispose();
    };
  }, [frame, onCaptureReady]);

  // Update target tracking inputs when face orientation is updated
  useEffect(() => {
    // 1. If landmarks are available, calculate high-fidelity 3D basis alignment
    if (landmarks && landmarks.length > 0) {
      const bounds = rootRef.current?.getBoundingClientRect();
      const aspect = bounds ? (bounds.width / Math.max(bounds.height, 1)) : 1.0;
      
      const transform3D = calculateGlassesTransform3D(landmarks, aspect, 35, 2.8);
      if (transform3D) {
        const offset = frame.transformOffset;
        
        // Translate local position offsets in the rotated face frame
        const localOffset = new THREE.Vector3(
          offset.position[0] * transform3D.scale[0],
          offset.position[1] * transform3D.scale[1],
          offset.position[2] * transform3D.scale[2]
        );
        localOffset.applyQuaternion(transform3D.quaternion);

        targetPos.current.set(
          transform3D.position[0] + localOffset.x,
          transform3D.position[1] + localOffset.y,
          transform3D.position[2] + localOffset.z
        );

        // Apply local rotation offsets to the face quaternion
        const localRot = new THREE.Euler(offset.rotation[0], offset.rotation[1], offset.rotation[2], "XYZ");
        const localQuat = new THREE.Quaternion().setFromEuler(localRot);
        
        targetQuat.current.copy(transform3D.quaternion).multiply(localQuat);
        
        targetScale.current.set(
          transform3D.scale[0] * offset.scale,
          transform3D.scale[1] * offset.scale,
          transform3D.scale[2] * offset.scale
        );
        hasTransform.current = true;
        return;
      }
    }

    // 2. Fallback to 2D heuristic transform if landmarks are not present
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
  }, [frame.transformOffset, transform, landmarks]);

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

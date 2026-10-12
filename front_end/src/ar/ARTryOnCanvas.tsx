import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ARFrameConfig, ARTransform, ARUserAdjust, FaceLandmark } from "./types";
import { buildIndoorEnvTexture, captureCompositeFrame, createProceduralGlasses } from "./glassesGeometry";
import { enhanceGlbMaterials } from "./enhanceGlbMaterials";

interface ARTryOnCanvasProps {
  stream: MediaStream | null;
  frame: ARFrameConfig;
  transform: ARTransform | null;
  landmarks?: FaceLandmark[] | null;
  /** High-frequency landmarks stream — preferred over `landmarks` for tracking. */
  landmarksRef?: { current: FaceLandmark[] | null };
  userAdjust?: ARUserAdjust;
  userPdMm?: number | null;
  onCaptureReady: (capture: (() => string | null) | null) => void;
  showOverlay?: boolean;
}

interface ARTransform3D {
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  scale: [number, number, number];
}

// ── Pooled temporaries for calculateGlassesTransform3D (avoid per-frame allocation) ──
const _pool = {
  L: new THREE.Vector3(),
  R: new THREE.Vector3(),
  B: new THREE.Vector3(),
  N: new THREE.Vector3(),
  dirX: new THREE.Vector3(),
  dirYTemp: new THREE.Vector3(),
  dirZ: new THREE.Vector3(),
  dirY: new THREE.Vector3(),
  rotMatrix: new THREE.Matrix4(),
  quat: new THREE.Quaternion(),
};

function midpoint(a: FaceLandmark, b: FaceLandmark): FaceLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
  };
}

function toViewportPoint(
  point: FaceLandmark,
  videoAspect: number,
  viewportAspect: number
): [number, number] {
  if (videoAspect > viewportAspect) {
    const visibleWidth = viewportAspect / videoAspect;
    return [(point.x - (1 - visibleWidth) / 2) / visibleWidth, point.y];
  }
  if (videoAspect < viewportAspect) {
    const visibleHeight = videoAspect / viewportAspect;
    return [point.x, (point.y - (1 - visibleHeight) / 2) / visibleHeight];
  }
  return [point.x, point.y];
}

function calculateGlassesTransform3D(
  landmarks: FaceLandmark[],
  aspect: number,
  videoAspect: number,
  lensCenterDistanceMm: number,
  userPdMm: number,
  fov: number,
  cameraZ: number
): ARTransform3D | null {
  const LEFT_EYE_OUTER = 33;
  const LEFT_EYE_INNER = 133;
  const RIGHT_EYE_OUTER = 263;
  const RIGHT_EYE_INNER = 362;
  const LEFT_IRIS = 468;
  const RIGHT_IRIS = 473;
  const NOSE_BRIDGE = 168;
  const NOSE_TIP = 1;

  const leftOuter = landmarks[LEFT_EYE_OUTER];
  const leftInner = landmarks[LEFT_EYE_INNER];
  const rightOuter = landmarks[RIGHT_EYE_OUTER];
  const rightInner = landmarks[RIGHT_EYE_INNER];
  const leftIris = landmarks[LEFT_IRIS];
  const rightIris = landmarks[RIGHT_IRIS];
  const lmLeft = leftIris && Number.isFinite(leftIris.x) && Number.isFinite(leftIris.y)
    ? leftIris
    : leftOuter && leftInner
      ? midpoint(leftOuter, leftInner)
      : leftOuter ?? null;
  const lmRight = rightIris && Number.isFinite(rightIris.x) && Number.isFinite(rightIris.y)
    ? rightIris
    : rightOuter && rightInner
      ? midpoint(rightOuter, rightInner)
      : rightOuter ?? null;
  const lmBridge = landmarks[NOSE_BRIDGE];
  const lmNose = landmarks[NOSE_TIP];

  if (!lmLeft || !lmRight || !lmBridge || !lmNose) {
    return null;
  }

  const [leftX, leftY] = toViewportPoint(lmLeft, videoAspect, aspect);
  const [rightX, rightY] = toViewportPoint(lmRight, videoAspect, aspect);
  const [bridgeX, bridgeY] = toViewportPoint(lmBridge, videoAspect, aspect);
  const [noseX, noseY] = toViewportPoint(lmNose, videoAspect, aspect);

  const eyeDistScreen = Math.hypot(rightX - leftX, rightY - leftY);
  if (eyeDistScreen < 0.02) {
    return null;
  }

  // Soft rejection of extreme distances — keeps scale in a believable range
  const D = Math.max(0.75, Math.min(2.6, 0.165 / eyeDistScreen));
  const Z_face = cameraZ - D;

  const frustumHeight = 2 * Math.tan((fov / 2) * Math.PI / 180) * D;
  const frustumWidth = frustumHeight * aspect;
  const scaleZ = frustumWidth;

  const { L, R, B, N, dirX, dirYTemp, dirZ, dirY, rotMatrix, quat } = _pool;

  L.set(
    (leftX - 0.5) * frustumWidth,
    (0.5 - leftY) * frustumHeight,
    Z_face - (lmLeft.z || 0) * scaleZ
  );
  R.set(
    (rightX - 0.5) * frustumWidth,
    (0.5 - rightY) * frustumHeight,
    Z_face - (lmRight.z || 0) * scaleZ
  );
  B.set(
    (bridgeX - 0.5) * frustumWidth,
    (0.5 - bridgeY) * frustumHeight,
    Z_face - (lmBridge.z || 0) * scaleZ
  );
  N.set(
    (noseX - 0.5) * frustumWidth,
    (0.5 - noseY) * frustumHeight,
    Z_face - (lmNose.z || 0) * scaleZ
  );

  dirX.copy(R).sub(L).normalize();
  dirYTemp.copy(B).sub(N).normalize();
  dirZ.copy(dirX).cross(dirYTemp).normalize();
  dirY.copy(dirZ).cross(dirX).normalize();

  rotMatrix.makeBasis(dirX, dirY, dirZ);
  quat.setFromRotationMatrix(rotMatrix);

  const eyeDistWorld = L.distanceTo(R);
  const scaleVal = eyeDistWorld * (lensCenterDistanceMm / (userPdMm * 0.48));

  return {
    position: [B.x, B.y, B.z],
    quaternion: quat.clone(),
    scale: [scaleVal, scaleVal, scaleVal],
  };
}

export function ARTryOnCanvas({
  stream,
  frame,
  transform,
  landmarks,
  landmarksRef,
  userAdjust,
  userPdMm,
  onCaptureReady,
  showOverlay = true,
}: ARTryOnCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glassesGroupRef = useRef<THREE.Group | null>(null);

  const targetPos = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const targetScale = useRef(new THREE.Vector3(1, 1, 1));
  const hasTransform = useRef(false);
  const adjustRef = useRef<ARUserAdjust>({ x: 0, y: 0, scale: 1 });
  const landmarksMirror = useRef<FaceLandmark[] | null>(null);
  const transformMirror = useRef<ARTransform | null>(null);

  const onCaptureReadyRef = useRef(onCaptureReady);
  useEffect(() => {
    onCaptureReadyRef.current = onCaptureReady;
  }, [onCaptureReady]);

  useEffect(() => {
    adjustRef.current = userAdjust ?? { x: 0, y: 0, scale: 1 };
  }, [userAdjust]);

  useEffect(() => {
    landmarksMirror.current = landmarks ?? null;
  }, [landmarks]);

  useEffect(() => {
    transformMirror.current = transform;
  }, [transform]);

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

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    camera.position.z = 2.8;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = buildIndoorEnvTexture();
    const envRT = pmremGenerator.fromEquirectangular(envTexture);
    scene.environment = envRT.texture;
    envTexture.dispose();
    pmremGenerator.dispose();

    // Studio portrait AR lighting — balance physical specular pop with natural webcam integration
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ef, 1.35);
    keyLight.position.set(1.5, 2.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.radius = 3;
    keyLight.shadow.camera.left = -0.5;
    keyLight.shadow.camera.right = 0.5;
    keyLight.shadow.camera.top = 0.5;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 6.0;
    keyLight.shadow.camera.updateProjectionMatrix();
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdcebf8, 0.65);
    fillLight.position.set(-2, 1.5, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
    rimLight.position.set(0, 2.5, -2);
    scene.add(rimLight);

    const glassesGroup = new THREE.Group();
    glassesGroup.visible = showOverlay;
    scene.add(glassesGroup);
    glassesGroupRef.current = glassesGroup;

    let activeModel = createProceduralGlasses(frame);
    glassesGroup.add(activeModel);

    const gltfLoader = new GLTFLoader();
    let isDisposed = false;

    if (frame.modelUrl) {
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
          enhanceGlbMaterials(activeModel);
          glassesGroup.add(activeModel);
        },
        undefined,
        () => {
          // Keep procedural model — silent fallback, already preferred path
        }
      );
    }

    let lastWidth = 0;
    let lastHeight = 0;
    const resize = () => {
      const bounds = root.getBoundingClientRect();
      const width = Math.max(1, Math.floor(bounds.width));
      const height = Math.max(1, Math.floor(bounds.height));
      if (width === lastWidth && height === lastHeight) {
        return;
      }
      lastWidth = width;
      lastHeight = height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    // ── Pooled temporaries for applyTracking (reused every frame) ──
    const _localOffset = new THREE.Vector3();
    const _localRot = new THREE.Euler();
    const _localQuat = new THREE.Quaternion();
    const _fallbackEuler = new THREE.Euler();

    const applyTracking = () => {
      const sourceLandmarks = landmarksRef?.current ?? landmarksMirror.current;
      if (sourceLandmarks && sourceLandmarks.length > 0) {
        const aspect = lastWidth / Math.max(lastHeight, 1);
        const video = videoRef.current;
        const videoAspect =
          video && video.videoWidth > 0 && video.videoHeight > 0
            ? video.videoWidth / video.videoHeight
            : aspect;
        const transform3D = calculateGlassesTransform3D(
          sourceLandmarks,
          aspect,
          videoAspect,
          frame.lensCenterDistanceMm ?? 71,
          userPdMm ?? 63,
          35,
          2.8
        );
        if (transform3D) {
          const offset = frame.transformOffset;
          const adjust = adjustRef.current;
          _localOffset.set(
            offset.position[0] * transform3D.scale[0],
            offset.position[1] * transform3D.scale[1],
            offset.position[2] * transform3D.scale[2]
          );
          _localOffset.applyQuaternion(transform3D.quaternion);

          targetPos.current.set(
            transform3D.position[0] + _localOffset.x + adjust.x * transform3D.scale[0],
            transform3D.position[1] + _localOffset.y + adjust.y * transform3D.scale[1],
            transform3D.position[2] + _localOffset.z
          );

          _localRot.set(
            offset.rotation[0],
            offset.rotation[1],
            offset.rotation[2],
            "XYZ"
          );
          _localQuat.setFromEuler(_localRot);
          targetQuat.current.copy(transform3D.quaternion).multiply(_localQuat);

          const userScale = offset.scale * adjust.scale;
          targetScale.current.set(
            transform3D.scale[0] * userScale,
            transform3D.scale[1] * userScale,
            transform3D.scale[2] * userScale
          );
          hasTransform.current = true;
          return;
        }
      }

      const fallback = transformMirror.current;
      if (!fallback) {
        hasTransform.current = false;
        return;
      }

      const offset = frame.transformOffset;
      const adjust = adjustRef.current;
      targetPos.current.set(
        fallback.position[0] + offset.position[0] + adjust.x,
        fallback.position[1] + offset.position[1] + adjust.y,
        fallback.position[2] + offset.position[2]
      );
      _fallbackEuler.set(
        fallback.rotation[0] + offset.rotation[0],
        fallback.rotation[1] + offset.rotation[1],
        fallback.rotation[2] + offset.rotation[2],
        "XYZ"
      );
      targetQuat.current.setFromEuler(_fallbackEuler);
      targetScale.current.setScalar(fallback.scale[0] * offset.scale * adjust.scale);
      hasTransform.current = true;
    };

    let frameId = 0;
    let paused = false;

    const onVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const renderFrame = () => {
      if (!paused) {
        resize();
        applyTracking();

        if (hasTransform.current && glassesGroupRef.current) {
          // EMA follow — 0.38 is snappy without jitter for 30fps landmarks
          glassesGroup.position.lerp(targetPos.current, 0.38);
          glassesGroup.quaternion.slerp(targetQuat.current, 0.38);
          glassesGroup.scale.lerp(targetScale.current, 0.38);
        }

        renderer.render(scene, camera);
      }
      frameId = window.requestAnimationFrame(renderFrame);
    };

    onCaptureReadyRef.current?.(() => captureCompositeFrame(videoRef.current, canvas));
    renderFrame();

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      onCaptureReadyRef.current?.(null);
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
      envRT?.dispose?.();
      renderer.dispose();
    };
    // userAdjust / landmarks / transform / showOverlay / onCaptureReady are read via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, landmarksRef]);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-[#0b1220]">
      <video
        ref={videoRef}
        data-testid="ar-video-layer"
        className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        autoPlay
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        data-testid="ar-canvas-layer"
        className="absolute inset-0 h-full w-full scale-x-[-1]"
      />
    </div>
  );
}

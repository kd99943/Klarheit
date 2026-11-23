import * as THREE from "three";
import { FACE_TRIANGLES } from "./faceTriangles";
import { facePointToWorld, type FaceProjection } from "./arRendering";
import type { FaceLandmark } from "./types";

export function createFaceOcclusion() {
  const group = new THREE.Group();
  group.visible = false;
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(468 * 3), 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positions);
  geometry.setIndex(FACE_TRIANGLES);
  const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
  const face = new THREE.Mesh(geometry, depthMaterial);
  face.renderOrder = -1;
  face.frustumCulled = false;
  const shadow = new THREE.Mesh(geometry, new THREE.ShadowMaterial({ opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  shadow.renderOrder = 1;
  shadow.receiveShadow = true;
  shadow.frustumCulled = false;
  const sideHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.35, 4, 16), depthMaterial);
  sideHead.renderOrder = -1;
  group.add(face, shadow, sideHead);
  const left = new THREE.Vector3();
  const right = new THREE.Vector3();
  const rear = new THREE.Vector3();
  const point = new THREE.Vector3();

  function update(landmarks: FaceLandmark[], projection: FaceProjection, videoAspect: number, aspect: number, rotation: THREE.Quaternion, unitsPerMm: number) {
    if (landmarks.length < 468 || landmarks.slice(0, 468).some((p) =>
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z ?? 0))) {
      group.visible = false;
      return false;
    }
    for (let i = 0; i < 468; i++) {
      facePointToWorld(landmarks[i], projection, videoAspect, aspect, point);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute("normal");
    for (let i = 0; i < 468; i++) {
      positions.setXYZ(i,
        positions.getX(i) - normals.getX(i) * 1.5 * unitsPerMm,
        positions.getY(i) - normals.getY(i) * 1.5 * unitsPerMm,
        positions.getZ(i) - normals.getZ(i) * 1.5 * unitsPerMm);
    }
    positions.needsUpdate = true;
    left.fromBufferAttribute(positions, 234);
    right.fromBufferAttribute(positions, 454);
    const width = left.distanceTo(right) * 1.05;
    rear.set(0, -width * 0.12, -width * 0.42).applyQuaternion(rotation);
    sideHead.position.copy(left).add(right).multiplyScalar(0.5).add(rear);
    sideHead.quaternion.copy(rotation);
    sideHead.scale.set(width, width, width * 0.7);
    group.visible = true;
    return true;
  }
  return { group, update };
}

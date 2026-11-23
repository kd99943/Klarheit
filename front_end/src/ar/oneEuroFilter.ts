import * as THREE from "three";

function alpha(cutoff: number, dt: number) {
  return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
}

/** Time-based One Euro filter, using angular velocity and slerp for orientation. */
export class PoseFilter {
  private time: number | null = null;
  private position = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private scale = new THREE.Vector3(1, 1, 1);
  private previousPosition = new THREE.Vector3();
  private previousRotation = new THREE.Quaternion();
  private previousScale = new THREE.Vector3(1, 1, 1);
  private speeds = [0, 0, 0];

  reset() { this.time = null; }

  apply(target: THREE.Object3D, position: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, time: number) {
    const dt = this.time === null ? 0 : (time - this.time) / 1000;
    if (dt <= 0 || dt > 0.5) {
      this.position.copy(position);
      this.rotation.copy(rotation);
      this.scale.copy(scale);
      this.speeds.fill(0);
    } else {
      // Beta must operate on comparable units: percent of model scale and degrees,
      // rather than tiny world-space distances and radians that barely raise the cutoff.
      const velocities = [
        position.distanceTo(this.previousPosition) / Math.max(scale.x, 0.001) * 100,
        THREE.MathUtils.radToDeg(rotation.angleTo(this.previousRotation)),
        scale.distanceTo(this.previousScale) / Math.max(this.previousScale.length(), 0.001) * 100,
      ];
      const weights = velocities.map((velocity, index) => {
        this.speeds[index] += alpha(1, dt) * (velocity / dt - this.speeds[index]);
        return alpha(1 + 0.04 * this.speeds[index], dt);
      });
      this.position.lerp(position, weights[0]);
      this.rotation.slerp(rotation, weights[1]);
      this.scale.lerp(scale, weights[2]);
    }
    this.time = time;
    this.previousPosition.copy(position);
    this.previousRotation.copy(rotation);
    this.previousScale.copy(scale);
    target.position.copy(this.position);
    target.quaternion.copy(this.rotation);
    target.scale.copy(this.scale);
  }
}

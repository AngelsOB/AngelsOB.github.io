/** Tunable physics & visual config for the beer can */

export interface CanPhysicsConfig {
  // Physics
  gravity: number;
  mass: number;
  restitution: number;
  friction: number;
  linearDamping: number;
  angularDamping: number;
  floorRestitution: number;
  floorFriction: number;

  // Wind
  windForce: number;
  windMinInterval: number;
  windMaxInterval: number;

  // Visual / geometry
  meshHeight: number;
  canRadius: number;

  // Camera
  cameraZ: number;
  cameraFov: number;

  // Can material
  canColor: string;
  canMetalness: number;
  canRoughness: number;

  // Label material
  labelMetalness: number;
  labelRoughness: number;
  labelHeightRatio: number;
  labelYOffset: number;

  // Drag
  maxThrowVel: number;

  // Swing (pendulum simulation during drag)
  swingDamping: number;
  swingInertia: number;
}

export const DEFAULT_CAN_CONFIG: CanPhysicsConfig = {
  gravity: -34,
  mass: 1.8,
  restitution: 0.45,
  friction: 0.6,
  linearDamping: 0.3,
  angularDamping: 1.5,
  floorRestitution: 0.2,
  floorFriction: 0.6,
  windForce: 6.0,
  windMinInterval: 3,
  windMaxInterval: 8,
  meshHeight: 2.4,
  canRadius: 0.5,
  cameraZ: 12.5,
  cameraFov: 95,
  canColor: "#d4d4d4",
  canMetalness: 0.93,
  canRoughness: 0.07,
  labelMetalness: 0.05,
  labelRoughness: 0.2,
  labelHeightRatio: 0.9,
  labelYOffset: -0.03,
  maxThrowVel: 42,
  swingDamping: 7,
  swingInertia: 0.4,
};

/** Tuned config for the home page — smaller, bouncier cans */
export const HOME_CAN_CONFIG: CanPhysicsConfig = {
  ...DEFAULT_CAN_CONFIG,
  gravity: -20,
  mass: 1.2,
  restitution: 0.6,
  linearDamping: 0.4,
  angularDamping: 2.0,
  floorRestitution: 0.4,
  floorFriction: 0.4,
  windForce: 1.5,
  windMinInterval: 4,
  windMaxInterval: 10,
  meshHeight: 1.6,
  canRadius: 0.35,
  maxThrowVel: 30,
};

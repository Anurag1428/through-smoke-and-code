import RAPIER from "@dimforge/rapier3d-compat";

let rapierModule: typeof RAPIER | null = null;

export async function initRapier() {
  if (!rapierModule) {
    await RAPIER.init();
    rapierModule = RAPIER;
  }
  return rapierModule;
}

export function getRapier() {
  if (!rapierModule) {
    throw new Error("RAPIER not initialized. Call initRapier() first.");
  }
  return rapierModule;
}
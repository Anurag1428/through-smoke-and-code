/// <reference types="vite/client" />

declare module "@dimforge/rapier3d-compat" {
  export * from "@dimforge/rapier3d-compat/rapier"
}

declare module "@dimforge/rapier3d" {
  export * from "@dimforge/rapier3d/rapier"  
}

// For WASM files
declare module "*.wasm" {
  const wasmModule: WebAssembly.Module
  export default wasmModule
}

declare module "*.wasm?init" {
  const initWasm: () => Promise<WebAssembly.Instance>
  export default initWasm
}
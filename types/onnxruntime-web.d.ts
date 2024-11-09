import * as ort from 'onnxruntime-web';

declare module 'onnxruntime-web' {
  interface WasmConfig {
    wasmPaths?: {
      'ort-wasm.wasm': string;
      'ort-wasm-simd.wasm': string;
      'ort-wasm-threaded.wasm': string;
    };
    numThreads?: number;
    simd?: boolean;
  }

  interface Environment {
    wasm: WasmConfig;
  }
}
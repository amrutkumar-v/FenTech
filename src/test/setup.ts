import '@testing-library/jest-dom/vitest'

// jsdom lacks createImageBitmap used by the photo compressor.
if (!('createImageBitmap' in globalThis)) {
  Object.assign(globalThis, {
    createImageBitmap: async () => ({ width: 100, height: 100, close: () => {} }),
  })
}

// This file tells TypeScript about Vite-specific globals.
// "vite/client" adds types for:
//   - import.meta.env (environment variables)
//   - import.meta.hot (hot module replacement)
//   - import.meta.glob (file globbing)
// Without this reference, TypeScript complains that
// 'env' does not exist on type 'ImportMeta'.
/// <reference types="vite/client" />
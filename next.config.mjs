/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Load these with Node's require at runtime instead of bundling them: pdf.js
  // spawns its worker from its own package path, and the embedding stack loads
  // native ONNX/canvas binaries. (@huggingface/transformers is external by default.)
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "@chroma-core/default-embed",
  ],
  // Deployments use Chroma Cloud's hosted embeddings (CHROMA_API_KEY), so the local
  // ONNX embedding stack (about 350 MB, over Vercel's 250 MB function limit) is left
  // out of traced output. Local `npm run dev` / `npm start` read node_modules directly
  // and are unaffected.
  outputFileTracingExcludes: {
    "/**": [
      "node_modules/onnxruntime-node/**",
      "node_modules/onnxruntime-web/**",
      "node_modules/onnxruntime-common/**",
      "node_modules/@huggingface/transformers/**",
    ],
  },
  // lib/chroma.ts loads chromadb and the Chroma Cloud embedding package with
  // webpackIgnore imports (Turbopack cannot parse their dynamic @chroma-core imports),
  // so the build does not see them. List them, with their dependencies, for the
  // routes that talk to Chroma so deployments include them.
  outputFileTracingIncludes: {
    "/api/{upload,chat,import-hf}": [
      "./node_modules/chromadb/**/*",
      "./node_modules/@chroma-core/chroma-cloud-qwen/**/*",
      "./node_modules/@chroma-core/ai-embeddings-common/**/*",
      "./node_modules/ajv/**/*",
      "./node_modules/fast-deep-equal/**/*",
      "./node_modules/fast-uri/**/*",
      "./node_modules/json-schema-traverse/**/*",
      "./node_modules/require-from-string/**/*",
      "./node_modules/semver/**/*",
    ],
  },
};

export default nextConfig;

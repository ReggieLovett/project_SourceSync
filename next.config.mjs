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
  // Deployments use Pinecone, which embeds text itself (PINECONE_API_KEY), so the local
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
};

export default nextConfig;

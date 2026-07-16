import type { NextConfig } from "next";

// ponytail: pragmatic CSP. style-src/script-src allow 'unsafe-inline' because
// the app relies on inline styles (React Flow sets element.style) and Next's
// inline bootstrap. React's dev build uses eval() for debugging; prod never does.
// 'wasm-unsafe-eval' is required for the client-side embedding model (ONNX runs
// in WebAssembly); it permits WASM compilation only, not arbitrary eval.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:";

// The embedding model weights + ONNX wasm are fetched once, in the browser, from
// the HuggingFace Hub and the jsdelivr CDN. Everything else stays same-origin.
const modelHosts = "https://huggingface.co https://*.hf.co https://cdn.jsdelivr.net";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${modelHosts}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

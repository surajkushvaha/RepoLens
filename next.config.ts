import type { NextConfig } from "next";

// ponytail: pragmatic CSP. style-src/script-src allow 'unsafe-inline' because
// the app relies on inline styles (React Flow sets element.style) and Next's
// inline bootstrap. React's dev build uses eval() for debugging; prod never does.
// 'wasm-unsafe-eval' is required for the client-side embedding model (ONNX runs
// in WebAssembly); it permits WASM compilation only, not arbitrary eval.
// Clerk (auth) loads ClerkJS + runs bot protection (Cloudflare Turnstile) in the
// browser, so its Frontend API hosts and challenges.cloudflare.com must be
// allowed. clerk.accounts.dev covers dev/preview instances; *.clerk.com covers
// production. See https://clerk.com/docs/security/clerk-csp.
const clerkScript = "https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com";
const clerkConnect = "https://*.clerk.accounts.dev https://*.clerk.com";
// Razorpay Checkout loads its script + opens a payment iframe from these hosts.
const rzpScript = "https://checkout.razorpay.com";
const rzpConnect = "https://api.razorpay.com https://lumberjack.razorpay.com";
const rzpFrame = "https://api.razorpay.com https://checkout.razorpay.com";

const scriptSrc =
  process.env.NODE_ENV === "production"
    ? `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: ${clerkScript} ${rzpScript}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: ${clerkScript} ${rzpScript}`;

// The embedding model weights + ONNX wasm are fetched once, in the browser, from
// the HuggingFace Hub and the jsdelivr CDN. Everything else stays same-origin.
const modelHosts = "https://huggingface.co https://*.hf.co https://cdn.jsdelivr.net";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.razorpay.com",
  "font-src 'self'",
  `connect-src 'self' ${modelHosts} ${clerkConnect} ${rzpConnect}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev ${rzpFrame}`,
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

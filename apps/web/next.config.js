const webpack = require("webpack");

// Every real page except /pay/* gets clickjacking protection — /pay/* is
// deliberately excluded (not just missed): it's meant to be iframed by an
// arbitrary merchant site (see packages/widget/src/modal.ts), so DENY-ing
// framing there would break the actual product. Everything else — the
// dashboard and login/signup especially, where a clickjacked click could
// authorize a real account action — gets it. Enumerated explicitly rather
// than one blanket rule with an exclusion pattern: Next.js merges multiple
// matching `headers()` entries for the same path rather than letting a
// later, more specific one override an earlier one, so a "match everything
// except /pay" glob would need to be exact to not silently also apply here.
const commonHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
const frameProtectedHeaders = [
  ...commonHeaders,
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@zela-checkout/shared"],
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/", headers: frameProtectedHeaders },
      { source: "/login", headers: frameProtectedHeaders },
      { source: "/signup", headers: frameProtectedHeaders },
      { source: "/signup/:path*", headers: frameProtectedHeaders },
      { source: "/dashboard/:path*", headers: frameProtectedHeaders },
      { source: "/docs/:path*", headers: frameProtectedHeaders },
      { source: "/pay/:path*", headers: commonHeaders },
      { source: "/api/:path*", headers: commonHeaders },
    ];
  },
  webpack: (config) => {
    // wagmi's connectors barrel pulls in Coinbase's Base Account connector,
    // which pulls in @coinbase/cdp-sdk's x402 (a payment-protocol extra,
    // unrelated to plain wallet connect) — @x402/* is an optional dependency
    // of cdp-sdk that isn't installed and this app never calls into (only
    // the plain `injected` connector is used, see lib/wagmi.ts).
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};

module.exports = nextConfig;

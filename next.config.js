/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      // WASM
      {
        source: "/game/:path*\\.wasm\\.br",
        headers: [
          { key: "Content-Type", value: "application/wasm" },
          { key: "Content-Encoding", value: "br" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // DATA
      {
        source: "/game/:path*\\.data\\.br",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          { key: "Content-Encoding", value: "br" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Framework JS
      {
        source: "/game/:path*\\.framework\\.js\\.br",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
          { key: "Content-Encoding", value: "br" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Symbols (optional but common)
      {
        source: "/game/:path*\\.symbols\\.json\\.br",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Content-Encoding", value: "br" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

const nextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/sertifikat/[id]": ["./assets/pdf/NotoSans-Regular.ttf"],
  },
  async headers() {
    return [
      {
        source: "/:folder(images|fonts)/:file([^/]+)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

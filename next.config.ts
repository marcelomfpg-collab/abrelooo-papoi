import path from "node:path";
import type { NextConfig } from "next";

// En GitHub Pages la app vive en /<nombre-del-repo>. En local (npm run dev) queda vacío.
const basePath = process.env.NODE_ENV === "production" ? "/sorpresa-camila" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    // El proyecto vive dentro de otra carpeta con su propio package-lock: fijamos la raíz aquí.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

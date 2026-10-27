import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TradePath — Process before profit",
    short_name: "TradePath",
    description: "A deliberate daily practice for your trading journey.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6f1",
    theme_color: "#5a1727",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

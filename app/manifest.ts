import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrainAlert NG",
    short_name: "TrainAlert",
    description: "Know the moment an NRC train seat opens.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ea",
    theme_color: "#0b4f3c",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

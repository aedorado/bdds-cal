import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Śrīla Gurudeva — Schedule",
    short_name: "Schedule",
    description: "Programme and travel schedule.",
    // Opens straight into the team view, since the people who install this to
    // their home screen are the ones who need notifications.
    start_url: "/admin",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#c8742c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

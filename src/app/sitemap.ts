import type { MetadataRoute } from "next";

const homepageLastModified = new Date("2026-07-16T00:00:00+09:00");
const lastModified = new Date("2026-07-13T00:00:00+09:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://oneflash.bantex.jp",
      lastModified: homepageLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://oneflash.bantex.jp/create",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://oneflash.bantex.jp/start",
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: "https://oneflash.bantex.jp/legal/terms",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://oneflash.bantex.jp/legal/privacy",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://oneflash.bantex.jp/legal/tokushoho",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}

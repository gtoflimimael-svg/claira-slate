import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "es", "de", "pt", "it", "ja", "zh", "ar", "hi", "ko", "ru"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export const RTL_LOCALES = new Set(["ar"]);

import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  url: "/api/openapi.json",
  pageTitle: "Maia API",
  theme: "default",
  layout: "modern",
  showSidebar: true,
  customCss: `
    :root {
      --scalar-radius: 2px;
      --scalar-font: ui-sans-serif, system-ui, sans-serif;
    }
    .dark-mode {
      --scalar-background-1: oklch(0.145 0 0);
      --scalar-background-2: oklch(0.205 0 0);
      --scalar-background-3: oklch(0.269 0 0);
      --scalar-color-1: oklch(0.985 0 0);
      --scalar-color-2: oklch(0.708 0 0);
      --scalar-border-color: oklch(0.269 0 0);
    }
    .light-mode {
      --scalar-background-1: oklch(1 0 0);
      --scalar-background-2: oklch(0.97 0 0);
      --scalar-background-3: oklch(0.97 0 0);
      --scalar-color-1: oklch(0.145 0 0);
      --scalar-color-2: oklch(0.556 0 0);
      --scalar-border-color: oklch(0.922 0 0);
    }
  `,
});

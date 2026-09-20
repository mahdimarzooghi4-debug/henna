// Exported from Figma Foundations 8:4. Keep in sync with web design tokens.
export const colors = {
  terracotta: "#B5523B",
  beige: "#D7B895",
  teal: "#0F5B5A",
  olive: "#8A9A6B",
  charcoal: "#2D2D2D",
  cream: "#F7F3ED",
  muted: "#756D65",
  paleTeal: "#E5F2F1",
  surface: "#FFFFFF",
  error: "#A33E30",
  errorSurface: "#FCECE6",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  normal: 16,
  lg: 24,
  xl: 32,
} as const;

// The Figma file uses Vazirmatn; local licensed font bytes are not yet
// supplied. React Native uses the platform fallback rather than a fake font.

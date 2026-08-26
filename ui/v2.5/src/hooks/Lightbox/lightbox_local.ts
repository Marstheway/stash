// Local-only lightbox tweaks. Keep official Lightbox.tsx close to upstream;
// hide the O-counter here so it does not crowd the rating stars.

export const showLightboxOCounter = false;

export const lightboxTagToggles = [
  { name: "wallpaper", label: "壁纸", kind: "wallpaper" },
  { name: "wp-sexy", label: "Sexy", kind: "sexy" },
] as const;

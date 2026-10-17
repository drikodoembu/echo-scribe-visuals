export const IMAGE_STYLES = [
  { id: "cinematic", label: "Fotografia cinematográfica", prompt: "Realistic cinematic photography, natural light, detailed everyday-life scenes" },
  { id: "documentary", label: "Documental realista", prompt: "Candid documentary photography, authentic environments, available light" },
  { id: "animation", label: "Animação 3D", prompt: "Expressive stylized 3D animation, soft lighting, rich textures" },
  { id: "anime", label: "Anime", prompt: "Hand-drawn anime illustration, expressive characters, detailed backgrounds" },
  { id: "watercolor", label: "Aquarela", prompt: "Watercolor illustration, delicate brushwork, paper texture, soft washes" },
  { id: "comic", label: "Quadrinhos", prompt: "Graphic novel illustration, bold ink lines, expressive shading, no speech bubbles" },
] as const;

export function imageStyle(id: unknown) {
  return IMAGE_STYLES.find((style) => style.id === id) ?? IMAGE_STYLES[0];
}

export function sceneCount(duration: number | null | undefined, secondsPerImage: number) {
  if (!duration || !Number.isFinite(duration) || duration <= 0) return 0;
  const seconds = Number.isFinite(secondsPerImage) ? Math.max(2, secondsPerImage) : 6;
  return Math.max(1, Math.ceil(duration / seconds));
}

export function sceneBatches(total: number) {
  const batches: { start: number; count: number }[] = [];
  for (let start = 0; start < total; start += 12) {
    batches.push({ start, count: Math.min(12, total - start) });
  }
  return batches;
}
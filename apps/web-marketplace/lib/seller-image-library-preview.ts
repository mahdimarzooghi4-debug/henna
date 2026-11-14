export type ImageFilter = "all" | "used" | "unused" | "local";
export type ImageSort = "recent" | "name";

export type PreviewPicture = {
  id: string;
  name: string;
  src: string;
  used: boolean;
  local: boolean;
  sizeBytes?: number;
  mimeType?: string;
};

/** Preview-only validation. This does NOT authorize server upload. */
export const previewImageMaxBytes = 10 * 1024 * 1024;
export const previewImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export function isSupportedPreviewImage(file: { type: string; size: number }): boolean {
  return previewImageTypes.some((type) => type === file.type) &&
    Number.isFinite(file.size) &&
    file.size > 0 &&
    file.size <= previewImageMaxBytes;
}

export function visiblePreviewPictures(
  pictures: readonly PreviewPicture[],
  filter: ImageFilter,
  query: string,
  sort: ImageSort,
): PreviewPicture[] {
  const term = query.trim().toLocaleLowerCase("fa");
  const result = pictures.filter((image) => {
    if (filter === "used" && !image.used) return false;
    if (filter === "unused" && image.used) return false;
    if (filter === "local" && !image.local) return false;
    return !term || image.name.toLocaleLowerCase("fa").includes(term);
  });
  if (sort === "name") {
    return result.sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }
  return result;
}

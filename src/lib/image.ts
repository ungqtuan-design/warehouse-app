import "server-only";

export async function resizeUploadedImage(file: File) {
  if (!file.type.startsWith("image/") || file.size > 750_000) {
    throw new Error("invalid-image");
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { default: sharp } = await import("sharp");
    const resized = await sharp(buffer)
      .rotate()
      .resize({
        width: 320,
        height: 320,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    if (resized.length > 100_000) throw new Error("image-too-large");
    return `data:image/webp;base64,${resized.toString("base64")}`;
  } catch {
    throw new Error("invalid-image");
  }
}

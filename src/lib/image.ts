import "server-only";

export async function resizeUploadedImage(file: File) {
  const { default: sharp } = await import("sharp");
  const buffer = Buffer.from(await file.arrayBuffer());
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

  return `data:image/webp;base64,${resized.toString("base64")}`;
}
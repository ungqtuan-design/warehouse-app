import "server-only";

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export async function resizeUploadedImage(file: File) {
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

    return `data:image/webp;base64,${resized.toString("base64")}`;
  } catch {
    return `data:${file.type};base64,${buffer.toString("base64")}`;
  }
}
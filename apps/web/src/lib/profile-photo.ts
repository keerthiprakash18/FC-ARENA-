export interface PhotoCrop {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
}
export const INITIAL_PHOTO_CROP: PhotoCrop = {
  zoom: 1,
  x: 50,
  y: 50,
  rotation: 0,
};
export function photoGeometry(
  width: number,
  height: number,
  crop: PhotoCrop,
  size: number,
) {
  const rotated = Math.abs(crop.rotation % 180) === 90;
  const w = rotated ? height : width,
    h = rotated ? width : height;
  const scale = Math.max(size / w, size / h) * crop.zoom;
  return {
    scale,
    width: w * scale,
    height: h * scale,
    left: ((size - w * scale) * crop.x) / 100,
    top: ((size - h * scale) * crop.y) / 100,
  };
}
export function drawProfilePhoto(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource & { width: number; height: number },
  crop: PhotoCrop,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Photo editing is unavailable in this browser.");
  const g = photoGeometry(image.width, image.height, crop, canvas.width);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(g.left + g.width / 2, g.top + g.height / 2);
  ctx.rotate((crop.rotation * Math.PI) / 180);
  ctx.drawImage(
    image,
    (-image.width * g.scale) / 2,
    (-image.height * g.scale) / 2,
    image.width * g.scale,
    image.height * g.scale,
  );
  ctx.restore();
}
export function encodeProfilePhoto(canvas: HTMLCanvasElement) {
  return new Promise<File>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(
              new File([blob], "profile-photo.jpg", { type: "image/jpeg" }),
            )
          : reject(
              new Error(
                "Unable to prepare your photo. Please choose it again.",
              ),
            ),
      "image/jpeg",
      0.92,
    ),
  );
}

import { authenticatedUpload } from "./auth-client";
interface ExportTicket {
  path: string;
  filename: string;
  expiresAt: string;
}
export interface CardDownload {
  url: string;
  filename: string;
  expiresAt: string;
}
export async function prepareCardDownload(
  blob: Blob,
  requestedName: string,
): Promise<CardDownload> {
  const base =
    requestedName
      .replace(/\.png$/i, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/^[^a-zA-Z0-9]+/, "")
      .slice(0, 76) || "FC-ARENA-card";
  const form = new FormData();
  form.append("image", blob, base + ".png");
  form.append("filename", base + ".png");
  const { data } = await authenticatedUpload<{
    success: true;
    data: ExportTicket;
  }>("/players/me/card-export", form);
  if (
    !/^\/players\/card-exports\/[0-9a-f-]{36}\?grant=[\w.-]+$/.test(
      data.path,
    ) ||
    !Number.isFinite(Date.parse(data.expiresAt))
  )
    throw new Error("Unable to prepare the card download. Please try again.");
  // The installed Android wrapper forwards HTTPS attachments to a browser. Its
  // verified app link covers fcarena.in; api.fcarena.in avoids opening the app again.
  const production =
    window.location.hostname === "fcarena.in" ||
    window.location.hostname.endsWith(".fcarena.in");
  const origin = production ? "https://api.fcarena.in" : window.location.origin;
  return { ...data, url: new URL("/api" + data.path, origin).toString() };
}
export function startCardDownload(card: CardDownload) {
  const link = document.createElement("a");
  link.href = card.url;
  link.download = card.filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

"use client";
import { useEffect, useRef, useState } from "react";
import { FcActionButton } from "./fc-action-button";
import { FcNotice } from "./fc-ui";
import {
  prepareCardDownload,
  type CardDownload,
} from "@/lib/card-download";
import { CardDownloadReady } from "@/components/experience/card-download-ready";
function supportsFileShare(file: File) {
  try {
    return typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true;
  } catch {
    return false;
  }
}
function cancelled(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
export function ShareCard({
  title,
  lines,
  filename = "fc-arena-card",
  label = "Share player card",
}: {
  title: string;
  lines: string[];
  filename?: string;
  label?: string;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloadCard, setDownloadCard] = useState<CardDownload | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState("");
  const [shareAvailable, setShareAvailable] = useState(false);
  const [nativeAndroid, setNativeAndroid] = useState(false);
  const working = useRef(false);

  useEffect(() => {
    if (!preparedFile || nativeAndroid) return;
    const url = URL.createObjectURL(preparedFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preparedFile, nativeAndroid]);

  async function prepare() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    setDownloadCard(null);
    setPreparedFile(null);
    setLocalUrl("");
    setShareAvailable(false);
    const native = /FC-Arena-Android\//i.test(navigator.userAgent);
    setNativeAndroid(native);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Image rendering is unavailable in this browser.");
      ctx.fillStyle = "#F6F4EE";
      ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = "#102D4C";
      ctx.fillRect(0, 0, 1080, 180);
      ctx.fillStyle = "#D9B765";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText("FC ARENA", 70, 110);
      ctx.fillStyle = "#102D4C";
      ctx.font = "bold 52px sans-serif";
      ctx.fillText(title, 70, 280, 940);
      ctx.font = "32px sans-serif";
      lines
        .slice(0, 8)
        .forEach((line, i) => ctx.fillText(line, 70, 380 + i * 68, 940));
      ctx.font = "24px sans-serif";
      ctx.fillText("fcarena.in", 70, 1010);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(Error("Unable to create the PNG. Please retry."))),
          "image/png",
        ),
      );
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      setPreparedFile(file);
      const canShare = supportsFileShare(file);
      setShareAvailable(canShare);
      // Canvas encoding is asynchronous. A new click supplies fresh user activation.
      if (canShare || !native) {
        setMessage("Your card is ready to share or save.");
        return;
      }
      // The installed Android wrapper expects an HTTPS attachment, not a blob URL.
      const card = await prepareCardDownload(blob, file.name);
      setDownloadCard(card);
      setMessage("Your card is ready. Tap Save PNG to download.");
    } catch (error) {
      if (!cancelled(error)) {
        setFailed(true);
        setMessage(error instanceof Error && error.message
          ? error.message
          : "Unable to prepare this card. Please retry.");
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function sharePrepared() {
    if (!preparedFile || working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await navigator.share({ files: [preparedFile], title });
      setMessage("Card shared.");
    } catch (error) {
      if (!cancelled(error)) {
        setFailed(true);
        setMessage("Sharing is unavailable here. Use Save PNG instead.");
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function prepareDownload() {
    if (!preparedFile || working.current) return;
    working.current = true;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const card = await prepareCardDownload(preparedFile, preparedFile.name);
      setDownloadCard(card);
      setMessage("Your card is ready. Tap Save PNG to download.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error && error.message
        ? error.message
        : "Unable to prepare the download. Please retry.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="fc-share-card space-y-2">
      <FcActionButton
        busy={busy}
        busyLabel="Preparing card…"
        className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
        onClick={() => void prepare()}
      >
        {label}
      </FcActionButton>
      {preparedFile && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Card sharing options">
          {shareAvailable && <FcActionButton busy={busy} onClick={() => void sharePrepared()} className="theme-primary-button min-h-11 rounded-xl px-4 text-sm">Share PNG</FcActionButton>}
          {!nativeAndroid && localUrl && <a href={localUrl} download={preparedFile.name} className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Save PNG ↓</a>}
          {nativeAndroid && !downloadCard && <FcActionButton busy={busy} onClick={() => void prepareDownload()} className="theme-secondary-button min-h-11 rounded-xl px-4 text-sm">Prepare PNG download</FcActionButton>}
        </div>
      )}
      {downloadCard && <CardDownloadReady card={downloadCard} />}
      <FcNotice tone={failed ? "error" : "success"}>{message}</FcNotice>
    </div>
  );
}

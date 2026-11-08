"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { FcDialog } from "@/components/fc/fc-dialog";
import {
  INITIAL_PHOTO_CROP,
  drawProfilePhoto,
  encodeProfilePhoto,
  photoGeometry,
  type PhotoCrop,
} from "@/lib/profile-photo";
import { errorMessage } from "@/lib/player-experience";

export function ProfilePhotoEditor({
  file,
  busy,
  progress,
  error,
  onSave,
  onCancel,
  onChoose,
}: {
  file: File;
  busy: boolean;
  progress: number;
  error: string;
  onSave: (file: File) => Promise<boolean>;
  onCancel: () => void;
  onChoose: (file: File) => void;
}) {
  const [crop, setCrop] = useState<PhotoCrop>(INITIAL_PHOTO_CROP);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [loadError, setLoadError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const chooser = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    crop: PhotoCrop;
  } | null>(null);
  useEffect(() => {
    let active = true;
    setImage(null);
    setLoadError("");
    setCrop({ ...INITIAL_PHOTO_CROP });
    if (file.size > 15 * 1024 * 1024 || !file.size) {
      setLoadError("Choose a photo up to 15 MB.");
      return;
    }
    const supported =
      /^(image\/(jpeg|png|webp))$/i.test(file.type) ||
      (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!supported) {
      setLoadError("Choose a JPG, PNG or WEBP photo.");
      return;
    }
    const url = URL.createObjectURL(file);
    const original = new Image();
    original.onload = () => {
      if (!active) return;
      try {
        if (
          !original.naturalWidth ||
          !original.naturalHeight ||
          original.naturalWidth * original.naturalHeight > 64_000_000
        )
          throw new Error(
            "This photo is too large to edit. Choose a smaller image.",
          );
        const scale = Math.min(
          1,
          2048 / Math.max(original.naturalWidth, original.naturalHeight),
        );
        const normalized = document.createElement("canvas");
        normalized.width = Math.max(
          1,
          Math.round(original.naturalWidth * scale),
        );
        normalized.height = Math.max(
          1,
          Math.round(original.naturalHeight * scale),
        );
        const ctx = normalized.getContext("2d");
        if (!ctx)
          throw new Error("Photo editing is unavailable in this browser.");
        ctx.drawImage(original, 0, 0, normalized.width, normalized.height);
        setImage(normalized);
      } catch (err) {
        setLoadError(errorMessage(err));
      }
    };
    original.onerror = () => {
      if (active)
        setLoadError(
          "This photo could not be opened. Try another JPG, PNG or WEBP image.",
        );
    };
    original.src = url;
    return () => {
      active = false;
      original.onload = null;
      original.onerror = null;
      original.src = "";
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (canvas.current && image) drawProfilePhoto(canvas.current, image, crop);
  }, [image, crop]);
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const current = drag.current;
    if (
      !current ||
      current.id !== event.pointerId ||
      !image ||
      busy ||
      preparing
    )
      return;
    const size = event.currentTarget.getBoundingClientRect().width;
    const g = photoGeometry(image.width, image.height, current.crop, size);
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    setCrop({
      ...current.crop,
      x:
        g.width > size + 0.01
          ? clamp(
              current.crop.x -
                ((event.clientX - current.x) * 100) / (g.width - size),
            )
          : 50,
      y:
        g.height > size + 0.01
          ? clamp(
              current.crop.y -
                ((event.clientY - current.y) * 100) / (g.height - size),
            )
          : 50,
    });
  }
  async function save() {
    if (saving.current || busy || !image || !canvas.current) return;
    saving.current = true;
    setPreparing(true);
    setLoadError("");
    try {
      const ready = await encodeProfilePhoto(canvas.current);
      if (await onSave(ready)) onCancel();
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      saving.current = false;
      setPreparing(false);
    }
  }
  const working = busy || preparing;
  return (
    <FcDialog
      open
      title="Adjust your profile photo"
      description="Move and zoom your photo. The circle shows how your avatar will appear. Your current photo changes only after you save."
      confirmLabel="Save photo"
      busy={working}
      confirmDisabled={!image}
      onConfirm={() => void save()}
      onCancel={onCancel}
    >
      <div className="profile-photo-editor">
        {!image && !loadError && <p role="status">Opening your photo…</p>}
        {image && (
          <>
            <div className="photo-crop-stage">
              <canvas
                ref={canvas}
                width={512}
                height={512}
                aria-label="Profile photo crop preview"
                onPointerDown={(e) => {
                  if (working) return;
                  drag.current = {
                    id: e.pointerId,
                    x: e.clientX,
                    y: e.clientY,
                    crop,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={move}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              />
              <div className="photo-circle-guide" aria-hidden="true" />
            </div>
            <p className="community-muted">
              Drag the photo, or use the controls below.
            </p>
            <fieldset disabled={working} className="photo-crop-controls">
              <label>
                Zoom <output>{crop.zoom.toFixed(1)}×</output>
                <input
                  type="range"
                  aria-label="Photo zoom"
                  min={1}
                  max={3}
                  step={0.05}
                  value={crop.zoom}
                  onChange={(e) =>
                    setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Horizontal position
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={crop.x}
                  onChange={(e) =>
                    setCrop((c) => ({ ...c, x: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Vertical position
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={crop.y}
                  onChange={(e) =>
                    setCrop((c) => ({ ...c, y: Number(e.target.value) }))
                  }
                />
              </label>
              <div className="community-actions">
                <button
                  className="community-button"
                  type="button"
                  onClick={() =>
                    setCrop((c) => ({
                      ...INITIAL_PHOTO_CROP,
                      rotation: (c.rotation + 90) % 360,
                    }))
                  }
                >
                  Rotate 90°
                </button>
                <button
                  className="community-button"
                  type="button"
                  onClick={() => setCrop({ ...INITIAL_PHOTO_CROP })}
                >
                  Reset crop
                </button>
              </div>
            </fieldset>
          </>
        )}
        <input
          ref={chooser}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (selected) onChoose(selected);
          }}
        />
        <button
          className="community-button"
          type="button"
          disabled={working}
          onClick={() => chooser.current?.click()}
        >
          Choose another photo
        </button>
        {busy && <p role="status">Uploading photo… {progress}%</p>}
        {(loadError || error) && (
          <p role="alert" className="community-error">
            {loadError || error}
          </p>
        )}
      </div>
    </FcDialog>
  );
}

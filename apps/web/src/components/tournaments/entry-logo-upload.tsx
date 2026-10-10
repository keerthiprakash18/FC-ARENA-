"use client";

import { useRef, useState } from "react";

import {
  authenticatedRequest,
  authenticatedUpload,
} from "@/lib/auth-client";

interface EntryLogoUploadProps {
  tournamentId: string;
  registrationId: string;
  entryName: string;
  logoUrl: string | null;
  locked?: boolean;
  compact?: boolean;
  onChanged?: (logoUrl: string | null) => void | Promise<void>;
}

interface EntryLogoMutationResponse {
  data: {
    message: string;
    entry: {
      id: string;
      entryName: string | null;
      entryLogoUrl: string | null;
    };
  };
}

export function EntryLogoUpload({
  tournamentId,
  registrationId,
  entryName,
  logoUrl,
  locked = false,
  compact = false,
  onChanged,
}: EntryLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (busy || locked) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Team logo must be 2 MB or smaller.");
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Use PNG, JPG/JPEG or WEBP.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage("");
    setError("");

    try {
      const body = new FormData();
      body.append("logo", file);

      const response = await authenticatedUpload<EntryLogoMutationResponse>(
        `/tournaments/${tournamentId}/entries/${registrationId}/logo`,
        body,
        setProgress,
      );

      setMessage(response.data.message);
      await onChanged?.(response.data.entry.entryLogoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload team logo.");
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (busy || locked || !logoUrl) return;

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await authenticatedRequest<EntryLogoMutationResponse>(
        `/tournaments/${tournamentId}/entries/${registrationId}/logo`,
        { method: "DELETE" },
      );

      setMessage(response.data.message);
      await onChanged?.(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove team logo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-secondary-background)] p-4"}>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary entry logos are user-controlled remote assets.
            <img
              src={logoUrl}
              alt={`${entryName} logo`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg font-black text-[var(--theme-primary)]">
              {entryName.trim().slice(0, 2).toUpperCase() || "FC"}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{entryName || "Team Logo"}</p>
          <p className="mt-1 text-xs text-[var(--theme-text-muted)]">
            PNG, JPG or WEBP · max 2 MB · auto-cropped to 1:1
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || locked}
              onClick={() => inputRef.current?.click()}
              className="theme-primary-button min-h-10 rounded-lg px-3 text-xs font-bold disabled:opacity-50"
            >
              {busy ? (progress > 0 ? `Uploading ${progress}%` : "Working…") : logoUrl ? "Change Logo" : "Upload Logo"}
            </button>

            {logoUrl ? (
              <button
                type="button"
                disabled={busy || locked}
                onClick={() => void remove()}
                className="theme-secondary-button min-h-10 rounded-lg px-3 text-xs font-semibold disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {locked ? (
        <p className="text-xs text-amber-500">
          Logo locked for players after Tournament start. An admin can still update it.
        </p>
      ) : null}
      {message ? <p className="text-xs text-emerald-500">{message}</p> : null}
      {error ? <p role="alert" className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

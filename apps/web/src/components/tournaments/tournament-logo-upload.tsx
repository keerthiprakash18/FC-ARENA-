'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  authenticatedRequest,
  authenticatedUpload,
} from '@/lib/auth-client';


const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);


export function TournamentLogoUpload({
  tournamentId,
  initialUrl,
}: {
  tournamentId: string;
  initialUrl:
    string | null;
}) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  const objectUrlRef =
    useRef<string | null>(
      null,
    );

  const [
    logoUrl,
    setLogoUrl,
  ] =
    useState<string | null>(
      initialUrl,
    );

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState<string | null>(
      initialUrl,
    );

  const [
    dragging,
    setDragging,
  ] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    removing,
    setRemoving,
  ] =
    useState(false);

  const [
    progress,
    setProgress,
  ] =
    useState(0);

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    setLogoUrl(
      initialUrl,
    );

    setPreviewUrl(
      initialUrl,
    );
  }, [
    initialUrl,
  ]);


  useEffect(
    () => () => {
      if (
        objectUrlRef.current
      ) {
        URL.revokeObjectURL(
          objectUrlRef.current,
        );
      }
    },
    [],
  );


  function validateFile(
    file:
      File,
  ) {
    if (
      !ALLOWED_TYPES.has(
        file.type,
      )
    ) {
      return 'Only PNG, JPG, JPEG and WEBP images are allowed.';
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return 'Tournament logo must be 5 MB or smaller.';
    }

    return null;
  }


  function replaceLocalPreview(
    file:
      File,
  ) {
    if (
      objectUrlRef.current
    ) {
      URL.revokeObjectURL(
        objectUrlRef.current,
      );
    }

    const objectUrl =
      URL.createObjectURL(
        file,
      );

    objectUrlRef.current =
      objectUrl;

    setPreviewUrl(
      objectUrl,
    );
  }


  function clearLocalPreview() {
    if (
      objectUrlRef.current
    ) {
      URL.revokeObjectURL(
        objectUrlRef.current,
      );

      objectUrlRef.current =
        null;
    }
  }


  async function uploadFile(
    file:
      File,
  ) {
    const validationError =
      validateFile(
        file,
      );

    if (
      validationError
    ) {
      setError(
        validationError,
      );

      return;
    }

    const previousLogoUrl =
      logoUrl;

    setError(
      '',
    );

    setProgress(
      0,
    );

    replaceLocalPreview(
      file,
    );

    setUploading(
      true,
    );

    try {
      const body =
        new FormData();

      body.append(
        'logo',
        file,
      );

      const response =
        await authenticatedUpload<{
          success: true;

          data: {
            message:
              string;

            logoUrl:
              string;
          };

          error: null;
        }>(
          `/tournaments/${tournamentId}/logo`,
          body,
          (
            nextProgress,
          ) =>
            setProgress(
              nextProgress,
            ),
        );

      clearLocalPreview();

      setLogoUrl(
        response
          .data
          .logoUrl,
      );

      setPreviewUrl(
        response
          .data
          .logoUrl,
      );

      setProgress(
        100,
      );
    } catch (
      err
    ) {
      clearLocalPreview();

      setLogoUrl(
        previousLogoUrl,
      );

      setPreviewUrl(
        previousLogoUrl,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to upload Tournament logo.',
      );
    } finally {
      setUploading(
        false,
      );
    }
  }


  async function removeLogo() {
    if (
      uploading ||
      removing
    ) {
      return;
    }

    if (
      !window.confirm(
        'Remove the Tournament logo?',
      )
    ) {
      return;
    }

    setRemoving(
      true,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/logo`,
        {
          method:
            'DELETE',
        },
      );

      clearLocalPreview();

      setLogoUrl(
        null,
      );

      setPreviewUrl(
        null,
      );

      setProgress(
        0,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove Tournament logo.',
      );
    } finally {
      setRemoving(
        false,
      );
    }
  }


  function chooseFile() {
    if (
      uploading ||
      removing
    ) {
      return;
    }

    inputRef.current
      ?.click();
  }


  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-300">
            Tournament Logo
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-600">
            Recommended: square image, 512 × 512 px or larger.
          </p>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-slate-500">
          PNG · JPG · JPEG · WEBP
        </span>
      </div>


      <input
        ref={
          inputRef
        }
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={
          (
            event,
          ) => {
            const file =
              event
                .target
                .files?.[0];

            event.target.value =
              '';

            if (
              file
            ) {
              void uploadFile(
                file,
              );
            }
          }
        }
      />


      {previewUrl ? (
        <div className="mt-4 rounded-2xl border border-[#203141] bg-[#0B1118] p-4 sm:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-[#284154] bg-[#101923]">
              <img
                src={
                  previewUrl
                }
                alt="Tournament logo preview"
                className="h-full w-full object-cover"
              />

              {uploading ? (
                <div className="absolute inset-0 grid place-items-center bg-[#071019]/70 text-xs font-semibold text-[#F8FAFC] backdrop-blur-sm">
                  {
                    progress
                  }
                  %
                </div>
              ) : null}
            </div>


            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Logo Preview
              </p>

              <p className="mt-1 text-xs leading-5 text-[#6F7B8A]">
                This image will be used on Tournament cards, details and competition screens.
              </p>


              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    uploading ||
                    removing
                  }
                  onClick={
                    chooseFile
                  }
                  className="min-h-10 rounded-[10px] border border-[#284154] bg-[#14212D] px-4 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#19B7FF]/40 hover:bg-[#182936] disabled:opacity-40"
                >
                  {uploading
                    ? 'Uploading...'
                    : 'Change Logo'}
                </button>

                <button
                  type="button"
                  disabled={
                    uploading ||
                    removing
                  }
                  onClick={() =>
                    void removeLogo()
                  }
                  className="min-h-10 rounded-[10px] border border-red-400/25 bg-red-400/[0.04] px-4 text-sm font-semibold text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-40"
                >
                  {removing
                    ? 'Removing...'
                    : 'Remove Logo'}
                </button>
              </div>
            </div>
          </div>


          {uploading ? (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[#19B7FF] transition-all duration-200"
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={
            uploading ||
            removing
          }
          onClick={
            chooseFile
          }
          onDragEnter={
            (
              event,
            ) => {
              event.preventDefault();

              setDragging(
                true,
              );
            }
          }
          onDragOver={
            (
              event,
            ) => {
              event.preventDefault();

              event.dataTransfer.dropEffect =
                'copy';

              setDragging(
                true,
              );
            }
          }
          onDragLeave={
            (
              event,
            ) => {
              event.preventDefault();

              setDragging(
                false,
              );
            }
          }
          onDrop={
            (
              event,
            ) => {
              event.preventDefault();

              setDragging(
                false,
              );

              const file =
                event
                  .dataTransfer
                  .files?.[0];

              if (
                file
              ) {
                void uploadFile(
                  file,
                );
              }
            }
          }
          className={`mt-4 flex min-h-[190px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition duration-200 ${
            dragging
              ? 'border-[#19B7FF]/60 bg-[#19B7FF]/[0.07]'
              : 'border-[#284154] bg-[#0B1118] hover:border-[#19B7FF]/40 hover:bg-[#101923]'
          }`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-[#284154] bg-[#14212D] text-2xl text-[#19B7FF]">
            +
          </span>

          <span className="mt-4 text-sm font-semibold text-[#F8FAFC]">
            Upload Logo
          </span>

          <span className="mt-2 max-w-sm text-xs leading-5 text-[#6F7B8A]">
            Click to choose an image from your device. On desktop, you can also drag and drop it here.
          </span>

          <span className="mt-3 text-[11px] font-medium text-[#8290A0]">
            Maximum file size: 5 MB
          </span>
        </button>
      )}


      {error ? (
        <p className="mt-3 text-sm text-red-300">
          {
            error
          }
        </p>
      ) : null}
    </section>
  );
}

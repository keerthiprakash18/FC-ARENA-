// Caller must decode metadata from the bytes; never trust multipart MIME alone.
export function assertImageFormat(mime: string, format: string | undefined): void {
  const formats: Record<string, string> = {
    'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp',
  };
  if (!format || formats[mime] !== format) {
    throw new Error('Image bytes do not match an allowed MIME type.');
  }
}

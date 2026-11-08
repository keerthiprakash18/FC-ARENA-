"use client";
import { useEffect, useState } from "react";
import type { CardDownload } from "@/lib/card-download";
export function CardDownloadReady({ card }: { card: CardDownload }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const remaining = Date.parse(card.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [card]);
  return (
    <div className="card-download-ready" role="status">
      <strong>
        {expired ? "Your card link has expired." : "Your card is ready."}
      </strong>
      <p>
        {expired
          ? "Create the card again for a new download link."
          : "If saving did not start, tap Save PNG. On Android, the card opens in your browser to download."}
      </p>
      {!expired && (
        <>
          <a
            className="community-button primary"
            href={card.url}
            download={card.filename}
            rel="noopener"
          >
            Save PNG ↓
          </a>
          <details>
            <summary>Preview card</summary>
            <img
              className="card-download-preview"
              src={card.url}
              alt="Your prepared player card"
            />
          </details>
        </>
      )}
    </div>
  );
}

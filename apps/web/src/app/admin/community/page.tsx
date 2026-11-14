"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { FcPageHeader } from "@/components/fc/fc-ui";
import { AppShell } from "@/components/app/app-shell";
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";
import { errorMessage, type ApiData } from "@/lib/player-experience";
interface Report {
  id: string;
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: { name: string };
  post: {
    imageUrl: string | null;
    body: string;
    league: { name: string } | null;
    author: { name: string } | null;
  };
  comment: { body: string; author: { name: string } } | null;
}
export default function CommunityModerationPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  async function load() {
    setError("");
    try {
      const current = await getCurrentUser();
      setUser(current);
      if (current.role !== "SUPER_ADMIN") {
        setReady(true);
        return;
      }
      const { data } = await authenticatedRequest<
        ApiData<{ reports: Report[] }>
      >("/arena-talk/moderation/reports");
      setReports(data.reports);
      setReady(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <AppShell currentUser={user || undefined}>
      <div className="community-page">
        <FcPageHeader title="Community moderation" icon="shield"
          subtitle="Review the oldest 50 open reports. Removing content also resolves other open reports for that content."
          action={<Link href="/arena-talk" className="theme-secondary-button inline-flex min-h-11 items-center border px-4 text-sm">Back to Arena Talk</Link>}
        />
        {error && (
          <div className="community-error" role="alert">
            {error}
            <button onClick={() => void load()}>Try again</button>
          </div>
        )}
        {ready && user?.role !== "SUPER_ADMIN" ? (
          <p role="alert">Community moderation access is required.</p>
        ) : (
          <div className="community-moderation">
            {reports.map((report) => (
              <Review
                key={report.id}
                report={report}
                refresh={() => void load()}
              />
            ))}
            {ready && !reports.length && (
              <p className="community-panel">No open community reports.</p>
            )}
            {!ready && !error && <p role="status">Loading report queue…</p>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
function Review({ report, refresh }: { report: Report; refresh: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function resolve(action: string) {
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest(
        `/arena-talk/moderation/reports/${report.id}/resolve`,
        { method: "POST", body: JSON.stringify({ action, note }) },
      );
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="community-panel">
      <h2>{report.reason.replaceAll("_", " ").toLowerCase()}</h2>
      <p className="community-muted">
        Reported by {report.reporter.name} ·{" "}
        {new Date(report.createdAt).toLocaleString("en-IN")} ·{" "}
        {report.post.league?.name || "Football Talk"}
      </p>
      <p>
        Author:{" "}
        {report.comment?.author.name || report.post.author?.name || "FC ARENA"}
      </p>
      <blockquote>{report.comment?.body || report.post.body}</blockquote>
      {report.post.imageUrl && !report.comment && (
        <img
          className="arena-post-image"
          src={`${API_URL}${report.post.imageUrl}`}
          alt="Reported post attachment"
        />
      )}
      {report.details && (
        <p className="arena-body">Report details: {report.details}</p>
      )}
      <label>
        Review note (required)
        <textarea
          value={note}
          minLength={5}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Explain the moderation decision."
        />
      </label>
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      <div className="community-actions">
        <button
          className="community-button primary"
          disabled={busy || note.trim().length < 5}
          onClick={() => void resolve("HIDE")}
        >
          Remove content
        </button>
        <button
          className="community-button"
          disabled={busy || note.trim().length < 5}
          onClick={() => void resolve("DISMISS")}
        >
          Dismiss report
        </button>
      </div>
    </article>
  );
}

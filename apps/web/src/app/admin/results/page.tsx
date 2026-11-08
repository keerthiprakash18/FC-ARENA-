"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AppShell } from "@/components/app/app-shell";
import {
  confirmAction,
  promptAction,
} from "@/components/fc/confirmation-provider";
import {
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
} from "@/components/fc/fc-ui";
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";
import { useRecoverableLoad } from "@/lib/use-recoverable-load";

type Entry = {
  entryName: string | null;
  members: Array<{ user: { fullName: string } }>;
} | null;
interface Submission {
  id: string;
  status: string;
  homeScore: number;
  awayScore: number;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  submittedBy: { fullName: string };
  reviewedBy: { fullName: string } | null;
  ocrExtraction: { id: string; scoreConfidence: number | null } | null;
  match: {
    id: string;
    tournamentId: string;
    fixture: {
      fixtureCode: string;
      roundName: string;
      homeRegistration: Entry;
      awayRegistration: Entry;
    };
  };
}
interface Queue {
  submissions: Submission[];
  total: number;
  page: number;
  pageSize: number;
  tournaments: Array<{
    id: string;
    name: string;
    leagueId: string;
    league: { name: string };
  }>;
}
const entryName = (entry: Entry) =>
  entry?.entryName ||
  entry?.members.map((member) => member.user.fullName).join(" / ") ||
  "Unassigned";
const labels: Record<string, string> = {
  PENDING_VERIFICATION: "Awaiting review",
  CONFIRMED: "Verified",
  REJECTED: "Rejected",
};

function Evidence({ id }: { id: string }) {
  const [image, setImage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void authenticatedRequest<{ data: { mimeType: string; base64: string } }>(
      `/results/${id}/evidence`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!controller.signal.aborted)
          setImage(
            `data:${response.data.mimeType};base64,${response.data.base64}`,
          );
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load screenshot.",
          );
      });
    return () => controller.abort();
  }, [id]);
  if (error)
    return (
      <p role="alert" className="theme-muted text-sm">
        {error}
      </p>
    );
  // Evidence stays behind authenticated reads and has no public storage URL.
  return image ? (
    <img
      src={image}
      alt="Submitted match result screenshot"
      className="max-h-[70vh] w-full rounded-xl object-contain"
    />
  ) : (
    <p role="status" className="theme-muted text-sm">
      Loading screenshot…
    </p>
  );
}

export default function AdminResultsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null),
    [queue, setQueue] = useState<Queue | null>(null);
  const [status, setStatus] = useState("PENDING_VERIFICATION"),
    [leagueId, setLeagueId] = useState(""),
    [tournamentId, setTournamentId] = useState("");
  const [page, setPage] = useState(1),
    [loadedQuery, setLoadedQuery] = useState("");
  const [loading, setLoading] = useState(true),
    [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState(""),
    [actionError, setActionError] = useState(""),
    [evidenceId, setEvidenceId] = useState("");
  const query = new URLSearchParams({
    status,
    page: String(page),
    ...(leagueId ? { leagueId } : {}),
    ...(tournamentId ? { tournamentId } : {}),
  }).toString();
  const load = useRecoverableLoad(async (signal) => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser({ signal });
      if (signal.aborted) return;
      setUser(currentUser);
      const response = await authenticatedRequest<{ data: Queue }>(
        `/admin/results?${query}`,
        { signal },
      );
      if (!signal.aborted) {
        setQueue(response.data);
        setLoadedQuery(query);
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, query);
  const disabled =
    loading || loadedQuery !== query || Boolean(busyId) || Boolean(load.error);

  async function review(item: Submission, decision: "confirm" | "reject") {
    let reason: string | null = null;
    if (decision === "reject") {
      reason = await promptAction({
        title: "Reject result?",
        description:
          "Explain what the player needs to correct before resubmitting.",
        label: "Rejection reason",
        confirmLabel: "Reject result",
        destructive: true,
        required: true,
      });
      if (reason === null) return;
      if (!reason.trim() || reason.trim().length > 500) {
        setActionError(
          "Enter a rejection reason between 1 and 500 characters.",
        );
        return;
      }
    } else if (
      !(await confirmAction({
        title: "Verify this result?",
        description: `${entryName(item.match.fixture.homeRegistration)} ${item.homeScore} – ${item.awayScore} ${entryName(item.match.fixture.awayRegistration)}${item.homePenaltyScore != null ? ` (penalties ${item.homePenaltyScore} – ${item.awayPenaltyScore})` : ""}. Verification updates standings and player statistics.`,
        confirmLabel: "Verify result",
      }))
    )
      return;
    setBusyId(item.id);
    setActionError("");
    setNotice("");
    try {
      const response = await authenticatedRequest<{
        data: { message: string };
      }>(`/results/${item.id}/${decision}`, {
        method: "POST",
        ...(decision === "reject"
          ? { body: JSON.stringify({ reason: reason!.trim() }) }
          : {}),
      });
      setNotice(response.data.message);
      setEvidenceId("");
    } catch (caught) {
      setActionError(
        `${caught instanceof Error ? caught.message : "Review could not be completed."} Refreshing the queue; check the result status before trying again.`,
      );
    } finally {
      setBusyId("");
      setLoading(true);
      load.retry();
    }
  }

  if (!user)
    return load.error ? (
      <main className="fc-state-screen">
        <FcErrorState message={load.error} onRetry={load.retry} />
      </main>
    ) : (
      <FcLoadingScreen label="Loading result reviews…" />
    );
  const leagues = [
    ...new Map(
      (queue?.tournaments ?? []).map((t) => [t.leagueId, t.league.name]),
    ).entries(),
  ];
  const selectClass = "theme-input min-h-11 min-w-0 rounded-xl border p-3";
  return (
    <AppShell currentUser={user} playerName={user.player?.identity?.inGameName}>
      <div className="space-y-5">
        <FcPageHeader
          eyebrow="Admin"
          title="Result verification"
          subtitle="Review scores and evidence, then verify or explain what needs correcting."
          action={
            <button
              disabled={Boolean(busyId) || loading}
              onClick={() => {
                setLoading(true);
                load.retry();
              }}
              className="theme-text min-h-11 rounded-xl border px-4 text-sm font-bold"
            >
              Refresh queue
            </button>
          }
        />
        <AdminNavigation />
        <FcPanel className="grid gap-4 p-4 sm:grid-cols-3">
          <label className="theme-muted grid gap-2 text-sm">
            Status
            <select
              aria-label="Review status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
                setEvidenceId("");
              }}
              className={selectClass}
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="theme-muted grid gap-2 text-sm">
            League
            <select
              aria-label="Review league"
              value={leagueId}
              onChange={(event) => {
                setLeagueId(event.target.value);
                setTournamentId("");
                setPage(1);
                setEvidenceId("");
              }}
              className={selectClass}
            >
              <option value="">All permitted leagues</option>
              {leagues.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="theme-muted grid gap-2 text-sm">
            Tournament
            <select
              aria-label="Review tournament"
              value={tournamentId}
              onChange={(event) => {
                setTournamentId(event.target.value);
                setPage(1);
                setEvidenceId("");
              }}
              className={selectClass}
            >
              <option value="">All permitted tournaments</option>
              {queue?.tournaments
                .filter((t) => !leagueId || t.leagueId === leagueId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
        </FcPanel>
        {notice ? (
          <p role="status" className="theme-muted text-sm">
            {notice}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="theme-muted text-sm">
            {actionError}
          </p>
        ) : null}
        {load.error ? (
          <FcErrorState message={load.error} onRetry={load.retry} />
        ) : null}
        {loading || loadedQuery !== query ? (
          <p role="status" className="theme-muted py-5 text-sm">
            Loading result reviews…
          </p>
        ) : !load.error && queue ? (
          <>
            <p className="theme-muted text-sm" role="status">
              {queue.total}{" "}
              {status === "PENDING_VERIFICATION"
                ? "awaiting review · oldest first"
                : labels[status].toLowerCase() + " results"}
            </p>
            {!queue.submissions.length ? (
              <FcPanel className="p-6">
                <h2 className="theme-text font-bold">
                  {status === "PENDING_VERIFICATION"
                    ? "All caught up"
                    : "No results in this view"}
                </h2>
                <p className="theme-muted mt-2 text-sm">
                  There are no matching results in the selected tournaments.
                </p>
              </FcPanel>
            ) : null}
            {queue.submissions.map((item) => (
              <FcPanel key={item.id} className="min-w-0 space-y-4 p-5">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <p className="theme-muted">
                    {
                      queue.tournaments.find(
                        (t) => t.id === item.match.tournamentId,
                      )?.name
                    }{" "}
                    · {item.match.fixture.roundName}
                  </p>
                  <span className="theme-text font-bold">
                    {labels[item.status] ?? item.status}
                  </span>
                </div>
                <div className="theme-text grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-center font-bold">
                  <span className="break-words">
                    {entryName(item.match.fixture.homeRegistration)}
                  </span>
                  <strong className="whitespace-nowrap text-2xl">
                    {item.homeScore} – {item.awayScore}
                  </strong>
                  <span className="break-words">
                    {entryName(item.match.fixture.awayRegistration)}
                  </span>
                </div>
                {item.homePenaltyScore != null ? (
                  <p className="theme-muted text-center text-sm">
                    Penalties {item.homePenaltyScore} – {item.awayPenaltyScore}
                  </p>
                ) : null}
                <p className="theme-muted text-xs">
                  Submitted by {item.submittedBy.fullName} ·{" "}
                  {new Date(item.createdAt).toLocaleString()} ·{" "}
                  {item.ocrExtraction ? "Screenshot result" : "Manual entry"}
                </p>
                {item.reviewedBy ? (
                  <p className="theme-muted text-sm">
                    {labels[item.status]} by {item.reviewedBy.fullName}
                    {item.reviewedAt
                      ? ` · ${new Date(item.reviewedAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
                {item.rejectionReason ? (
                  <p className="theme-text break-words text-sm">
                    Reason: {item.rejectionReason}
                  </p>
                ) : null}
                {item.ocrExtraction?.scoreConfidence != null ? (
                  <p className="theme-muted text-xs">
                    OCR confidence{" "}
                    {Math.round(item.ocrExtraction.scoreConfidence * 100)}% ·
                    Check the screenshot before verifying.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/matches/${item.match.id}`}
                    className="theme-text inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-bold"
                  >
                    Open match {item.match.fixture.fixtureCode}
                  </Link>
                  {item.ocrExtraction ? (
                    <button
                      aria-expanded={evidenceId === item.id}
                      className="theme-text min-h-11 rounded-xl border px-4 text-sm font-bold"
                      onClick={() =>
                        setEvidenceId(evidenceId === item.id ? "" : item.id)
                      }
                    >
                      {evidenceId === item.id
                        ? "Hide screenshot"
                        : "Review screenshot"}
                    </button>
                  ) : null}
                  {item.status === "PENDING_VERIFICATION" ? (
                    <>
                      <button
                        disabled={disabled}
                        onClick={() => void review(item, "confirm")}
                        className="theme-primary-button min-h-11 rounded-xl border px-5 text-sm font-bold disabled:opacity-50"
                      >
                        {busyId === item.id ? "Saving…" : "Verify result"}
                      </button>
                      <button
                        disabled={disabled}
                        onClick={() => void review(item, "reject")}
                        className="theme-text min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50"
                      >
                        Reject result
                      </button>
                    </>
                  ) : null}
                </div>
                {evidenceId === item.id ? <Evidence id={item.id} /> : null}
              </FcPanel>
            ))}
            <nav
              aria-label="Review pages"
              className="theme-muted flex items-center justify-between gap-3 text-sm"
            >
              <button
                disabled={page <= 1 || disabled}
                onClick={() => {
                  setPage((value) => value - 1);
                  setEvidenceId("");
                }}
                className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {page} of{" "}
                {Math.max(1, Math.ceil(queue.total / queue.pageSize))}
              </span>
              <button
                disabled={page * queue.pageSize >= queue.total || disabled}
                onClick={() => {
                  setPage((value) => value + 1);
                  setEvidenceId("");
                }}
                className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

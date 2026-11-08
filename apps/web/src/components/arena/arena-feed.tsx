"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authenticatedRequest, authenticatedUpload } from "@/lib/auth-client";
import { API_URL } from "@/lib/api";
import { errorMessage, type ApiData } from "@/lib/player-experience";
import {
  arenaReasons,
  type ArenaAuthor,
  type ArenaComment,
  type ArenaPost,
} from "@/lib/arena-talk";
import { confirmAction } from "@/components/fc/confirmation-provider";

function stamp(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function Author({ author }: { author: ArenaAuthor | null }) {
  return (
    <div className="arena-author">
      <span className="arena-avatar">
        {author?.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          (author?.name || "FC").slice(0, 2).toUpperCase()
        )}
      </span>
      <div>
        <strong>
          {author ? (
            <Link href={`/discover/players/${author.id}`}>{author.name}</Link>
          ) : (
            "FC ARENA · Official result"
          )}
          {author?.verified && <span aria-label="Verified identity"> ✓</span>}
        </strong>
        <small>{author?.playerCode || "Verified match activity"}</small>
      </div>
    </div>
  );
}
function ReportForm({ path, done }: { path: string; done: () => void }) {
  const [reason, setReason] = useState(arenaReasons[0][0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function send() {
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest(path, {
        method: "POST",
        body: JSON.stringify({ reason, details }),
      });
      setSent(true);
      done();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="arena-report">
      <summary>Report content</summary>
      {sent ? (
        <p role="status">Report received. A moderator will review it.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {arenaReasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Additional details
            <textarea
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="community-error">
              {error}
            </p>
          )}
          <button className="community-button" disabled={busy}>
            {busy ? "Sending…" : "Submit report"}
          </button>
        </form>
      )}
    </details>
  );
}
function CommentThread({
  postId,
  changed,
}: {
  postId: string;
  changed: () => void;
}) {
  const [comments, setComments] = useState<ArenaComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState("");
  const request = useRef({ body: "", id: "" });
  const path = `/arena-talk/posts/${postId}/comments`;
  async function load(more = false) {
    setBusy(true);
    setError("");
    try {
      const { data } = await authenticatedRequest<
        ApiData<{ comments: ArenaComment[]; nextCursor: string | null }>
      >(path + (more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
      setComments((old) =>
        more
          ? [
              ...old,
              ...data.comments.filter((c) => !old.some((x) => x.id === c.id)),
            ]
          : data.comments,
      );
      setCursor(data.nextCursor);
      setReady(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load(); /* A thread is scoped to one post. */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function send() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError("");
    if (request.current.body !== body || !request.current.id)
      request.current = { body, id: crypto.randomUUID() };
    try {
      await authenticatedRequest(path, {
        method: "POST",
        body: JSON.stringify({ body, clientRequestId: request.current.id }),
      });
      setBody("");
      request.current = { body: "", id: "" };
      await load();
      changed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="arena-comments" aria-label="Comments">
      <h3>Conversation</h3>
      {error && (
        <p className="community-error" role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {!ready && !error && <p role="status">Loading comments…</p>}
      {ready && !comments.length && (
        <p className="community-muted">Start the conversation.</p>
      )}
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          path={`${path}/${comment.id}`}
          refresh={() => {
            void load();
            changed();
          }}
        />
      ))}
      {cursor && (
        <button
          className="community-button"
          disabled={busy}
          onClick={() => void load(true)}
        >
          Load earlier comments
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label>
          Add a comment
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={2}
            required
            placeholder="Keep the conversation respectful."
          />
        </label>
        <div className="community-between">
          <small>{body.length}/1000</small>
          <button
            className="community-button primary"
            disabled={busy || !body.trim()}
          >
            {busy ? "Please wait…" : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}
function CommentItem({
  comment,
  path,
  refresh,
}: {
  comment: ArenaComment;
  path: string;
  refresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  async function change(method: string) {
    if (
      method === "DELETE" &&
      !(await confirmAction({
        title: "Remove comment?",
        description: "This comment will disappear from the conversation.",
        confirmLabel: "Remove",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest(path, {
        method,
        body: JSON.stringify(
          method === "PATCH" ? { body } : reason ? { reason } : {},
        ),
      });
      setEditing(false);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="arena-comment">
      <Author author={comment.author} />
      <small className="community-muted">
        {stamp(comment.createdAt)}
        {comment.editedAt ? " · Edited" : ""}
      </small>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change("PATCH");
          }}
        >
          <label>
            Edit comment
            <textarea
              maxLength={1000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          <div className="community-actions">
            <button
              className="community-button"
              disabled={busy || !body.trim()}
            >
              Save
            </button>
            <button
              type="button"
              className="community-button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="arena-body">{comment.body}</p>
      )}
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      <div className="community-actions">
        {comment.canEdit && (
          <button
            className="arena-text-button"
            onClick={() => {
              setBody(comment.body);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
        {comment.canDelete && (
          <details>
            <summary>Remove</summary>
            {!comment.canEdit && (
              <label>
                Moderation reason
                <input
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <button
              className="community-button"
              disabled={busy || (!comment.canEdit && reason.trim().length < 5)}
              onClick={() => void change("DELETE")}
            >
              Remove comment
            </button>
          </details>
        )}
        {comment.canReport && (
          <ReportForm path={`${path}/report`} done={() => undefined} />
        )}
      </div>
    </article>
  );
}
function PostCard({
  post,
  update,
  remove,
  refresh,
}: {
  post: ArenaPost;
  update: (p: ArenaPost) => void;
  remove: () => void;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(post.body);
  const [reason, setReason] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const path = `/arena-talk/posts/${post.id}`;
  useEffect(() => {
    setImageFailed(false);
  }, [post.imageUrl]);
  async function mutate(suffix: string, method: string, payload: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedRequest<ApiData<{ post: ArenaPost }>>(
        path + suffix,
        { method, body: JSON.stringify(payload) },
      );
      if (method === "DELETE") remove();
      else update(response.data.post);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function block() {
    if (
      !post.author?.inGameName ||
      !(await confirmAction({
        title: `Block ${post.author.name}?`,
        description:
          "You will no longer see each other’s posts and comments. Manage blocked players in Safety.",
        confirmLabel: "Block player",
        destructive: true,
      }))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await authenticatedRequest("/safety/blocks", {
        method: "POST",
        body: JSON.stringify({ targetInGameName: post.author.inGameName }),
      });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="arena-post">
      <header>
        <Author author={post.author} />
        <span className={`arena-kind kind-${post.kind}`}>
          {post.kind === "RUMOUR"
            ? "Unverified rumour"
            : post.kind === "RESULT"
              ? "Official result"
              : post.kind.toLowerCase()}
        </span>
      </header>
      <p className="arena-meta">
        {post.league
          ? `League only · ${post.league.name}`
          : "Football Talk · All members"}{" "}
        · {stamp(post.createdAt)}
        {post.editedAt ? " · Edited" : ""}
      </p>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("", "PATCH", { body });
          }}
        >
          <label>
            Edit post
            <textarea
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          <div className="community-actions">
            <button
              className="community-button primary"
              disabled={busy || !body.trim()}
            >
              Save changes
            </button>
            <button
              type="button"
              className="community-button"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="arena-body">{post.body}</p>
      )}
      {post.result && (
        <Link className="arena-result" href={`/matches/${post.result.matchId}`}>
          <span className="community-eyebrow">
            {post.result.tournamentName}
          </span>
          <div>
            <strong>{post.result.home}</strong>
            <b>
              {post.result.homeScore} – {post.result.awayScore}
            </b>
            <strong>{post.result.away}</strong>
          </div>
          {post.result.homePenaltyScore !== null && (
            <small>
              Penalties: {post.result.homePenaltyScore} –{" "}
              {post.result.awayPenaltyScore}
            </small>
          )}
          <span>View verified match ↗</span>
        </Link>
      )}
      {post.sourceUrl && (
        <a
          className="arena-source"
          href={post.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          Read source ↗ · {new URL(post.sourceUrl).hostname}
        </a>
      )}
      {post.imageUrl &&
        (imageFailed ? (
          <p className="community-muted">
            Image expired or unavailable. Refresh the feed to try again.
          </p>
        ) : (
          <img
            className="arena-post-image"
            src={
              post.imageUrl.startsWith("/")
                ? `${API_URL}${post.imageUrl}`
                : post.imageUrl
            }
            alt="Image attached by the post author"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ))}
      {post.poll && (
        <fieldset
          className="arena-poll"
          disabled={
            busy ||
            post.poll.closed ||
            Date.parse(post.poll.endsAt) <= Date.now()
          }
        >
          <legend>Community poll</legend>
          {post.poll.options.map((option) => (
            <button
              key={option.id}
              className="poll-option"
              aria-pressed={post.poll?.selectedOptionId === option.id}
              onClick={() =>
                void mutate("/vote", "PUT", { optionId: option.id })
              }
            >
              <span
                style={{ width: `${option.percent}%` }}
                aria-hidden="true"
              />
              <strong>
                {post.poll?.selectedOptionId === option.id ? "✓ " : ""}
                {option.label}
              </strong>
              <small>
                {option.percent}% · {option.votes}
              </small>
            </button>
          ))}
          <small>
            {post.poll.totalVotes} votes ·{" "}
            {post.poll.closed || Date.parse(post.poll.endsAt) <= Date.now()
              ? "Poll closed"
              : `Closes ${stamp(post.poll.endsAt)}`}{" "}
            · One vote per player
          </small>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="community-error">
          {error}
        </p>
      )}
      <footer className="community-between">
        <div className="community-actions">
          <button
            className="arena-text-button"
            disabled={busy}
            aria-pressed={post.liked}
            onClick={() =>
              void mutate("/reaction", "PUT", { liked: !post.liked })
            }
          >
            {post.liked ? "♥ Liked" : "♡ Like"} · {post.reactionCount}
          </button>
          <button
            className="arena-text-button"
            aria-expanded={comments}
            onClick={() => setComments(!comments)}
          >
            Comments · {post.commentCount}
          </button>
        </div>
        <details className="arena-options">
          <summary aria-label="Post options">•••</summary>
          <div>
            {post.canEdit && (
              <button
                className="community-button"
                onClick={() => {
                  setBody(post.body);
                  setEditing(true);
                }}
              >
                Edit post
              </button>
            )}
            {post.canDelete && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    if (
                      await confirmAction({
                        title: "Remove this post?",
                        description:
                          "The post and its conversation will disappear from the feed.",
                        confirmLabel: "Remove post",
                        destructive: true,
                      })
                    )
                      await mutate("", "DELETE", reason ? { reason } : {});
                  })();
                }}
              >
                {!post.canEdit && (
                  <label>
                    Moderation reason
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={5}
                      maxLength={500}
                      required
                    />
                  </label>
                )}
                <button className="community-button" disabled={busy}>
                  Remove post
                </button>
              </form>
            )}
            {post.canReport && (
              <ReportForm path={`${path}/report`} done={() => undefined} />
            )}
            {post.canReport && post.author?.inGameName && (
              <button
                className="community-button"
                disabled={busy}
                onClick={() => void block()}
              >
                Block player
              </button>
            )}
            <Link href="/safety" className="arena-text-button">
              Safety & blocked players
            </Link>
          </div>
        </details>
      </footer>
      {comments && (
        <CommentThread
          postId={post.id}
          changed={() => {
            void authenticatedRequest<ApiData<{ post: ArenaPost }>>(path)
              .then((r) => update(r.data.post))
              .catch(() => undefined);
          }}
        />
      )}
    </article>
  );
}
export function ArenaFeed({
  leagueId,
  leagueName,
}: {
  leagueId: string | null;
  leagueName: string;
}) {
  const [posts, setPosts] = useState<ArenaPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef({ value: 0 });
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("DISCUSSION");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [poll, setPoll] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("72");
  const [sending, setSending] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef({ signature: "", id: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function load(more = false) {
    const ticket = ++generation.current.value;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        audience: leagueId ? "LEAGUE" : "PUBLIC",
      });
      if (leagueId) query.set("leagueId", leagueId);
      if (more && cursor) query.set("cursor", cursor);
      const { data } = await authenticatedRequest<
        ApiData<{ posts: ArenaPost[]; nextCursor: string | null }>
      >(`/arena-talk/posts?${query}`);
      if (ticket !== generation.current.value) return;
      setPosts((old) =>
        more
          ? [
              ...old,
              ...data.posts.filter((p) => !old.some((x) => x.id === p.id)),
            ]
          : data.posts,
      );
      setCursor(data.nextCursor);
      setReady(true);
    } catch (err) {
      if (ticket === generation.current.value) setError(errorMessage(err));
    } finally {
      if (ticket === generation.current.value) setLoading(false);
    }
  }
  useEffect(() => {
    const requests = generation.current;
    void load();
    return () => {
      requests.value++;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function publish() {
    if (sending) return;
    setSending(true);
    setDraftError("");
    setNotice("");
    try {
      const signature = JSON.stringify({
        body,
        kind,
        source,
        poll,
        options,
        duration,
        image: file ? [file.name, file.size, file.lastModified] : null,
      });
      if (request.current.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() };
      const form = new FormData();
      form.set("clientRequestId", request.current.id);
      form.set("audience", leagueId ? "LEAGUE" : "PUBLIC");
      if (leagueId) form.set("leagueId", leagueId);
      form.set("body", body);
      form.set("kind", kind);
      if (source.trim()) form.set("sourceUrl", source.trim());
      if (file) form.set("image", file);
      if (poll) {
        form.set("pollOptions", JSON.stringify(options));
        form.set("pollDurationHours", duration);
      }
      await authenticatedUpload("/arena-talk/posts", form);
      setBody("");
      setSource("");
      setFile(null);
      setPoll(false);
      setOptions(["", ""]);
      if (fileInput.current) fileInput.current.value = "";
      request.current = { signature: "", id: "" };
      setNotice("Your post is live.");
      await load();
    } catch (err) {
      setDraftError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }
  function update(post: ArenaPost) {
    setPosts((old) => old.map((p) => (p.id === post.id ? post : p)));
  }
  return (
    <div className="arena-feed">
      <section className="community-panel arena-composer">
        <div className="community-between">
          <h2>Start a conversation</h2>
          <span className="audience-pill">
            {leagueId ? "♧ League only" : "◎ All members"}
          </span>
        </div>
        <p className="community-muted">
          Posting to <strong>{leagueName}</strong>. Football, match moments and
          respectful debate belong here.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void publish();
          }}
        >
          <fieldset disabled={sending}>
            <label>
              Post type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="DISCUSSION">Discussion</option>
                <option value="QUESTION">Question</option>
                <option value="NEWS">News · source required</option>
                <option value="RUMOUR">Rumour · unverified</option>
              </select>
            </label>
            <label className="sr-only" htmlFor="arena-body">
              Your post
            </label>
            <textarea
              id="arena-body"
              required
              maxLength={2000}
              rows={4}
              placeholder="What’s happening in your football world?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <small>{body.length}/2000 characters</small>
            <details open={kind === "NEWS" ? true : undefined}>
              <summary>
                Source link{kind === "NEWS" ? " (required)" : " (optional)"}
              </summary>
              <label>
                HTTPS source URL
                <input
                  type="url"
                  pattern="https://.*"
                  required={kind === "NEWS"}
                  maxLength={2048}
                  value={source}
                  placeholder="https://…"
                  onChange={(e) => setSource(e.target.value)}
                />
              </label>
            </details>
            <div className="community-actions">
              <label className="community-button">
                Attach image
                <input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected && selected.size > 5 * 1024 * 1024) {
                      setDraftError("Choose an image smaller than 5 MB.");
                      e.target.value = "";
                      return;
                    }
                    setDraftError("");
                    setFile(selected || null);
                  }}
                />
              </label>
              <button
                className="community-button"
                type="button"
                aria-pressed={poll}
                onClick={() => setPoll(!poll)}
              >
                {poll ? "Remove poll" : "Add a poll"}
              </button>
            </div>
            {preview && (
              <div className="arena-preview">
                <img src={preview} alt="Selected attachment preview" />
                <button
                  type="button"
                  className="community-button"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Remove image
                </button>
              </div>
            )}
            {poll && (
              <div className="composer-poll">
                <h3>Your poll</h3>
                {options.map((option, i) => (
                  <label key={i}>
                    Option {i + 1}
                    <input
                      value={option}
                      maxLength={100}
                      required
                      onChange={(e) =>
                        setOptions((old) =>
                          old.map((o, index) =>
                            index === i ? e.target.value : o,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <div className="community-actions">
                  {options.length < 4 && (
                    <button
                      type="button"
                      className="community-button"
                      onClick={() => setOptions([...options, ""])}
                    >
                      Add option
                    </button>
                  )}
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="community-button"
                      onClick={() => setOptions(options.slice(0, -1))}
                    >
                      Remove last option
                    </button>
                  )}
                </div>
                <label>
                  Poll duration
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  >
                    <option value="24">24 hours</option>
                    <option value="72">3 days</option>
                    <option value="168">7 days</option>
                  </select>
                </label>
              </div>
            )}
            <div className="community-between">
              <small>Posts and likes do not earn XP.</small>
              <button
                className="community-button primary"
                disabled={!body.trim()}
              >
                {sending ? "Publishing…" : "Publish post ↗"}
              </button>
            </div>
          </fieldset>
          {draftError && (
            <p role="alert" className="community-error">
              {draftError} Your draft is saved on this screen.
            </p>
          )}
          {notice && (
            <p className="community-success" role="status">
              {notice}
            </p>
          )}
        </form>
      </section>
      <div className="community-between">
        <h2>{leagueName}</h2>
        <button
          className="community-button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Refreshing…" : "Refresh feed"}
        </button>
      </div>
      {error && (
        <div className="community-error" role="alert">
          {error}
          <button onClick={() => void load()}>Try again</button>
        </div>
      )}
      {!ready && !error && <p role="status">Loading conversations…</p>}
      {ready && !posts.length && (
        <div className="community-panel arena-empty">
          <span aria-hidden="true">◉</span>
          <h3>The pitch is yours.</h3>
          <p>
            Be the first to start a conversation here.
            {leagueId
              ? " Verified match results will also appear in this league feed."
              : ""}
          </p>
        </div>
      )}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          update={update}
          refresh={() => void load()}
          remove={() => setPosts((old) => old.filter((p) => p.id !== post.id))}
        />
      ))}
      {cursor && (
        <button
          className="community-button arena-load-more"
          disabled={loading}
          onClick={() => void load(true)}
        >
          {loading ? "Loading…" : "Load more conversations"}
        </button>
      )}
    </div>
  );
}

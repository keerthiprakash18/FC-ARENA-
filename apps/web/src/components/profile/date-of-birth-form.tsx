"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";
import { todayForBirthDate, validDateOfBirth } from "@/lib/date-of-birth";

export function DateOfBirthForm({
  user,
  onSaved,
}: {
  user: CurrentUser;
  onSaved: (value: string) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(user.dateOfBirth ?? "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  function saved(date: string) {
    setMessage("Date of birth saved.");
    window.dispatchEvent(
      new CustomEvent("fc-arena:birth-date-saved", {
        detail: { userId: user.id, dateOfBirth: date },
      }),
    );
    onSaved(date);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validDateOfBirth(value)) {
      setError("Enter a real date of birth between 1 January 1900 and today.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedRequest<{
        data: { dateOfBirth: string };
      }>("/auth/me/date-of-birth", {
        method: "PATCH",
        body: JSON.stringify({ dateOfBirth: value }),
      });
      saved(response.data.dateOfBirth);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      if (
        caught instanceof ApiError &&
        [0, 408, 500, 502, 503, 504].includes(caught.status)
      ) {
        const current = await getCurrentUser().catch(() => null);
        if (current?.id === user.id && current.dateOfBirth === value) {
          saved(value);
          return;
        }
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save your date of birth. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="theme-panel grid max-w-xl gap-4 rounded-2xl border p-5 sm:p-6"
    >
      <label
        className="theme-text grid gap-2 text-sm font-bold"
        htmlFor="player-date-of-birth"
      >
        Date of birth
        <input
          id="player-date-of-birth"
          name="dateOfBirth"
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={todayForBirthDate()}
          required
          disabled={busy}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setMessage("");
          }}
          className="theme-input min-h-12 min-w-0 rounded-xl border px-4 py-3"
        />
      </label>
      <p className="theme-muted text-sm">
        Your date of birth stays private in your account. It is not shown on
        public player profiles.
      </p>
      {error ? (
        <p role="alert" className="theme-muted text-sm">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="theme-muted text-sm">
          {message}
        </p>
      ) : null}
      <button
        disabled={busy}
        className="theme-primary-button min-h-12 rounded-xl border px-5 py-3 text-sm font-bold disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save date of birth"}
      </button>
    </form>
  );
}

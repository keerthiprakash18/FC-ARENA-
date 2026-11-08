"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getCurrentUser,
  peekCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";

export function DateOfBirthReminder({
  currentUser,
}: {
  currentUser?: CurrentUser;
}) {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState<CurrentUser | null>(() =>
    peekCurrentUser(),
  );
  const [savedUserId, setSavedUserId] = useState("");
  const user = currentUser ?? loaded;
  useEffect(() => {
    const controller = new AbortController();
    if (!currentUser)
      void getCurrentUser({ signal: controller.signal })
        .then((value) => {
          if (!controller.signal.aborted) setLoaded(value);
        })
        .catch(() => {});
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId) setSavedUserId(detail.userId);
    };
    window.addEventListener("fc-arena:birth-date-saved", saved);
    return () => {
      controller.abort();
      window.removeEventListener("fc-arena:birth-date-saved", saved);
    };
  }, [currentUser]);
  if (
    !user ||
    user.dateOfBirth !== null ||
    savedUserId === user.id ||
    pathname === "/profile/date-of-birth"
  )
    return null;
  return (
    <aside
      aria-label="Date of birth reminder"
      className="theme-panel mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
    >
      <div>
        <p className="theme-text text-sm font-bold">
          Complete your player profile
        </p>
        <p className="theme-muted mt-1 text-sm">
          Please add your date of birth to your account.
        </p>
      </div>
      <Link
        href="/profile/date-of-birth"
        className="theme-primary-button inline-flex min-h-11 items-center rounded-xl border px-4 py-3 text-sm font-bold"
      >
        Add date of birth
      </Link>
    </aside>
  );
}

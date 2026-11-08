"use client";

import { useEffect, useRef, useState } from "react";

type Scores = {
  homeScore: string;
  awayScore: string;
  homePenaltyScore: string;
  awayPenaltyScore: string;
};
type Draft = {
  context: string;
  updatedAt: number;
  manual: Scores;
  ocr: Scores & { extractionId: string };
};
const emptyScores = (): Scores => ({
  homeScore: "",
  awayScore: "",
  homePenaltyScore: "",
  awayPenaltyScore: "",
});
const emptyDraft = (context: string): Draft => ({
  context,
  updatedAt: Date.now(),
  manual: emptyScores(),
  ocr: { ...emptyScores(), extractionId: "" },
});
const maxAge = 7 * 86400_000;
const validScores = (value: unknown): value is Scores =>
  Boolean(
    value &&
    typeof value === "object" &&
    Object.keys(emptyScores()).every(
      (key) =>
        typeof (value as Record<string, unknown>)[key] === "string" &&
        String((value as Record<string, unknown>)[key]).length <= 4,
    ),
  );
let database: Promise<IDBDatabase> | undefined;
let writes: Promise<unknown> = Promise.resolve();

function db() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fcarena-result-drafts", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("drafts");
        request.result.createObjectStore("files");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        database = undefined;
        reject(new Error("Draft storage is unavailable."));
      };
    });
  return database;
}

async function transaction<T>(
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction, done: (value: T) => void) => void,
) {
  const connection = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = connection.transaction(["drafts", "files"], mode);
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onerror = tx.onabort = () =>
      reject(tx.error ?? new Error("Draft could not be saved."));
    run(tx, (result) => {
      value = result;
    });
  });
}

function enqueue<T>(task: () => Promise<T>) {
  const result = writes.then(task, task);
  writes = result.catch(() => {});
  return result;
}

async function read(key: string, context: string) {
  await writes;
  return transaction<{ draft: Draft; file: File | null; restored: boolean }>(
    "readwrite",
    (tx, done) => {
      const drafts = tx.objectStore("drafts"),
        files = tx.objectStore("files");
      let draft: Draft | undefined,
        file: File | null = null;
      const a = drafts.get(key),
        b = files.get(key);
      a.onsuccess = () => {
        draft = a.result as Draft | undefined;
      };
      b.onsuccess = () => {
        file = b.result instanceof File ? b.result : null;
      };
      // Expire old drafts and screenshots together; never retain them indefinitely.
      const cursor = drafts.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) {
          if (
            !item.value?.updatedAt ||
            Date.now() - item.value.updatedAt > maxAge
          ) {
            files.delete(item.key);
            item.delete();
          }
          item.continue();
          return;
        }
        const valid =
          draft &&
          validScores(draft.manual) &&
          validScores(draft.ocr) &&
          typeof draft.ocr.extractionId === "string" &&
          draft.context === context &&
          Number.isFinite(draft.updatedAt) &&
          draft.updatedAt <= Date.now() &&
          Date.now() - draft.updatedAt <= maxAge;
        if (!valid) {
          drafts.delete(key);
          files.delete(key);
        }
        done({
          draft: valid ? draft! : emptyDraft(context),
          file:
            valid &&
            file &&
            file.size <= 10 * 1024 * 1024 &&
            ["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ? file
              : null,
          restored: Boolean(valid),
        });
      };
    },
  );
}

/** Drafts belong to one authenticated account, match and fixture pairing. No credentials are stored. */
export function useResultDraft(key: string, context: string) {
  const [state, setState] = useState<{
    key: string;
    draft: Draft;
    file: File | null;
    ready: boolean;
    status: string;
  }>({ key: "", draft: emptyDraft(""), file: null, ready: false, status: "" });
  const current = useRef(state);
  const revision = useRef(0);
  useEffect(() => {
    if (!key) return;
    revision.current++;
    let active = true;
    const initial = {
      key,
      draft: emptyDraft(context),
      file: null,
      ready: true,
      status: "",
    };
    void read(key, context)
      .then((value) => {
        if (!active) return;
        current.current = {
          ...initial,
          ...value,
          status: value.restored ? "Draft restored on this device." : "",
        };
        setState(current.current);
      })
      .catch(() => {
        if (!active) return;
        current.current = {
          ...initial,
          status:
            "Draft storage is unavailable. Keep this page open until you submit.",
        };
        setState(current.current);
      });
    return () => {
      active = false;
    };
  }, [key, context]);

  function commit(
    next: Draft,
    file: File | null = current.current.file,
    fileChanged = false,
  ) {
    if (current.current.key !== key || !current.current.ready) return;
    const seq = ++revision.current;
    next.updatedAt = Date.now();
    current.current = {
      key,
      draft: next,
      file,
      ready: true,
      status: "Saving draft…",
    };
    setState(current.current);
    void enqueue(() =>
      transaction<void>("readwrite", (tx, done) => {
        tx.objectStore("drafts").put(next, key);
        if (fileChanged) {
          if (file) tx.objectStore("files").put(file, key);
          else tx.objectStore("files").delete(key);
        }
        done();
      }),
    )
      .then(() => {
        if (seq !== revision.current || current.current.key !== key) return;
        current.current = {
          ...current.current,
          status: "Draft saved on this device.",
        };
        setState(current.current);
      })
      .catch(() => {
        if (seq !== revision.current || current.current.key !== key) return;
        current.current = {
          ...current.current,
          status:
            "Could not save this draft. Keep this page open until you submit.",
        };
        setState(current.current);
      });
  }
  function clear() {
    revision.current++;
    current.current = {
      key,
      draft: emptyDraft(context),
      file: null,
      ready: true,
      status: "",
    };
    setState(current.current);
    void enqueue(() =>
      transaction<void>("readwrite", (tx, done) => {
        tx.objectStore("drafts").delete(key);
        tx.objectStore("files").delete(key);
        done();
      }),
    ).catch(() => {
      if (current.current.key === key) {
        current.current = {
          ...current.current,
          status: "Could not remove the saved draft from this device.",
        };
        setState(current.current);
      }
    });
  }
  const ready =
    state.key === key && state.draft.context === context && state.ready;
  return {
    ready,
    manual: ready ? state.draft.manual : emptyScores(),
    ocr: ready ? state.draft.ocr : { ...emptyScores(), extractionId: "" },
    file: ready ? state.file : null,
    status: ready ? state.status : "Loading saved draft…",
    clear,
    setManual: (field: keyof Scores, value: string) =>
      commit({
        ...current.current.draft,
        manual: { ...current.current.draft.manual, [field]: value },
      }),
    setOcr: (extractionId: string, fields: Partial<Scores>) =>
      commit({
        ...current.current.draft,
        ocr: {
          ...(current.current.draft.ocr.extractionId === extractionId
            ? current.current.draft.ocr
            : emptyScores()),
          ...fields,
          extractionId,
        },
      }),
    setFile: (file: File | null) =>
      commit({ ...current.current.draft }, file, true),
  };
}

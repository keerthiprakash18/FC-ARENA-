"use client";
import { useEffect, useState } from "react";
import { authenticatedRequest } from "@/lib/auth-client";
type NativePush = {
  supported: boolean;
  configured: boolean;
  enabled: boolean;
  token: string;
  error: string;
};
declare global {
  interface Window {
    __fcPush?: NativePush;
  }
}
let boundToken = "";
let bindingGeneration = 0;
let registering: Promise<void> | null = null;
async function bind() {
  const native = window.__fcPush;
  if (!native?.enabled || !native.token || native.token === boundToken) return;
  if (registering) return registering;
  const generation = bindingGeneration;
  const pending = authenticatedRequest("/notifications/push/register", {
    method: "POST",
    body: JSON.stringify({ token: native.token }),
  })
    .then(() => {
      if (generation !== bindingGeneration) return;
      boundToken = native.token;
      window.dispatchEvent(new Event("fc-arena:push-bound"));
    })
    .finally(() => {
      if (registering === pending) {
        registering = null;
        if (generation === bindingGeneration && window.__fcPush?.enabled
            && window.__fcPush.token !== native.token) void bind().catch(() => {});
      }
    });
  registering = pending;
  return pending;
}
export function PushSync() {
  useEffect(() => {
    const sync = () => {
      void bind().catch(() => {});
    };
    const reset = () => {
      bindingGeneration++;
      boundToken = "";
      registering = null;
    };
    sync();
    window.addEventListener("fc-arena:native-push", sync);
    window.addEventListener("fc-arena:signed-out", reset);
    window.addEventListener("fc-arena:signed-in", sync);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("fc-arena:native-push", sync);
      window.removeEventListener("fc-arena:signed-out", reset);
      window.removeEventListener("fc-arena:signed-in", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);
  return null;
}
export function PhonePushSettings() {
  const [native, setNative] = useState<NativePush | null>(null);
  const [configured, setConfigured] = useState(false);
  const [backendBound, setBackendBound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const sync = () => {
      setNative(window.__fcPush ?? null);
      if (window.__fcPush?.error) setMessage(window.__fcPush.error);
    };
    sync();
    window.addEventListener("fc-arena:native-push", sync);
    void authenticatedRequest<{
      data: {
        configured: boolean;
        bound: boolean;
      };
    }>("/notifications/push/status")
      .then((result) => {
        if (active) {
          setConfigured(result.data.configured);
          setBackendBound(result.data.bound);
        }
      })
      .catch(() => {
        if (active)
          setMessage("Unable to check phone notifications. Reload to retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("fc-arena:native-push", sync);
    };
  }, []);
  useEffect(() => {
    if (!native?.enabled) return;
    let active = true;
    void bind()
      .then(() => {
        if (active)
          setMessage("Phone notifications enabled for this signed-in account.");
      })
      .catch(() => {
        if (active)
          setMessage(
            "Could not register this device. Sign in again and retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [native]);
  async function disable() {
    setBusy(true);
    try {
      // Remove every backend token associated with this authenticated refresh
      // session even if Android cannot currently return its FCM token.
      await authenticatedRequest("/notifications/push/disable-session", {
        method: "POST",
      });
      boundToken = "";
      setBackendBound(false);
      window.location.href = "/native/push-disable";
      setMessage("Phone notifications disabled.");
    } catch {
      setMessage("Unable to disable. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="theme-panel rounded-xl p-5">
      <h2 className="font-semibold">Phone notifications</h2>
      <p className="mt-2 text-sm">
        Match reminders and competition updates, even when the app is closed.
        Notifications stop when you sign out.
      </p>
      {loading ? (
        <p className="mt-3 text-sm">Checking availability…</p>
      ) : !native?.supported ? (
        <p className="mt-3 text-sm">
          Available in the updated FC ARENA Android app. You can still read all
          updates here.
        </p>
      ) : !native.configured || !configured ? (
        <p className="mt-3 text-sm">
          Phone notifications are not available in this release yet. In-app
          updates remain available.
        </p>
      ) : (
        <button
          disabled={busy}
          className="theme-primary-button mt-4 rounded-lg px-4 py-3 text-sm"
          onClick={() => {
            if (native.enabled || backendBound) void disable();
            else window.location.href = "/native/push-enable";
          }}
        >
          {busy
            ? "Updating…"
            : native.enabled || backendBound
              ? "Disable phone notifications"
              : "Enable phone notifications"}
        </button>
      )}
      <p role="status" className="mt-2 text-sm">
        {message}
      </p>
    </section>
  );
}

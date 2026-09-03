/**
 * Bind lifecycle events for a view that renders partner PII. Hidden/frozen
 * documents are invalidated immediately; a visible or bfcache-restored view
 * must revalidate its HttpOnly server session before rendering again.
 */
export function bindPartnerViewLifecycle(
  browserWindow,
  browserDocument,
  { invalidate, revalidate }
) {
  if (
    !browserWindow ||
    !browserDocument ||
    typeof browserWindow.addEventListener !== "function" ||
    typeof browserDocument.addEventListener !== "function" ||
    typeof invalidate !== "function" ||
    typeof revalidate !== "function"
  ) {
    return () => {};
  }

  const onPageHide = () => invalidate("pagehide");
  const onPageShow = (event) => {
    if (event?.persisted === true) revalidate("pageshow-persisted");
  };
  const onVisibilityChange = () => {
    if (browserDocument.visibilityState === "hidden") {
      invalidate("hidden");
    } else if (browserDocument.visibilityState === "visible") {
      revalidate("visible");
    }
  };
  const onFocus = () => revalidate("focus");

  browserWindow.addEventListener("pagehide", onPageHide);
  browserWindow.addEventListener("pageshow", onPageShow);
  browserWindow.addEventListener("focus", onFocus);
  browserDocument.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    browserWindow.removeEventListener("pagehide", onPageHide);
    browserWindow.removeEventListener("pageshow", onPageShow);
    browserWindow.removeEventListener("focus", onFocus);
    browserDocument.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

const PARTNER_SESSION_CHANNEL = "rtm-partner-session-v1";
const PARTNER_SESSION_SIGNAL_KEY = "rtm_partner_session_signal";
const PARTNER_TAB_ID = (() => {
  try {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}:${Math.random()}`;
  } catch {
    return `${Date.now()}:${Math.random()}`;
  }
})();

export function bindPartnerCrossTabSession(browserWindow, invalidate) {
  if (!browserWindow || typeof invalidate !== "function") return () => {};
  const onSignal = (event) => {
    if (event?.data?.source === PARTNER_TAB_ID) return;
    invalidate("cross-tab-session-change");
  };
  let channel = null;
  try {
    const Channel = browserWindow.BroadcastChannel || globalThis.BroadcastChannel;
    if (typeof Channel === "function") {
      channel = new Channel(PARTNER_SESSION_CHANNEL);
      channel.addEventListener("message", onSignal);
    }
  } catch {
    channel = null;
  }
  const onStorage = (event) => {
    if (event?.key === PARTNER_SESSION_SIGNAL_KEY) onSignal();
  };
  browserWindow.addEventListener?.("storage", onStorage);
  return () => {
    try {
      channel?.removeEventListener("message", onSignal);
      channel?.close();
    } catch {
      // Best-effort coordination never becomes an authentication dependency.
    }
    browserWindow.removeEventListener?.("storage", onStorage);
  };
}

export function announcePartnerSessionChange(browserWindow = globalThis.window) {
  let sent = false;
  try {
    const Channel = browserWindow?.BroadcastChannel || globalThis.BroadcastChannel;
    if (typeof Channel === "function") {
      const channel = new Channel(PARTNER_SESSION_CHANNEL);
      channel.postMessage({ type: "partner-session-change", source: PARTNER_TAB_ID });
      channel.close();
      sent = true;
    }
  } catch {
    sent = false;
  }
  if (!sent) {
    try {
      const value = `${Date.now()}:${Math.random()}`;
      browserWindow?.localStorage?.setItem(PARTNER_SESSION_SIGNAL_KEY, value);
      browserWindow?.localStorage?.removeItem(PARTNER_SESSION_SIGNAL_KEY);
    } catch {
      // The cookie fingerprint check still fails closed before each request.
    }
  }
}

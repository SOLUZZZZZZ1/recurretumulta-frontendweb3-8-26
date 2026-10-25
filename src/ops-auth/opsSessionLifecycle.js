const MAX_TIMER_DELAY_MS = 2_147_000_000;

/**
 * A page restored from BFCache retains its JavaScript heap and rendered DOM.
 * OPS views therefore discard the in-memory session before the document is
 * frozen and only reveal a fresh, signed-out render after restoration.
 */
export function bindOpsSessionLifecycle(browserWindow, { invalidate, restore }) {
  if (
    !browserWindow ||
    typeof browserWindow.addEventListener !== "function" ||
    typeof invalidate !== "function" ||
    typeof restore !== "function"
  ) {
    return () => {};
  }

  const onPageHide = () => invalidate("pagehide");
  const onPageShow = (event) => {
    if (event?.persisted === true) restore("pageshow-persisted");
  };

  browserWindow.addEventListener("pagehide", onPageHide);
  browserWindow.addEventListener("pageshow", onPageShow);
  return () => {
    browserWindow.removeEventListener("pagehide", onPageHide);
    browserWindow.removeEventListener("pageshow", onPageShow);
  };
}

/**
 * Schedule an in-memory session deadline without relying on a single timeout
 * larger than the browser's signed 32-bit timer range.
 */
export function scheduleOpsSessionExpiry(
  expiresAt,
  expire,
  {
    now = () => Date.now(),
    setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimer = (timer) => globalThis.clearTimeout(timer),
  } = {}
) {
  if (typeof expire !== "function") return () => {};
  const deadline = typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
  let timer = null;
  let cancelled = false;

  const arm = () => {
    if (cancelled) return;
    const current = Number(now());
    const remaining = deadline - current;
    if (!Number.isFinite(deadline) || !Number.isFinite(current) || remaining <= 0) {
      expire("session-expired");
      return;
    }
    timer = setTimer(arm, Math.min(remaining, MAX_TIMER_DELAY_MS));
  };

  arm();
  return () => {
    cancelled = true;
    if (timer !== null) clearTimer(timer);
  };
}

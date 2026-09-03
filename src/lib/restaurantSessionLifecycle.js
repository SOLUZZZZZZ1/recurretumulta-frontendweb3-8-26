/**
 * Memory-only credentials and reservation PII must not survive a page exit or
 * a restoration from the back-forward cache. The caller clears React state;
 * this helper only owns browser lifecycle wiring so it can be tested without a
 * DOM renderer.
 */
export function bindRestaurantSessionLifecycle(browserWindow, invalidate) {
  if (
    !browserWindow ||
    typeof browserWindow.addEventListener !== "function" ||
    typeof browserWindow.removeEventListener !== "function" ||
    typeof invalidate !== "function"
  ) {
    return () => {};
  }

  const onPageHide = () => invalidate("pagehide");
  const onPageShow = (event) => {
    if (event?.persisted === true) invalidate("pageshow-persisted");
  };

  browserWindow.addEventListener("pagehide", onPageHide);
  browserWindow.addEventListener("pageshow", onPageShow);
  return () => {
    browserWindow.removeEventListener("pagehide", onPageHide);
    browserWindow.removeEventListener("pageshow", onPageShow);
  };
}

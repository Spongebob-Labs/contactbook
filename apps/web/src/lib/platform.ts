/**
 * Platform checks for features that only exist on some devices.
 *
 * Kept deliberately small and honest. User-agent sniffing is unreliable —
 * notably iPadOS reports itself as Macintosh — so these are used to decide
 * whether to *offer* something, never to gate correctness.
 */

export function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;

  if (/iPhone|iPod/.test(ua)) {
    return true;
  }

  // iPadOS 13+ presents a desktop Safari UA. A Mac with a touchscreen does not
  // exist, so touch points disambiguate iPad from a real Macintosh.
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIpad) {
    return true;
  }

  // Wallet exists on macOS too, so a Mac can legitimately take a pass.
  return /Macintosh|Mac OS X/.test(ua);
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);
}

/** Already launched from a home-screen icon rather than a browser tab. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari's non-standard flag, still the only signal on iOS.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

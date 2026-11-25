/**
 * Lightweight client-side browser, OS, and device category detector.
 * Formats match enterprise UI requirements:
 * - "Chrome · Windows"
 * - "Microsoft Edge · Windows"
 * - "Safari · macOS"
 * - "Chrome · Android · Mobile"
 */
type BrowserNavigator = Navigator & {
  brave?: { isBrave(): Promise<boolean> };
  userAgentData?: { brands?: readonly { brand: string }[] };
};

export const getDeviceDescription = async (): Promise<string> => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "Desktop";
  }

  const ua = navigator.userAgent || "";
  const lowerUa = ua.toLowerCase();
  const browserNavigator = navigator as BrowserNavigator;
  const brands = browserNavigator.userAgentData?.brands ?? [];
  let isBrave = /\bbrave\b/.test(lowerUa) || brands.some(({ brand }) => brand === "Brave");
  if (!isBrave) {
    try {
      isBrave = (await browserNavigator.brave?.isBrave()) === true;
    } catch {
      // Browser identification is optional and must not prevent login.
    }
  }

  // 1. Detect Browser
  let browser = "Browser";
  if (isBrave) {
    browser = "Brave";
  } else if (lowerUa.includes("edg/") || lowerUa.includes("edge/")) {
    browser = "Microsoft Edge";
  } else if (lowerUa.includes("opr/") || lowerUa.includes("opera/")) {
    browser = "Opera";
  } else if (lowerUa.includes("crios/") || brands.some(({ brand }) => brand === "Google Chrome")) {
    browser = "Chrome";
  } else if (lowerUa.includes("chrome/") || lowerUa.includes("chromium/")) {
    browser = "Chromium";
  } else if (lowerUa.includes("firefox/") || lowerUa.includes("fxios/")) {
    browser = "Firefox";
  } else if (lowerUa.includes("safari/") && (lowerUa.includes("version/") || lowerUa.includes("mobile/"))) {
    browser = "Safari";
  } else if (lowerUa.includes("trident/") || lowerUa.includes("msie")) {
    browser = "Internet Explorer";
  }

  // 2. Detect Operating System
  let os = "OS";
  if (lowerUa.includes("windows 11")) {
    os = "Windows 11";
  } else if (lowerUa.includes("windows nt 6.3")) {
    os = "Windows 8.1";
  } else if (lowerUa.includes("windows nt 6.1")) {
    os = "Windows 7";
  } else if (lowerUa.includes("windows")) {
    os = "Windows";
  } else if (lowerUa.includes("android")) {
    os = "Android";
  } else if (lowerUa.includes("iphone") || lowerUa.includes("ipad") || lowerUa.includes("ipod")) {
    os = "iOS";
  } else if (lowerUa.includes("macintosh") || lowerUa.includes("mac os x")) {
    os = "macOS";
  } else if (lowerUa.includes("linux")) {
    os = "Linux";
  }

  // 3. Detect Device Category
  let category: "Desktop" | "Mobile" | "Tablet" = "Desktop";
  if (
    lowerUa.includes("ipad") ||
    lowerUa.includes("tablet") ||
    (lowerUa.includes("android") && !lowerUa.includes("mobile"))
  ) {
    category = "Tablet";
  } else if (
    lowerUa.includes("mobile") ||
    lowerUa.includes("iphone") ||
    lowerUa.includes("ipod") ||
    lowerUa.includes("phone")
  ) {
    category = "Mobile";
  }

  if (category === "Mobile" || category === "Tablet") {
    return `${browser} · ${os} · ${category}`;
  }

  return `${browser} · ${os}`;
};

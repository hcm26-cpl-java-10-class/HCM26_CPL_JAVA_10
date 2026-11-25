package com.example.starter_project_2025.system.auth.util;

import org.springframework.util.StringUtils;

public final class DeviceUtil {

    private DeviceUtil() {}

    public static String parse(String userAgent) {
        if (!StringUtils.hasText(userAgent)) {
            return null;
        }

        String ua = userAgent.trim();
        String lowerUa = ua.toLowerCase();

        String browser = detectBrowser(ua, lowerUa);
        String os = detectOS(ua, lowerUa);
        String category = detectCategory(lowerUa);

        if ("Mobile".equalsIgnoreCase(category) || "Tablet".equalsIgnoreCase(category)) {
            return browser + " · " + os + " · " + category;
        }

        return browser + " · " + os;
    }

    private static String detectBrowser(String ua, String lowerUa) {
        if (lowerUa.contains("edg/") || lowerUa.contains("edge/")) {
            return "Microsoft Edge";
        }
        if (lowerUa.contains("opr/") || lowerUa.contains("opera/")) {
            return "Opera";
        }
        if (lowerUa.contains("chrome/") || lowerUa.contains("crios/")) {
            return "Chrome";
        }
        if (lowerUa.contains("firefox/") || lowerUa.contains("fxios/")) {
            return "Firefox";
        }
        if (lowerUa.contains("safari/") && (lowerUa.contains("version/") || lowerUa.contains("mobile/"))) {
            return "Safari";
        }
        if (lowerUa.contains("trident/") || lowerUa.contains("msie")) {
            return "Internet Explorer";
        }
        return "Browser";
    }

    private static String detectOS(String ua, String lowerUa) {
        if (lowerUa.contains("windows nt 10.0")) {
            return "Windows 11";
        }
        if (lowerUa.contains("windows nt 6.3")) {
            return "Windows 8.1";
        }
        if (lowerUa.contains("windows nt 6.2")) {
            return "Windows 8";
        }
        if (lowerUa.contains("windows nt 6.1")) {
            return "Windows 7";
        }
        if (lowerUa.contains("windows")) {
            return "Windows";
        }
        if (lowerUa.contains("android")) {
            return "Android";
        }
        if (lowerUa.contains("iphone") || lowerUa.contains("ipad") || lowerUa.contains("ipod")) {
            return "iOS";
        }
        if (lowerUa.contains("macintosh") || lowerUa.contains("mac os x")) {
            return "macOS";
        }
        if (lowerUa.contains("linux")) {
            return "Linux";
        }
        return "Unknown OS";
    }

    private static String detectCategory(String lowerUa) {
        if (lowerUa.contains("ipad") || lowerUa.contains("tablet") || (lowerUa.contains("android") && !lowerUa.contains("mobile"))) {
            return "Tablet";
        }
        if (lowerUa.contains("mobile") || lowerUa.contains("iphone") || lowerUa.contains("ipod") || lowerUa.contains("phone")) {
            return "Mobile";
        }
        return "Desktop";
    }
}

package com.example.starter_project_2025.util;

import com.example.starter_project_2025.system.auth.util.DeviceUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class DeviceUtilTest {

    @Test
    @DisplayName("parse - Should return null for blank userAgent")
    void parse_BlankUserAgent_ShouldReturnNull() {
        assertNull(DeviceUtil.parse(null));
        assertNull(DeviceUtil.parse("   "));
    }

    @Test
    @DisplayName("parse - Should detect Chrome on Windows 11")
    void parse_ChromeWindows_ShouldParse() {
        String ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        assertEquals("Chrome · Windows 11", DeviceUtil.parse(ua));
    }

    @Test
    @DisplayName("parse - Should detect Microsoft Edge on Windows 11")
    void parse_EdgeWindows_ShouldParse() {
        String ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
        assertEquals("Microsoft Edge · Windows 11", DeviceUtil.parse(ua));
    }

    @Test
    @DisplayName("parse - Should detect Safari on macOS")
    void parse_SafariMac_ShouldParse() {
        String ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15";
        assertEquals("Safari · macOS", DeviceUtil.parse(ua));
    }

    @Test
    @DisplayName("parse - Should detect Chrome on Android Mobile")
    void parse_ChromeAndroidMobile_ShouldParse() {
        String ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
        assertEquals("Chrome · Android · Mobile", DeviceUtil.parse(ua));
    }

    @Test
    @DisplayName("parse - Should detect Safari on iPad Tablet")
    void parse_SafariIpadTablet_ShouldParse() {
        String ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
        assertEquals("Safari · iOS · Tablet", DeviceUtil.parse(ua));
    }
}

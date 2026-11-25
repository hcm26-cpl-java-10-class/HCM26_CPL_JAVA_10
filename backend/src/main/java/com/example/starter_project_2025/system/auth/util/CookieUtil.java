package com.example.starter_project_2025.system.auth.util;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class CookieUtil {

    @Value("${jwt.refresh-token.duration}")
    int REFRESH_TOKEN_DURATION;

    @Value("${jwt.refresh-token.short-duration:86400}")
    int SHORT_REFRESH_TOKEN_DURATION;

    @Value("${app.cookie-secure:false}")
    boolean cookieSecure;

    @Value("${app.cookie-same-site:Lax}")
    String cookieSameSite;

    private static final String REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

    public Optional<String> getRefreshTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();

        return Arrays.stream(request.getCookies())
                .filter(cookie -> REFRESH_TOKEN_COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }

    public void setRefreshTokenCookie(HttpServletResponse response, String token) {
        setRefreshTokenCookie(response, token, true);
    }

    public void setRefreshTokenCookie(HttpServletResponse response, String token, boolean rememberMe) {
        int maxAgeSeconds = rememberMe ? REFRESH_TOKEN_DURATION : SHORT_REFRESH_TOKEN_DURATION;
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/");

        if (rememberMe) {
            builder.maxAge(Duration.ofSeconds(maxAgeSeconds));
        } else {
            // Session cookie when "Remember me" is unchecked; still bounded server-side by DB expiry.
            builder.maxAge(-1);
        }

        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    public void clearRefreshTokenCookie(HttpServletResponse response) {
        ResponseCookie cleared = ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cleared.toString());
    }
}

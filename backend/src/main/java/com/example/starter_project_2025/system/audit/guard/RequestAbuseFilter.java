package com.example.starter_project_2025.system.audit.guard;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Watches every API call. It runs before Spring Security (order -101 < -100) so that 401/403
 * answers produced by the security chain are counted too. It never blocks a request itself: it
 * only raises a {@link SecurityAlert}; blocking is an admin decision.
 */
@Component
@Order(-101)
@RequiredArgsConstructor
public class RequestAbuseFilter extends OncePerRequestFilter {

    /** Request attributes filled in by JwtAuthenticationFilter. */
    public static final String ATTR_USER_ID = "guard.userId";
    public static final String ATTR_USER_EMAIL = "guard.userEmail";
    public static final String ATTR_SKIP = "guard.skip";

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestAbuseFilter.class);

    private final RequestAbuseDetector detector;
    private final SecurityAlertService alertService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();

        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || path == null
                || !path.startsWith("/api/")
                || path.startsWith("/api/security-alerts");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            filterChain.doFilter(request, response);
        } finally {
            inspect(request, response);
        }
    }

    private void inspect(HttpServletRequest request, HttpServletResponse response) {
        try {
            if (Boolean.TRUE.equals(request.getAttribute(ATTR_SKIP))) {
                return;
            }

            String email = (String) request.getAttribute(ATTR_USER_EMAIL);
            Long userId = (Long) request.getAttribute(ATTR_USER_ID);
            String ip = clientIp(request);
            String key = email != null ? "user:" + email : "ip:" + ip;

            detector.record(key, response.getStatus()).ifPresent(detection ->
                    alertService.raise(
                            detection, key, userId, email, ip, request.getRequestURI()));
        } catch (RuntimeException ex) {
            // Monitoring must never break a real request.
            LOGGER.warn("Abuse inspection failed: {}", ex.getMessage());
        }
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");

        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }
}

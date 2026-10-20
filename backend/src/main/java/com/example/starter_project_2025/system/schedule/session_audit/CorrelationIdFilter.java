package com.example.starter_project_2025.system.schedule.session_audit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * T2 / SRS §8.1 — Gắn correlation ID cho mọi request.
 *
 * <p>Nhận {@code X-Correlation-Id} từ client (nếu hợp lệ) hoặc sinh mới, đưa vào MDC
 * và trả lại trong response header để client/log đối chiếu (NFR-OBS, AC T2-06).</p>
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String correlationId = CorrelationContext.sanitize(request.getHeader(CorrelationContext.HEADER));
        if (correlationId == null) {
            correlationId = CorrelationContext.getOrCreate();
        }
        CorrelationContext.set(correlationId);
        MDC.put(CorrelationContext.MDC_KEY, correlationId);
        response.setHeader(CorrelationContext.HEADER, correlationId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(CorrelationContext.MDC_KEY);
            CorrelationContext.clear();
        }
    }
}

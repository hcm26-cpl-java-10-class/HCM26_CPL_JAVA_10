package com.example.starter_project_2025.system.project.sprint;

import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

/**
 * Resolves the correlation id used by sprint audit logs and outbox events.
 * <p>
 * The value is read from the {@code X-Correlation-ID} request header when
 * present, otherwise a UUID is generated once per request and cached as a
 * request attribute so audit logs and outbox events of the same operation share
 * the exact same id.
 */
public final class SprintCorrelationIds {

    public static final String HEADER = "X-Correlation-ID";

    private static final String ATTRIBUTE = SprintCorrelationIds.class.getName() + ".correlationId";

    private SprintCorrelationIds() {
    }

    public static String current() {

        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();

        if (attributes instanceof ServletRequestAttributes servletAttributes) {

            Object cached = servletAttributes.getAttribute(ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);

            if (cached instanceof String value && !value.isBlank()) {
                return value;
            }

            String header = servletAttributes.getRequest().getHeader(HEADER);
            String correlationId = header != null && !header.isBlank()
                    ? header
                    : UUID.randomUUID().toString();

            servletAttributes.setAttribute(ATTRIBUTE, correlationId, RequestAttributes.SCOPE_REQUEST);

            return correlationId;
        }

        return UUID.randomUUID().toString();
    }
}

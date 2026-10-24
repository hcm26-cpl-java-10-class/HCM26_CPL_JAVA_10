package com.example.starter_project_2025.system.project.task;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

public record TaskRequestContext(UUID requestId, String correlationId) {

    public static TaskRequestContext create(UUID requestId, String correlationId) {
        String correlation = correlationId == null || correlationId.isBlank()
                ? UUID.randomUUID().toString() : correlationId.strip();
        if (correlation.length() > 100) {
            throw new TaskValidationException("correlationId", "Correlation ID must not exceed 100 characters");
        }
        TaskRequestContext context = new TaskRequestContext(
                requestId == null ? UUID.randomUUID() : requestId, correlation);
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            attributes.getRequest().setAttribute(TaskRequestContext.class.getName(), context);
        }
        return context;
    }

    public static String currentCorrelationId() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                && attributes.getRequest().getAttribute(TaskRequestContext.class.getName())
                instanceof TaskRequestContext context) {
            return context.correlationId();
        }
        return UUID.randomUUID().toString();
    }
}

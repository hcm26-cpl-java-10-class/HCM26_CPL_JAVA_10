package com.example.starter_project_2025.system.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Optional;
import java.util.UUID;

/**
 * Writes an audit record around every method that has an {@link AuditRule}.
 * Audit failures never break the audited business call.
 */
class AuditRuleInterceptor implements MethodInterceptor {

    private static final Logger log = LoggerFactory.getLogger(AuditRuleInterceptor.class);

    private final AuditRuleRegistry registry;
    private final ObjectProvider<AuditLogService> auditLogService;
    private final ObjectProvider<ObjectMapper> objectMapper;

    AuditRuleInterceptor(
            AuditRuleRegistry registry,
            ObjectProvider<AuditLogService> auditLogService,
            ObjectProvider<ObjectMapper> objectMapper
    ) {
        this.registry = registry;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Object target = invocation.getThis();
        Class<?> targetClass = target != null
                ? target.getClass()
                : invocation.getMethod().getDeclaringClass();

        Optional<AuditRule> rule = registry.find(targetClass, invocation.getMethod());

        if (rule.isEmpty()) {
            return invocation.proceed();
        }

        Object result;

        try {
            result = invocation.proceed();
        } catch (Throwable error) {
            write(rule.get(), invocation, null, error);
            throw error;
        }

        write(rule.get(), invocation, result, null);

        return result;
    }

    private void write(
            AuditRule rule,
            MethodInvocation invocation,
            Object result,
            Throwable error
    ) {
        try {
            AuditInvocation context =
                    new AuditInvocation(invocation.getArguments(), result, error);

            String oldValue = toJson(rule.resolveOldValue(context));
            String newValue = toJson(rule.resolveNewValue(context));
            String correlationId = MDC.get("correlationId");

            if (correlationId == null) {
                correlationId = UUID.randomUUID().toString();
            }

            AuditLogService service = auditLogService.getObject();

            if (rule.hasExplicitActor()) {
                service.logAs(
                        rule.resolveActorId(context),
                        rule.resolveActorEmail(context),
                        rule.action(),
                        rule.resolveEntityType(context),
                        rule.resolveEntityId(context),
                        oldValue,
                        newValue,
                        correlationId,
                        rule.resolveResult(context)
                );
            } else {
                service.log(
                        rule.action(),
                        rule.resolveEntityType(context),
                        rule.resolveEntityId(context),
                        oldValue,
                        newValue,
                        correlationId,
                        rule.resolveResult(context)
                );
            }
        } catch (Exception exception) {
            log.warn(
                    "Failed to write audit log for {}",
                    invocation.getMethod().getName(),
                    exception
            );
        }
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.getObject().writeValueAsString(value);
        } catch (Exception exception) {
            log.warn("Cannot serialize audit data", exception);
            return null;
        }
    }
}

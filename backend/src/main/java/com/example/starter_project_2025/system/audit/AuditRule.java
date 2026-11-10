package com.example.starter_project_2025.system.audit;

import java.util.Objects;
import java.util.function.Function;

/**
 * Describes how a business method is written to the audit log.
 * A rule is plain data, so supporting a new action only means adding a rule (see {@link AuditRuleProvider}).
 */
public final class AuditRule {

    private final String targetClass;
    private final String method;
    private final String action;
    private final Function<AuditInvocation, String> entityType;
    private final Function<AuditInvocation, String> entityId;
    private final Function<AuditInvocation, Object> oldValue;
    private final Function<AuditInvocation, Object> newValue;
    private final Function<AuditInvocation, String> result;
    private final Function<AuditInvocation, Long> actorId;
    private final Function<AuditInvocation, String> actorEmail;

    private AuditRule(Builder builder) {
        this.targetClass = builder.targetClass;
        this.method = builder.method;
        this.action = builder.action;
        this.entityType = builder.entityType;
        this.entityId = builder.entityId;
        this.oldValue = builder.oldValue;
        this.newValue = builder.newValue;
        this.result = builder.result;
        this.actorId = builder.actorId;
        this.actorEmail = builder.actorEmail;
    }

    /**
     * @param targetClass simple name of the class (or of one of its interfaces / parents) that owns the method
     * @param method      method name
     */
    public static Builder on(String targetClass, String method) {
        return new Builder(targetClass, method);
    }

    public String targetClass() {
        return targetClass;
    }

    public String method() {
        return method;
    }

    public String action() {
        return action;
    }

    public String resolveEntityType(AuditInvocation invocation) {
        return entityType.apply(invocation);
    }

    public String resolveEntityId(AuditInvocation invocation) {
        return entityId != null ? entityId.apply(invocation) : null;
    }

    public Object resolveOldValue(AuditInvocation invocation) {
        return oldValue != null ? oldValue.apply(invocation) : null;
    }

    public Object resolveNewValue(AuditInvocation invocation) {
        return newValue != null ? newValue.apply(invocation) : null;
    }

    public String resolveResult(AuditInvocation invocation) {
        String resolved = result != null ? result.apply(invocation) : null;

        if (resolved != null) {
            return resolved;
        }

        return invocation.failed() ? "FAILURE" : "SUCCESS";
    }

    /**
     * True when the actor must come from the call itself (for example before the user is authenticated).
     */
    public boolean hasExplicitActor() {
        return actorId != null || actorEmail != null;
    }

    public Long resolveActorId(AuditInvocation invocation) {
        return actorId != null ? actorId.apply(invocation) : null;
    }

    public String resolveActorEmail(AuditInvocation invocation) {
        return actorEmail != null ? actorEmail.apply(invocation) : null;
    }

    public static final class Builder {

        private final String targetClass;
        private final String method;
        private String action;
        private Function<AuditInvocation, String> entityType;
        private Function<AuditInvocation, String> entityId;
        private Function<AuditInvocation, Object> oldValue;
        private Function<AuditInvocation, Object> newValue;
        private Function<AuditInvocation, String> result;
        private Function<AuditInvocation, Long> actorId;
        private Function<AuditInvocation, String> actorEmail;

        private Builder(String targetClass, String method) {
            this.targetClass = Objects.requireNonNull(targetClass, "targetClass");
            this.method = Objects.requireNonNull(method, "method");
        }

        public Builder action(String action) {
            this.action = action;
            return this;
        }

        public Builder entityType(String entityType) {
            this.entityType = invocation -> entityType;
            return this;
        }

        public Builder entityType(Function<AuditInvocation, String> entityType) {
            this.entityType = entityType;
            return this;
        }

        public Builder entityId(Function<AuditInvocation, String> entityId) {
            this.entityId = entityId;
            return this;
        }

        public Builder oldValue(Function<AuditInvocation, Object> oldValue) {
            this.oldValue = oldValue;
            return this;
        }

        public Builder newValue(Function<AuditInvocation, Object> newValue) {
            this.newValue = newValue;
            return this;
        }

        public Builder result(Function<AuditInvocation, String> result) {
            this.result = result;
            return this;
        }

        public Builder actor(
                Function<AuditInvocation, Long> actorId,
                Function<AuditInvocation, String> actorEmail
        ) {
            this.actorId = actorId;
            this.actorEmail = actorEmail;
            return this;
        }

        public AuditRule build() {
            Objects.requireNonNull(action, "action");
            Objects.requireNonNull(entityType, "entityType");
            return new AuditRule(this);
        }
    }
}

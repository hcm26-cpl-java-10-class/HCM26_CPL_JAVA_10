package com.example.starter_project_2025.system.git_integration.webhook;

/** SY-03: outcome of a handler. Throwing instead means "failed, retry later". */
public record GitWebhookHandlerResult(boolean handled, String note) {

    public static GitWebhookHandlerResult processed() {
        return new GitWebhookHandlerResult(true, null);
    }

    public static GitWebhookHandlerResult processed(String note) {
        return new GitWebhookHandlerResult(true, note);
    }

    /** Valid event, nothing to do (unknown installation, repository not linked, unsupported action…). */
    public static GitWebhookHandlerResult ignored(String reason) {
        return new GitWebhookHandlerResult(false, reason);
    }
}

package com.example.starter_project_2025.system.git_integration.webhook;

/**
 * SY-03: outcome of a handler. Throwing instead means "failed, retry later".
 * SY-06: {@code records} = commits / pull requests / reviews the event carried and the platform
 * processed (null for events that do not carry Git data); {@code partial} = some of them could not
 * be read (e.g. a push with more commits than its payload lists and the API could not read the rest).
 */
public record GitWebhookHandlerResult(boolean handled, String note, Integer records, boolean partial) {

    public static GitWebhookHandlerResult processed() {
        return new GitWebhookHandlerResult(true, null, null, false);
    }

    public static GitWebhookHandlerResult processed(String note) {
        return new GitWebhookHandlerResult(true, note, null, false);
    }

    public static GitWebhookHandlerResult processed(String note, int records) {
        return new GitWebhookHandlerResult(true, note, records, false);
    }

    public static GitWebhookHandlerResult processed(String note, int records, boolean partial) {
        return new GitWebhookHandlerResult(true, note, records, partial);
    }

    /** Valid event, nothing to do (unknown installation, repository not linked, unsupported action…). */
    public static GitWebhookHandlerResult ignored(String reason) {
        return new GitWebhookHandlerResult(false, reason, null, false);
    }
}

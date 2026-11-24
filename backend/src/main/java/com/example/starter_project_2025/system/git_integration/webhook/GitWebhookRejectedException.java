package com.example.starter_project_2025.system.git_integration.webhook;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** SY-03: a webhook request refused before anything is stored. */
@Getter
public class GitWebhookRejectedException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public GitWebhookRejectedException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    static GitWebhookRejectedException disabled() {
        return new GitWebhookRejectedException(HttpStatus.SERVICE_UNAVAILABLE, "GIT_WEBHOOK_DISABLED",
                "GitHub webhooks are not configured on this server");
    }

    static GitWebhookRejectedException signatureMissing() {
        return new GitWebhookRejectedException(HttpStatus.UNAUTHORIZED, "GIT_WEBHOOK_SIGNATURE_MISSING",
                "Missing X-Hub-Signature-256");
    }

    static GitWebhookRejectedException signatureInvalid() {
        return new GitWebhookRejectedException(HttpStatus.UNAUTHORIZED, "GIT_WEBHOOK_SIGNATURE_INVALID",
                "Invalid webhook signature");
    }

    static GitWebhookRejectedException headersInvalid() {
        return new GitWebhookRejectedException(HttpStatus.BAD_REQUEST, "GIT_WEBHOOK_HEADERS_INVALID",
                "Missing or invalid X-GitHub-Delivery / X-GitHub-Event");
    }

    static GitWebhookRejectedException payloadInvalid() {
        return new GitWebhookRejectedException(HttpStatus.BAD_REQUEST, "GIT_WEBHOOK_PAYLOAD_INVALID",
                "The payload is not a JSON object");
    }
}

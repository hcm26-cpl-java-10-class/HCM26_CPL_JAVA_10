package com.example.starter_project_2025.system.git_integration.webhook;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * SY-03: GitHub webhook endpoint. Public (no JWT): every request is authenticated
 * by its {@code X-Hub-Signature-256}. The body is taken as raw bytes so the HMAC
 * is computed over exactly what GitHub signed.
 */
@Tag(name = "Git Integration · Webhooks", description = "SY-03: receive GitHub webhook events (called by GitHub)")
@RestController
@RequestMapping("/api/webhooks/github")
@RequiredArgsConstructor
public class GitHubWebhookController {

    private final GitHubWebhookReceiver receiver;

    @Operation(summary = "GitHub webhook delivery (202 stored, 200 duplicate delivery, 401 bad signature)")
    @PostMapping
    public ResponseEntity<Map<String, Object>> receive(
            @RequestBody(required = false) byte[] body,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestHeader(value = "X-GitHub-Delivery", required = false) String deliveryId,
            @RequestHeader(value = "X-GitHub-Event", required = false) String eventType,
            @RequestHeader(value = "X-GitHub-Hook-ID", required = false) String hookId) {
        GitHubWebhookReceiver.Outcome outcome = receiver.receive(body, signature, deliveryId, eventType, hookId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", outcome == GitHubWebhookReceiver.Outcome.ACCEPTED ? "accepted" : "duplicate");
        response.put("deliveryId", deliveryId);
        return ResponseEntity.status(outcome == GitHubWebhookReceiver.Outcome.ACCEPTED ? HttpStatus.ACCEPTED : HttpStatus.OK)
                .body(response);
    }
}

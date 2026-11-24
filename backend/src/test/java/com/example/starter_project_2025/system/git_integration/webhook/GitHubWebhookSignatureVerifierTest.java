package com.example.starter_project_2025.system.git_integration.webhook;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class GitHubWebhookSignatureVerifierTest {

    private final GitHubWebhookSignatureVerifier verifier = new GitHubWebhookSignatureVerifier();

    /** Test vector published in GitHub's "Validating webhook deliveries" documentation. */
    @Test
    void matchesGitHubDocumentedExample() {
        byte[] body = "Hello, World!".getBytes(StandardCharsets.UTF_8);
        String signature = "sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17";

        assertThat(verifier.sign("It's a Secret to Everybody", body)).isEqualTo(signature);
        assertThat(verifier.verify("It's a Secret to Everybody", body, signature)).isTrue();
    }

    @Test
    void rejectsTamperedBodyWrongSecretAndMalformedHeaders() {
        byte[] body = "{\"zen\":\"Keep it logically awesome.\"}".getBytes(StandardCharsets.UTF_8);
        String signature = verifier.sign("secret", body);

        assertThat(verifier.verify("secret", body, signature)).isTrue();
        assertThat(verifier.verify("secret", "{\"zen\":\"Keep it logically awesome!\"}".getBytes(StandardCharsets.UTF_8), signature)).isFalse();
        assertThat(verifier.verify("other-secret", body, signature)).isFalse();
        assertThat(verifier.verify("secret", body, signature.substring(0, signature.length() - 1) + "0")).isFalse();
        assertThat(verifier.verify("secret", body, signature.substring("sha256=".length()))).isFalse();
        assertThat(verifier.verify("secret", body, "sha1=" + signature.substring("sha256=".length()))).isFalse();
        assertThat(verifier.verify("secret", body, "")).isFalse();
        assertThat(verifier.verify("secret", body, null)).isFalse();
        assertThat(verifier.verify("", body, signature)).isFalse();
    }

    @Test
    void emptyBodyCanBeSignedAndVerified() {
        String signature = verifier.sign("secret", new byte[0]);
        assertThat(verifier.verify("secret", null, signature)).isTrue();
    }
}

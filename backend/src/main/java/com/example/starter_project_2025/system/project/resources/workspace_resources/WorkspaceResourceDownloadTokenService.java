package com.example.starter_project_2025.system.project.resources.workspace_resources;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

/**
 * Issues and verifies the short-lived tokens behind resource download links
 * (US-RES-004 / AC02).
 * <p>
 * A token only contains identifiers and an expiry timestamp, signed with
 * HMAC-SHA256. The storage key is resolved on the server after the signature
 * has been verified, so a tampered link can never point at another object.
 */
@Component
public class WorkspaceResourceDownloadTokenService {

    private final SecretKeySpec signingKey;
    private final long ttlSeconds;

    public WorkspaceResourceDownloadTokenService(
            @Value("${app.resource-download.secret:}") String secret,
            @Value("${app.resource-download.ttl-seconds:300}") long ttlSeconds) {

        this.ttlSeconds = Math.max(30, ttlSeconds);
        this.signingKey = new SecretKeySpec(resolveKey(secret), "HmacSHA256");
    }

    /** Creates a signed token valid for the configured TTL. */
    public IssuedToken issue(Long workspaceId, Long resourceId, Long fileId) {

        long expiry = Instant.now().getEpochSecond() + ttlSeconds;
        String payload = workspaceId + ":" + resourceId + ":" + fileId + ":" + expiry;
        String encoded = encode(payload.getBytes(StandardCharsets.UTF_8));

        return new IssuedToken(encoded + "." + sign(encoded), Instant.ofEpochSecond(expiry));
    }

    /** Validates the signature and the expiry of a token. */
    public TokenPayload verify(String token) {

        if (token == null || token.isBlank()) {
            throw forbidden();
        }

        int separator = token.lastIndexOf('.');

        if (separator <= 0 || separator == token.length() - 1) {
            throw forbidden();
        }

        String encoded = token.substring(0, separator);
        String provided = token.substring(separator + 1);

        if (!MessageDigest.isEqual(
                sign(encoded).getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8))) {
            throw forbidden();
        }

        try {
            String[] parts = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8)
                    .split(":");

            if (parts.length != 4) {
                throw forbidden();
            }

            long expiry = Long.parseLong(parts[3]);

            if (expiry < Instant.now().getEpochSecond()) {
                throw forbidden();
            }

            return new TokenPayload(Long.valueOf(parts[0]), Long.valueOf(parts[1]),
                    Long.valueOf(parts[2]), expiry);
        } catch (IllegalArgumentException exception) {
            throw forbidden();
        }
    }

    private static byte[] resolveKey(String secret) {

        if (secret != null && !secret.isBlank()) {
            return secret.getBytes(StandardCharsets.UTF_8);
        }

        // Local development fallback: links stay valid until the next restart.
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return random;
    }

    private String sign(String value) {

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(signingKey);
            return encode(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to sign the download link", exception);
        }
    }

    private static String encode(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private static ResponseStatusException forbidden() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN,
                "This download link is invalid or has expired");
    }

    public record IssuedToken(String token, Instant expiresAt) {
    }

    public record TokenPayload(Long workspaceId, Long resourceId, Long fileId, long expiresAtEpoch) {
    }
}

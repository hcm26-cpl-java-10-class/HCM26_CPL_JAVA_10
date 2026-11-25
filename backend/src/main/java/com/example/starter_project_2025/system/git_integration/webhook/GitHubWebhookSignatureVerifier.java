package com.example.starter_project_2025.system.git_integration.webhook;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

/**
 * SY-03: GitHub's webhook signature check. {@code X-Hub-Signature-256} is
 * {@code sha256=} + hex(HMAC-SHA256(secret, raw body)); it is computed over the
 * exact bytes received (never over re-serialized JSON) and compared in constant time.
 */
@Component
public class GitHubWebhookSignatureVerifier {

    private static final String PREFIX = "sha256=";
    private static final String ALGORITHM = "HmacSHA256";

    public boolean verify(String secret, byte[] body, String signatureHeader) {
        if (secret == null || secret.isEmpty() || signatureHeader == null || !signatureHeader.startsWith(PREFIX)) {
            return false;
        }
        byte[] expected = sign(secret, body == null ? new byte[0] : body).getBytes(StandardCharsets.US_ASCII);
        byte[] received = signatureHeader.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, received);
    }

    /** {@code sha256=<hex>} for the body (also used by tests to sign requests). */
    public String sign(String secret, byte[] body) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return PREFIX + HexFormat.of().formatHex(mac.doFinal(body));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
        }
    }
}

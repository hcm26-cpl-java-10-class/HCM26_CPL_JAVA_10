package com.example.starter_project_2025.system.project.resources;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ResourceDownloadSigner {
    public static final long LIFETIME_SECONDS = 300;
    private final byte[] key;

    public ResourceDownloadSigner(@Value("${app.project.resources.signing-key:}") String secret) {
        if (secret.isBlank()) {
            key = new byte[32];
            new SecureRandom().nextBytes(key);
        } else {
            key = secret.getBytes(StandardCharsets.UTF_8);
            if (key.length < 32) throw new IllegalArgumentException("The resource signing key must contain at least 32 bytes");
        }
    }

    public String sign(Long userId, Long tenantId, Long workspaceId, Long resourceId, long expires) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest(userId, tenantId, workspaceId, resourceId, expires));
    }

    public void verify(Long userId, Long tenantId, Long workspaceId, Long resourceId, long expires, String signature) {
        long now = Instant.now().getEpochSecond();
        if (expires <= now || expires > now + LIFETIME_SECONDS)
            throw invalidLink("The download link has expired. Please try downloading again.");
        try {
            byte[] supplied = Base64.getUrlDecoder().decode(signature);
            if (!MessageDigest.isEqual(digest(userId, tenantId, workspaceId, resourceId, expires), supplied))
                throw invalidLink("The download link is invalid for this user or workspace");
        } catch (IllegalArgumentException exception) {
            throw invalidLink("The download link is invalid. Please try downloading again.");
        }
    }

    private byte[] digest(Long userId, Long tenantId, Long workspaceId, Long resourceId, long expires) {
        String value = "project-resource-download\n" + userId + "\n" + tenantId + "\n" + workspaceId
                + "\n" + resourceId + "\n" + expires;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to sign the resource download", exception);
        }
    }

    private ResponseStatusException invalidLink(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }
}

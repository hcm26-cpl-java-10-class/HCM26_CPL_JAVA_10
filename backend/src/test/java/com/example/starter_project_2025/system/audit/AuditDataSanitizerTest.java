
package com.example.starter_project_2025.system.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AuditDataSanitizerTest {

    private final AuditDataSanitizer sanitizer =
            new AuditDataSanitizer(new ObjectMapper());

    @Test
    void shouldMaskSensitiveFields() throws Exception {

        String input = """
                {
                    "email": "test@gmail.com",
                    "password": "123456",
                    "accessToken": "abc123",
                    "profile": {
                        "refreshToken": "xyz789"
                    }
                }
                """;

        String result = sanitizer.sanitize(input);

        var json = new ObjectMapper().readTree(result);

        assertEquals("test@gmail.com",
                json.get("email").asText());

        assertEquals("[REDACTED]",
                json.get("password").asText());

        assertEquals("[REDACTED]",
                json.get("accessToken").asText());

        assertEquals("[REDACTED]",
                json.get("profile")
                        .get("refreshToken").asText());
    }

    @Test
    void shouldRedactInvalidJson() {
        String result = sanitizer.sanitize("password=123456");

        assertEquals("[REDACTED]", result);
    }
}

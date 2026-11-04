package com.example.starter_project_2025.system.auth.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class PasswordPolicyTest {

    @Test
    void acceptsAnEasyButNotTooSimplePassword() {
        assertNull(PasswordPolicy.validate("Hoa12345"));
        assertNull(PasswordPolicy.validate("minh2024x"));
        assertNull(PasswordPolicy.validate("correct horse 9".replace(" ", "-")));
    }

    @Test
    void rejectsTooShortOrTooLong() {
        assertNotNull(PasswordPolicy.validate("abc123"));
        assertNotNull(PasswordPolicy.validate("a1".repeat(40)));
        assertNotNull(PasswordPolicy.validate(null));
    }

    @Test
    void rejectsSpacesAndMissingLetterOrNumber() {
        assertNotNull(PasswordPolicy.validate("abc 12345"));
        assertNotNull(PasswordPolicy.validate("abcdefghij"));
        assertNotNull(PasswordPolicy.validate("1234567890"));
    }

    @Test
    void rejectsVeryCommonPasswords() {
        assertNotNull(PasswordPolicy.validate("Password123"));
        assertNotNull(PasswordPolicy.validate("qwerty123"));
        assertNotNull(PasswordPolicy.validate("12345678"));
    }

    @Test
    void temporaryPasswordsAreAlwaysValid_andDifferentForEveryone() {
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int i = 0; i < 500; i++) {
            String password = TemporaryPassword.generate();
            assertNull(PasswordPolicy.validate(password), password);
            org.junit.jupiter.api.Assertions.assertEquals(12, password.length());
            seen.add(password);
        }
        org.junit.jupiter.api.Assertions.assertEquals(500, seen.size());
    }
}

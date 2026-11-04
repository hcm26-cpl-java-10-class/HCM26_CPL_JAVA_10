package com.example.starter_project_2025.system.auth.util;

import lombok.experimental.UtilityClass;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Rejects passwords that are too simple, without making them hard to remember:
 * 8-64 characters, at least one letter and one number, no spaces, and not a very common password.
 * Keep the rules in sync with frontend/src/utils/password.utils.ts.
 */
@UtilityClass
public class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 64;

    private static final Pattern LETTER = Pattern.compile("\\p{L}");
    private static final Pattern DIGIT = Pattern.compile("\\d");
    private static final Pattern SPACE = Pattern.compile("\\s");

    private static final Set<String> COMMON = Set.of(
            "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "12345678",
            "123456789", "1234567890", "11111111", "00000000", "qwerty123", "qwertyuiop", "qwerty12",
            "iloveyou", "admin123", "administrator", "welcome1", "welcome123", "letmein1", "abc12345",
            "abcd1234", "1q2w3e4r", "1qaz2wsx", "changeme", "changeme1", "default123", "test1234",
            "monkey123", "dragon123", "football1", "baseball1", "sunshine1", "princess1", "master123"
    );

    /**
     * @return the first problem found, or {@code null} when the password is acceptable.
     */
    public static String validate(String password) {
        if (password == null || password.length() < MIN_LENGTH || password.length() > MAX_LENGTH) {
            return "Password must be " + MIN_LENGTH + "-" + MAX_LENGTH + " characters.";
        }
        if (SPACE.matcher(password).find()) {
            return "Password must not contain spaces.";
        }
        if (!LETTER.matcher(password).find() || !DIGIT.matcher(password).find()) {
            return "Password must contain at least one letter and one number.";
        }
        if (COMMON.contains(password.toLowerCase(Locale.ROOT))) {
            return "This password is too common. Choose something less predictable.";
        }
        return null;
    }
}

package com.example.starter_project_2025.system.auth.util;

import lombok.experimental.UtilityClass;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Initial password of an account created by an import without a password: the letters of the email
 * (before the @, first letter in capital) followed by the date of birth as ddMMyyyy.
 * Example: an.nguyen@company.com and 2000-01-31 give {@code Annguyen31012000}.
 *
 * It always satisfies {@link PasswordPolicy} (at least 8 characters, a letter and a digit). The account is
 * marked "must change password", so the person chooses their own password at the first sign-in.
 */
@UtilityClass
public class InitialPassword {

    private static final DateTimeFormatter BIRTH_DATE = DateTimeFormatter.ofPattern("ddMMyyyy");
    private static final int MAX_LETTERS = 40;

    public static String from(String email, LocalDate dateOfBirth) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (dateOfBirth == null) {
            throw new IllegalArgumentException("Date of Birth is required");
        }

        int at = email.indexOf('@');
        String local = at >= 0 ? email.substring(0, at) : email;

        StringBuilder letters = new StringBuilder();
        for (char c : local.toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
                letters.append(c);
            }
        }

        String name = letters.length() == 0 ? "User" : letters.toString();
        if (name.length() > MAX_LETTERS) {
            name = name.substring(0, MAX_LETTERS);
        }
        name = name.substring(0, 1).toUpperCase(Locale.ROOT) + name.substring(1).toLowerCase(Locale.ROOT);

        return name + dateOfBirth.format(BIRTH_DATE);
    }
}

package com.example.starter_project_2025.system.auth.util;

import lombok.experimental.UtilityClass;

import java.security.SecureRandom;

/**
 * Random temporary password for accounts created without one. It is random and different for every
 * person (a password built from a name, phone or birth date could be guessed by others). It avoids
 * look-alike characters (0/O, 1/l/I) so it can be read from a printed list, and always satisfies
 * {@link PasswordPolicy}.
 */
@UtilityClass
public class TemporaryPassword {

    private static final int LENGTH = 12;
    private static final String LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final String DIGITS = "23456789";
    private static final String ALL = LETTERS + DIGITS;
    private static final SecureRandom RANDOM = new SecureRandom();

    public static String generate() {
        while (true) {
            StringBuilder password = new StringBuilder(LENGTH);
            for (int i = 0; i < LENGTH; i++) {
                password.append(ALL.charAt(RANDOM.nextInt(ALL.length())));
            }
            String candidate = password.toString();
            if (containsAny(candidate, LETTERS)
                    && containsAny(candidate, DIGITS)
                    && PasswordPolicy.validate(candidate) == null) {
                return candidate;
            }
        }
    }

    private static boolean containsAny(String text, String characters) {
        for (int i = 0; i < text.length(); i++) {
            if (characters.indexOf(text.charAt(i)) >= 0) {
                return true;
            }
        }
        return false;
    }
}

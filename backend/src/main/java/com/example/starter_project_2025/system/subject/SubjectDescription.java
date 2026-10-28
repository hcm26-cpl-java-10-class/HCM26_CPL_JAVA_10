package com.example.starter_project_2025.system.subject;

import java.util.regex.Pattern;

/** A word is a non-empty token separated by whitespace, including Unicode spaces. */
public final class SubjectDescription {
    public static final int MAX_WORDS = 500;
    private static final Pattern WORD = Pattern.compile("[^\\s\\p{Z}\\uFEFF]+");

    private SubjectDescription() {}

    public static int countWords(String description) {
        if (description == null || description.isEmpty()) return 0;
        var matcher = WORD.matcher(description);
        int count = 0;
        while (matcher.find()) count++;
        return count;
    }
}

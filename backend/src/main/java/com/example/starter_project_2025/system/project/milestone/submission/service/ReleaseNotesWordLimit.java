package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Shared server-side word limit for artifact release notes. */
public final class ReleaseNotesWordLimit {
    public static final int MAX_WORDS = 1_000;
    private static final Pattern WORD = Pattern.compile("\\S+", Pattern.UNICODE_CHARACTER_CLASS);

    private ReleaseNotesWordLimit() { }

    public static int count(String value) {
        if (value == null || value.isBlank()) return 0;
        var matcher = WORD.matcher(value.strip());
        int count = 0;
        while (matcher.find()) count++;
        return count;
    }

    public static void validate(String value) {
        int count = count(value);
        if (count > MAX_WORDS) {
            throw new MilestoneValidationException(Map.of("releaseNotes", List.of(
                    "Release notes must not exceed " + MAX_WORDS + " words (received " + count + ")")));
        }
    }
}

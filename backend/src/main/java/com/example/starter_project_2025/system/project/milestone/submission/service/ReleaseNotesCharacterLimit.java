package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import java.util.List;
import java.util.Map;

/** Matches frontend String.length and the Summary character limit. */
public final class ReleaseNotesCharacterLimit {
    public static final int MAX_CHARACTERS = 1_000;
    private ReleaseNotesCharacterLimit() { }
    public static int count(String value) { return value == null ? 0 : value.length(); }
    public static void validate(String value) {
        if (count(value) > MAX_CHARACTERS) throw new MilestoneValidationException(Map.of("releaseNotes", List.of(
                "Release notes must not exceed " + MAX_CHARACTERS + " characters (received " + count(value) + ")")));
    }
}

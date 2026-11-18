package com.example.starter_project_2025.system.demo.syllabus.validation;

import com.example.starter_project_2025.exception.BusinessValidationException;
import java.util.*;

/** Existing Syllabus field rules, extracted without changing their constraints. */
public final class SyllabusInputValidator {
    private SyllabusInputValidator() {}
    public static String clean(String raw) {
        return raw == null
                ? ""
                : raw.strip().replaceAll("(?U)\\s+", " ");
    }

    public static String key(String text) {
        return clean(text).toLowerCase(Locale.ROOT);
    }

    public static void fail(String field, String message) {
        throw new BusinessValidationException(
                Map.of(field, List.of(message))
        );
    }

    public static String requiredTitle(
            String raw,
            int max,
            String field
    ) {
        String value = clean(raw);

        if (value.length() < 3
                || value.length() > max
                || value.codePoints().noneMatch(Character::isLetter)) {
            fail(
                    field,
                    "Must contain letters and be 3-" + max
                            + " characters long"
            );
        }

        return value;
    }

    public static int requiredOrder(Integer order) {
        if (order == null || order < 0) {
            fail("orderIndex", "Order must be a non-negative integer");
        }

        return order;
    }

    public static String informationText(
            String raw,
            int maxLength,
            String field
    ) {
        String value = raw == null ? "" : raw.strip();

        if (value.length() > maxLength) {
            fail(field, "Must not exceed " + maxLength + " characters");
        }

        return value;
    }

    public static String validMission(String raw) {
        if (raw == null) {
            return "";
        }

        String value = raw.strip();

        if (value.length() > 2000) {
            fail("mission", "Mission must not exceed 2000 characters");
        }

        return value;
    }
}

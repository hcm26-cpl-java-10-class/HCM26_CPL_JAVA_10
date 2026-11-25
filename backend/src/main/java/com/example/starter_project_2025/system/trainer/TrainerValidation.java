package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.subject.Subject;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Package-private validator/normalizer keeping Trainer entity concise while preserving atomic invariants. */
final class TrainerValidation {

    private static final Pattern CODE_PATTERN = Pattern.compile(Trainer.CODE_REGEX);
    private static final Pattern EMAIL_PATTERN = Pattern.compile(Trainer.EMAIL_REGEX);

    private TrainerValidation() {
    }

    record ValidatedProfile(
            String trainerCode,
            String fullName,
            String email,
            String specialization,
            TrainerStatus status,
            Set<Subject> teachingTopics
    ) {}

    static ValidatedProfile validateProfile(
            String trainerCode,
            String fullName,
            String email,
            String specialization,
            TrainerStatus status,
            Collection<Subject> teachingTopics
    ) {
        return new ValidatedProfile(
            normalizeTrainerCode(trainerCode),
            normalizeFullName(fullName),
            normalizeEmail(email),
            normalizeSpecialization(specialization),
            requireStatus(status),
            normalizeTeachingTopics(teachingTopics)
        );
    }

    static TrainerStatus requireStatus(TrainerStatus status) {
        if (status == null) {
            throw new BadRequestException("Status is required.");
        }
        return status;
    }

    private static String normalizeTrainerCode(String trainerCode) {
        String normalized = requireMaxLength(requireNonBlank(trainerCode, "Trainer Code"), Trainer.MAX_CODE_LENGTH, "Trainer Code")
            .toUpperCase(Locale.ROOT);
        if (!CODE_PATTERN.matcher(normalized).matches()) {
            throw new BadRequestException("Trainer Code must start with a letter or digit and use only letters, digits, '_' or '-'.");
        }
        return normalized;
    }

    private static String normalizeFullName(String fullName) {
        return requireMaxLength(requireNonBlank(fullName, "Full Name"), Trainer.MAX_FULL_NAME_LENGTH, "Full Name");
    }

    private static String normalizeEmail(String email) {
        String normalized = requireMaxLength(requireNonBlank(email, "Work Email"), Trainer.MAX_EMAIL_LENGTH, "Work Email")
            .toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new BadRequestException("Work Email must be a valid email address.");
        }
        return normalized;
    }

    private static String normalizeSpecialization(String specialization) {
        return requireMaxLength(specialization == null ? "" : specialization.trim(), Trainer.MAX_SPECIALIZATION_LENGTH, "Specialization");
    }

    private static Set<Subject> normalizeTeachingTopics(Collection<Subject> teachingTopics) {
        Set<Subject> normalized = new LinkedHashSet<>();
        if (teachingTopics == null) {
            return normalized;
        }
        for (Subject subject : teachingTopics) {
            if (subject == null) {
                throw new BadRequestException("Teaching Topics cannot contain null.");
            }
            normalized.add(subject);
        }
        return normalized;
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required.");
        }
        return value.trim();
    }

    private static String requireMaxLength(String value, int maxLength, String fieldName) {
        if (value.length() > maxLength) {
            throw new BadRequestException(fieldName + " must not exceed " + maxLength + " characters.");
        }
        return value;
    }
}

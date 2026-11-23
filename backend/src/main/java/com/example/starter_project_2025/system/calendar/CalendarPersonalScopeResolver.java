package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Resolves the verified trainer IDs (in the external training directory that Session.trainerId references)
 * and active enrolled class IDs (from ClassEnrollment) for an authenticated User account.
 *
 * Matching is strictly by normalized email — never by numeric User.id equality or display name.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CalendarPersonalScopeResolver {

    private final ExternalApiService externalApiService;
    private final ClassEnrollmentRepository classEnrollmentRepository;

    public record PersonalScope(Set<Long> trainerIds, Set<Long> classIds) {
        public static PersonalScope empty() {
            return new PersonalScope(Set.of(), Set.of());
        }

        public boolean isEmpty() {
            return trainerIds.isEmpty() && classIds.isEmpty();
        }
    }

    public PersonalScope resolveFor(User user) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return PersonalScope.empty();
        }

        String normalizedEmail = user.getEmail().trim().toLowerCase(Locale.ROOT);
        Set<Long> trainerIds = resolveExternalTrainerIds(normalizedEmail);
        Set<Long> enrolledClassIds = resolveEnrolledClassIds(normalizedEmail);
        return new PersonalScope(Set.copyOf(trainerIds), Set.copyOf(enrolledClassIds));
    }

    private Set<Long> resolveExternalTrainerIds(String normalizedEmail) {
        Set<Long> matched = new LinkedHashSet<>();
        try {
            List<ExternalTrainerDTO> externalTrainers = externalApiService.fetchTrainers(null);
            if (externalTrainers == null) {
                return matched;
            }
            for (ExternalTrainerDTO trainer : externalTrainers) {
                if (trainer == null || trainer.getId() == null || trainer.getEmail() == null || trainer.getEmail().isBlank()) {
                    continue;
                }
                if (normalizedEmail.equals(trainer.getEmail().trim().toLowerCase(Locale.ROOT))) {
                    matched.add(trainer.getId());
                }
            }
        } catch (RuntimeException ex) {
            log.warn("Unable to resolve external trainer identity for personal calendar: {}", ex.getMessage());
        }
        return matched;
    }

    private Set<Long> resolveEnrolledClassIds(String normalizedEmail) {
        Set<Long> matched = new LinkedHashSet<>();
        List<ClassEnrollment> enrollments =
                classEnrollmentRepository.findActiveByPersonalEmailsIgnoreCase(List.of(normalizedEmail));
        if (enrollments == null) {
            return matched;
        }
        for (ClassEnrollment enrollment : enrollments) {
            if (enrollment == null
                    || !Boolean.TRUE.equals(enrollment.getIsActive())
                    || enrollment.getStatus() != ClassEnrollment.Status.ACTIVE
                    || enrollment.getTrainingClass() == null
                    || enrollment.getTrainingClass().getId() == null
                    || !Boolean.TRUE.equals(enrollment.getTrainingClass().getIsActive())) {
                continue;
            }
            matched.add(enrollment.getTrainingClass().getId());
        }
        return matched;
    }
}

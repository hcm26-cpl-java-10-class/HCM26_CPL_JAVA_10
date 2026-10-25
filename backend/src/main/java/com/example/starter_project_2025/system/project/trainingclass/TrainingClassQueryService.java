package com.example.starter_project_2025.system.project.trainingclass;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TrainingClassQueryService {

    private final TrainingClassRepository trainingClassRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;

    @Transactional(readOnly = true)
    public Page<TrainingClassListItem> getManageableClasses(
            Authentication authentication,
            Pageable requestedPage,
            String search,
            TrainingClassStatus status,
            Long programId,
            Long cohortId,
            String programName,
            String cohortName
    ) {
        List<TrainingClass> manageableClasses = trainingClassRepository.findAll().stream()
                .filter(trainingClass -> Boolean.TRUE.equals(trainingClass.getIsActive()))
                .filter(trainingClass ->
                        scopeAuthorizationService.canManageClass(authentication, trainingClass))
                .filter(trainingClass -> status == null || trainingClass.getStatus() == status)
                .filter(trainingClass -> programId == null
                        || programId.equals(trainingClass.getProgramId()))
                .filter(trainingClass -> cohortId == null
                        || cohortId.equals(trainingClass.getCohortId()))
                .filter(trainingClass -> matchesName(trainingClass.getProgramName(), programName))
                .filter(trainingClass -> matchesName(trainingClass.getCohortName(), cohortName))
                .filter(trainingClass -> matchesSearch(trainingClass, search))
                .sorted(comparator(requestedPage.getSort()))
                .toList();

        int page = Math.max(0, requestedPage.getPageNumber());
        int size = Math.min(Math.max(1, requestedPage.getPageSize()), 200);
        Pageable pageable = PageRequest.of(page, size);
        int fromIndex = Math.min(page * size, manageableClasses.size());
        int toIndex = Math.min(fromIndex + size, manageableClasses.size());

        List<TrainingClassListItem> items = manageableClasses.subList(fromIndex, toIndex)
                .stream()
                .map(trainingClass -> new TrainingClassListItem(
                        trainingClass.getId(),
                        trainingClass.getCode(),
                        trainingClass.getName(),
                        trainingClass.getProgramId(),
                        displayName(trainingClass.getProgramName()),
                        trainingClass.getCohortId(),
                        displayName(trainingClass.getCohortName()),
                        trainingClass.getTenantId(),
                        trainingClass.getMentorId(),
                        trainingClass.getStatus(),
                        classMemberRepository.countByTrainingClass_Id(trainingClass.getId())
                ))
                .toList();

        return new PageImpl<>(items, pageable, manageableClasses.size());
    }

    @Transactional(readOnly = true)
    public List<TrainingClass> getAllManageableClasses(Authentication authentication) {
        return trainingClassRepository.findAll().stream()
                .filter(trainingClass -> Boolean.TRUE.equals(trainingClass.getIsActive()))
                .filter(trainingClass ->
                        scopeAuthorizationService.canManageClass(authentication, trainingClass))
                .toList();
    }

    private boolean matchesSearch(TrainingClass trainingClass, String search) {
        if (search == null || search.isBlank()) {
            return true;
        }
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return trainingClass.getCode().toLowerCase(Locale.ROOT).contains(needle)
                || trainingClass.getName().toLowerCase(Locale.ROOT).contains(needle)
                || contains(trainingClass.getProgramName(), needle)
                || contains(trainingClass.getCohortName(), needle);
    }

    private boolean matchesName(String actualName, String requestedName) {
        return requestedName == null || requestedName.isBlank()
                || contains(actualName, requestedName.trim().toLowerCase(Locale.ROOT));
    }

    private boolean contains(String value, String lowercaseNeedle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(lowercaseNeedle);
    }

    private String displayName(String value) {
        return value == null || value.isBlank() ? "Chưa cập nhật" : value;
    }

    private Comparator<TrainingClass> comparator(Sort sort) {
        Comparator<TrainingClass> comparator = Comparator.comparing(
                TrainingClass::getName,
                String.CASE_INSENSITIVE_ORDER);
        for (Sort.Order order : sort) {
            Comparator<TrainingClass> next = switch (order.getProperty()) {
                case "code" -> Comparator.comparing(
                        TrainingClass::getCode,
                        String.CASE_INSENSITIVE_ORDER);
                case "name" -> Comparator.comparing(
                        TrainingClass::getName,
                        String.CASE_INSENSITIVE_ORDER);
                case "status" -> Comparator.comparing(
                        trainingClass -> trainingClass.getStatus().name());
                case "programId" -> Comparator.comparing(TrainingClass::getProgramId);
                case "programName" -> Comparator.comparing(
                        TrainingClass::getProgramName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
                case "cohortName" -> Comparator.comparing(
                        TrainingClass::getCohortName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
                case "cohortId" -> Comparator.comparing(
                        TrainingClass::getCohortId,
                        Comparator.nullsLast(Long::compareTo));
                default -> null;
            };
            if (next != null) {
                comparator = comparator.thenComparing(
                        order.isDescending() ? next.reversed() : next);
            }
        }
        return comparator.thenComparing(TrainingClass::getId);
    }
}

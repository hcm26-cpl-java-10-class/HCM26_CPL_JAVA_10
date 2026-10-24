package com.example.starter_project_2025.system.project.rubric.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.rubric.domain.*;
import com.example.starter_project_2025.system.project.rubric.dto.*;
import com.example.starter_project_2025.system.project.rubric.exception.*;
import com.example.starter_project_2025.system.project.rubric.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class RubricService {
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100.00");

    private final RubricRepository rubricRepository;
    private final RubricVersionRepository versionRepository;
    private final MilestoneRepository milestoneRepository;
    private final CurrentTenantProvider tenantProvider;
    private final CurrentActorProvider actorProvider;
    private final Clock milestoneClock;

    @Transactional(readOnly = true)
    public RubricPageResponse getList(int page, int size, String search, RubricVersionStatus status) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        Page<Rubric> result = rubricRepository.search(tenantId, normalizeSearch(search), status,
                PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "updatedAt")));
        return new RubricPageResponse(result.getContent().stream().map(this::toListItem).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public RubricDetailResponse getDetail(UUID rubricId) {
        return toDetail(requireRubric(rubricId));
    }

    @Transactional
    public RubricDetailResponse create(SaveRubricDraftRequest request) {
        validate(request);
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        UUID actorId = actorProvider.requireCurrentActorId();
        String name = request.name().trim();
        if (rubricRepository.existsByTenantIdAndNameIgnoreCase(tenantId, name)) {
            throw new RubricConflictException("A rubric with this name already exists");
        }
        Instant now = milestoneClock.instant();
        Rubric rubric = Rubric.create(UUID.randomUUID(), tenantId, name, request.description(), actorId, now);
        RubricVersion version = RubricVersion.draft(UUID.randomUUID(), rubric, 1, actorId, now);
        version.replaceDraft(name, request.description(), values(request.criteria()), actorId, now);
        rubric.addVersion(version);
        Rubric savedRubric = rubricRepository.saveAndFlush(rubric);
        return toDetail(savedRubric);
    }

    @Transactional
    public RubricDetailResponse updateDraft(UUID rubricId, UUID versionId, SaveRubricDraftRequest request) {
        validate(request);
        Rubric rubric = requireRubric(rubricId);
        RubricVersion version = requireVersion(rubricId, versionId);
        requireDraft(version);
        String name = request.name().trim();
        if (rubricRepository.existsByTenantIdAndNameIgnoreCaseAndIdNot(
                tenantProvider.requireCurrentTenantId(), name, rubricId)) {
            throw new RubricConflictException("A rubric with this name already exists");
        }
        UUID actorId = actorProvider.requireCurrentActorId();
        Instant now = milestoneClock.instant();
        rubric.updateMetadata(name, request.description(), actorId, now);
        version.replaceDraft(name, request.description(), values(request.criteria()), actorId, now);
        rubricRepository.saveAndFlush(rubric);
        return toDetail(rubric);
    }

    @Transactional
    public RubricDetailResponse publish(UUID rubricId, UUID versionId) {
        Rubric rubric = requireRubric(rubricId);
        RubricVersion version = requireVersion(rubricId, versionId);
        requireDraft(version);
        validateVersion(version);
        version.publish(actorProvider.requireCurrentActorId(), milestoneClock.instant());
        versionRepository.saveAndFlush(version);
        return toDetail(rubric);
    }

    @Transactional
    public RubricDetailResponse createVersion(UUID rubricId, CreateRubricVersionRequest request) {
        Rubric rubric = requireRubric(rubricId);
        if (versionRepository.existsByRubricIdAndStatus(rubricId, RubricVersionStatus.DRAFT)) {
            throw new RubricConflictException("Finish or delete the existing draft before creating another version");
        }
        RubricVersion source = requireVersion(rubricId, request.sourceVersionId());
        if (source.getStatus() == RubricVersionStatus.DRAFT) {
            throw new RubricConflictException("A new version can only be created from a published or archived version");
        }
        int nextVersion = rubric.getVersions().stream().mapToInt(RubricVersion::getVersionNumber).max().orElse(0) + 1;
        UUID actorId = actorProvider.requireCurrentActorId();
        Instant now = milestoneClock.instant();
        RubricVersion draft = RubricVersion.draft(UUID.randomUUID(), rubric, nextVersion, actorId, now);
        List<RubricVersion.CriterionValue> copied = source.getCriteria().stream()
                .map(c -> new RubricVersion.CriterionValue(c.getCode(), c.getName(), c.getDescription(),
                        c.getWeight(), c.getMaxScore(), c.getOrderIndex(), c.getRatings().stream()
                                .map(r -> new RubricVersion.RatingValue(r.getLevel(), r.getDescription())).toList())).toList();
        draft.replaceDraft(source.getNameSnapshot(), source.getDescriptionSnapshot(), copied, actorId, now);
        rubric.addVersion(draft);
        rubricRepository.saveAndFlush(rubric);
        return toDetail(rubric);
    }

    @Transactional
    public RubricDetailResponse archive(UUID rubricId, UUID versionId) {
        Rubric rubric = requireRubric(rubricId);
        RubricVersion version = requireVersion(rubricId, versionId);
        if (version.getStatus() != RubricVersionStatus.PUBLISHED) {
            throw new RubricConflictException("Only a published rubric version can be archived");
        }
        version.archive(actorProvider.requireCurrentActorId(), milestoneClock.instant());
        versionRepository.saveAndFlush(version);
        return toDetail(rubric);
    }

    @Transactional
    public void deleteDraft(UUID rubricId, UUID versionId) {
        Rubric rubric = requireRubric(rubricId);
        RubricVersion version = requireVersion(rubricId, versionId);
        requireDraft(version);
        if (milestoneRepository.existsByRubricSnapshotId(versionId)) {
            throw new RubricConflictException("This rubric version is already used by a milestone");
        }
        if (rubric.getVersions().size() == 1) {
            rubricRepository.delete(rubric);
        } else {
            rubric.removeVersion(version);
            rubricRepository.save(rubric);
        }
    }

    private Rubric requireRubric(UUID id) {
        return rubricRepository.findByIdAndTenantId(id, tenantProvider.requireCurrentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Rubric not found"));
    }

    private RubricVersion requireVersion(UUID rubricId, UUID versionId) {
        return versionRepository.findByIdAndRubricIdAndRubricTenantId(
                        versionId, rubricId, tenantProvider.requireCurrentTenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Rubric version not found"));
    }

    private void requireDraft(RubricVersion version) {
        if (version.getStatus() != RubricVersionStatus.DRAFT) {
            throw new RubricConflictException("Only a draft rubric version can be changed or deleted");
        }
    }

    private void validate(SaveRubricDraftRequest request) {
        Map<String, List<String>> errors = validateCriteria(request.criteria());
        if (!errors.isEmpty()) throw new RubricValidationException(errors);
    }

    private void validateVersion(RubricVersion version) {
        List<RubricCriterionRequest> criteria = version.getCriteria().stream()
                .map(c -> new RubricCriterionRequest(c.getCode(), c.getName(), c.getDescription(),
                        c.getWeight(), c.getMaxScore(), c.getOrderIndex(), c.getRatings().stream()
                                .map(r -> new RubricRatingRequest(r.getLevel(), r.getDescription())).toList())).toList();
        Map<String, List<String>> errors = validateCriteria(criteria);
        if (!errors.isEmpty()) throw new RubricValidationException(errors);
    }

    private Map<String, List<String>> validateCriteria(List<RubricCriterionRequest> criteria) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        Set<String> codes = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        BigDecimal totalWeight = BigDecimal.ZERO;
        for (int i = 0; i < criteria.size(); i++) {
            RubricCriterionRequest item = criteria.get(i);
            String code = item.code().trim().toUpperCase();
            if (!codes.add(code)) add(errors, "criteria[" + i + "].code", "Criterion code must be unique");
            if (!orders.add(item.orderIndex())) add(errors, "criteria[" + i + "].orderIndex", "Criterion order must be unique");
            totalWeight = totalWeight.add(item.weight());
            Set<RubricRatingLevel> levels = new HashSet<>();
            for (int ratingIndex = 0; ratingIndex < item.ratings().size(); ratingIndex++) {
                RubricRatingRequest rating = item.ratings().get(ratingIndex);
                if (!levels.add(rating.level())) {
                    add(errors, "criteria[" + i + "].ratings[" + ratingIndex + "].level", "Rating level must be unique");
                }
            }
            for (RubricRatingLevel level : RubricRatingLevel.values()) {
                if (!levels.contains(level)) {
                    add(errors, "criteria[" + i + "].ratings", "All four rating levels are required");
                    break;
                }
            }
        }
        if (totalWeight.compareTo(ONE_HUNDRED) != 0) {
            add(errors, "criteria", "Total criterion weight must equal exactly 100.00 percent");
        }
        for (int expected = 0; expected < criteria.size(); expected++) {
            if (!orders.contains(expected)) {
                add(errors, "criteria", "Criterion order must be continuous from 0");
                break;
            }
        }
        return errors;
    }

    private List<RubricVersion.CriterionValue> values(List<RubricCriterionRequest> criteria) {
        return criteria.stream().map(c -> new RubricVersion.CriterionValue(c.code(), c.name(), c.description(),
                c.weight(), c.maxScore(), c.orderIndex(), c.ratings().stream()
                        .map(r -> new RubricVersion.RatingValue(r.level(), r.description())).toList())).toList();
    }

    private RubricListItemResponse toListItem(Rubric rubric) {
        RubricVersion latest = rubric.getVersions().stream()
                .max(Comparator.comparingInt(RubricVersion::getVersionNumber)).orElseThrow();
        long usage = rubric.getVersions().stream().mapToLong(v -> milestoneRepository.countByRubricSnapshotId(v.getId())).sum();
        return new RubricListItemResponse(rubric.getId(), rubric.getName(), rubric.getDescription(),
                rubric.getVersions().size(), latest.getId(), latest.getVersionNumber(), latest.getStatus(),
                latest.getTotalMaxScore(), latest.getCriteria().size(), usage, rubric.getUpdatedAt());
    }

    private RubricDetailResponse toDetail(Rubric rubric) {
        List<RubricVersionResponse> versions = rubric.getVersions().stream()
                .sorted(Comparator.comparingInt(RubricVersion::getVersionNumber).reversed())
                .map(this::toVersion).toList();
        return new RubricDetailResponse(rubric.getId(), rubric.getName(), rubric.getDescription(), versions,
                rubric.getCreatedAt(), rubric.getUpdatedAt(), rubric.getLockVersion());
    }

    private RubricVersionResponse toVersion(RubricVersion version) {
        List<RubricCriterionResponse> criteria = version.getCriteria().stream()
                .map(c -> new RubricCriterionResponse(c.getId(), c.getCode(), c.getName(), c.getDescription(),
                        c.getWeight(), c.getMaxScore(), c.getOrderIndex(), c.getRatings().stream()
                                .map(r -> new RubricRatingResponse(r.getId(), r.getLevel(), r.getPercentage(),
                                        r.getDescription(), r.getOrderIndex())).toList())).toList();
        return new RubricVersionResponse(version.getId(), version.getVersionNumber(), version.getNameSnapshot(),
                version.getDescriptionSnapshot(), version.getStatus(), version.getTotalMaxScore(), criteria,
                milestoneRepository.countByRubricSnapshotId(version.getId()), version.getPublishedAt(),
                version.getArchivedAt(), version.getCreatedAt(), version.getUpdatedAt(), version.getLockVersion());
    }

    private static String normalizeSearch(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private static void add(Map<String, List<String>> errors, String field, String message) {
        errors.computeIfAbsent(field, ignored -> new ArrayList<>()).add(message);
    }
}

package com.example.starter_project_2025.system.project.rubric.service;

import com.example.starter_project_2025.system.project.milestone.integration.model.RubricCriterionData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricRatingData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RubricCatalogService {
    private final RubricVersionRepository versions;

    public List<RubricVersion> findPublished(Long tenantId) {
        List<RubricVersion> primary = versions.findAllByRubricTenantIdAndStatusOrderByNameSnapshotAscVersionNumberDesc(
                RubricTenantIdentity.from(tenantId), RubricVersionStatus.PUBLISHED);
        List<RubricVersion> legacy = versions.findAllByRubricTenantIdAndStatusOrderByNameSnapshotAscVersionNumberDesc(
                legacyTenantId(tenantId), RubricVersionStatus.PUBLISHED);
        if (legacy.isEmpty()) return primary;
        java.util.Map<UUID, RubricVersion> merged = new java.util.LinkedHashMap<>();
        primary.forEach(v -> merged.put(v.getId(), v));
        legacy.forEach(v -> merged.putIfAbsent(v.getId(), v));
        return java.util.List.copyOf(merged.values());
    }

    public Optional<RubricVersion> findPublished(UUID versionId, Long tenantId) {
        return versions.findByIdAndRubricTenantId(versionId, RubricTenantIdentity.from(tenantId))
                .or(() -> versions.findByIdAndRubricTenantId(versionId, legacyTenantId(tenantId)))
                .filter(version -> version.getStatus() == RubricVersionStatus.PUBLISHED);
    }

    private static UUID legacyTenantId(Long tenantId) {
        return UUID.nameUUIDFromBytes(("tenant:" + tenantId)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public static RubricSnapshotData snapshot(RubricVersion version) {
        return new RubricSnapshotData(version.getId(), version.getNameSnapshot(),
                "v" + version.getVersionNumber(), version.getStatus() == RubricVersionStatus.PUBLISHED,
                version.getCriteria().stream().map(criterion -> new RubricCriterionData(
                        criterion.getCode(), criterion.getName(), criterion.getWeight(), criterion.getMaxScore(),
                        criterion.getRatings().stream().map(rating -> new RubricRatingData(
                                rating.getLevel().name(), rating.getPercentage(), rating.getDescription(),
                                rating.getOrderIndex())).toList())).toList());
    }
}

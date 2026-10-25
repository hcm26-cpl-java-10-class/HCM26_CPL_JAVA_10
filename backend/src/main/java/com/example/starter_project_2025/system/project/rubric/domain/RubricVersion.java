package com.example.starter_project_2025.system.project.rubric.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "rubric_versions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_rubric_version_number", columnNames = {"rubric_id", "version_number"})
}, indexes = {
        @Index(name = "idx_rubric_version_status", columnList = "status")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RubricVersion {
    @Id
    @Column(name = "rubric_version_id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rubric_id", nullable = false, updatable = false)
    private Rubric rubric;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(name = "name_snapshot", nullable = false, length = 50)
    private String nameSnapshot;

    @Column(name = "description_snapshot", length = 500)
    private String descriptionSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RubricVersionStatus status;

    @Column(name = "total_max_score", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalMaxScore;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @OneToMany(mappedBy = "version", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<RubricCriterion> criteria = new ArrayList<>();

    public static RubricVersion draft(UUID id, Rubric rubric, int versionNumber, UUID actorId, Instant now) {
        RubricVersion version = new RubricVersion();
        version.id = id;
        version.rubric = rubric;
        version.versionNumber = versionNumber;
        version.nameSnapshot = rubric.getName();
        version.descriptionSnapshot = rubric.getDescription();
        version.status = RubricVersionStatus.DRAFT;
        version.totalMaxScore = BigDecimal.ZERO.setScale(2);
        version.createdAt = now;
        version.createdBy = actorId;
        version.updatedAt = now;
        version.updatedBy = actorId;
        return version;
    }

    public void replaceDraft(String name, String description, List<CriterionValue> values, UUID actorId, Instant now) {
        requireDraft();
        nameSnapshot = name.trim();
        descriptionSnapshot = description == null || description.isBlank() ? null : description.trim();
        criteria.clear();
        BigDecimal total = BigDecimal.ZERO;
        for (CriterionValue value : values) {
            criteria.add(RubricCriterion.create(this, value.code(), value.name(), value.description(),
                    value.weight(), value.maxScore(), value.orderIndex(), value.ratings()));
            total = total.add(value.maxScore());
        }
        totalMaxScore = total.setScale(2);
        updatedAt = now;
        updatedBy = actorId;
    }

    public void publish(UUID actorId, Instant now) {
        requireDraft();
        status = RubricVersionStatus.PUBLISHED;
        publishedAt = now;
        updatedAt = now;
        updatedBy = actorId;
    }

    private void requireDraft() {
        if (status != RubricVersionStatus.DRAFT) {
            throw new IllegalStateException("Only a draft rubric version can be changed");
        }
    }

    public record CriterionValue(String code, String name, String description, BigDecimal weight,
                                 BigDecimal maxScore, int orderIndex, List<RatingValue> ratings) {
        public CriterionValue(String code, String name, String description, BigDecimal weight,
                              BigDecimal maxScore, int orderIndex) {
            this(code, name, description, weight, maxScore, orderIndex, List.of());
        }
    }

    public record RatingValue(RubricRatingLevel level, String description) {}
}

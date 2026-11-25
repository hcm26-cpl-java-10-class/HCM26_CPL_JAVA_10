package com.example.starter_project_2025.system.project.aiassistant.entity;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingSeverity;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewSuggestionCapability;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "ai_review_findings",
        indexes = {
                @Index(
                        name = "idx_ai_review_finding_report",
                        columnList = "report_id"
                ),
                @Index(
                        name = "idx_ai_review_finding_status",
                        columnList = "status"
                )
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AIReviewFinding extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "report_id",
            nullable = false
    )
    AIReviewReport report;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    AIReviewFindingCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    AIReviewFindingSeverity severity;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    AIReviewFindingStatus status = AIReviewFindingStatus.OPEN;

    @Column(nullable = false, length = 255)
    String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    String description;

    @Column(columnDefinition = "TEXT")
    String recommendation;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    AIReviewSuggestionCapability suggestionCapability;

    @Column(columnDefinition = "TEXT")
    String suggestionCapabilityReason;

    @Column(length = 50)
    String targetType;

    String targetId;

    @Column(name = "target_snapshot_id")
    Long targetSnapshotId;

    @Column(name = "target_code", length = 100)
    String targetCode;

    @Column(name = "target_name", length = 255)
    String targetName;

    LocalDateTime acceptedAt;

    Long acceptedBy;

    LocalDateTime dismissedAt;

    Long dismissedBy;

    @Column(columnDefinition = "TEXT")
    String dismissReason;

    LocalDateTime resolvedAt;
}
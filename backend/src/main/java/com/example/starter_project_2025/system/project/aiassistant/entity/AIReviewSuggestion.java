package com.example.starter_project_2025.system.project.aiassistant.entity;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "ai_review_suggestions",
        indexes = {
                @Index(
                        name = "idx_ai_review_suggestion_finding",
                        columnList = "finding_id"
                ),
                @Index(
                        name = "idx_ai_review_suggestion_status",
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
public class AIReviewSuggestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "finding_id",
            nullable = false
    )
    AIReviewFinding finding;

    @Column(nullable = false)
    Long templateId;

    @Column(nullable = false)
    Long sourceSnapshotId;

    @Column(nullable = false, length = 50)
    String targetType;

    @Column(nullable = false)
    String targetId;

    @Column(nullable = false, columnDefinition = "TEXT")
    String rationale;

    @Column(nullable = false, columnDefinition = "TEXT")
    String changesJson;

    @Column(columnDefinition = "TEXT")
    String rawContent;

    @Column(columnDefinition = "TEXT")
    String validationErrorsJson;

    @Column(length = 100)
    String aiModel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    SuggestionStatus status = SuggestionStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    String rejectionReason;

    Long approvedBy;

    Long rejectedBy;

    Long appliedBy;

    Long appliedSnapshotId;

    @PrePersist
    protected void onCreate() {
        if (status == null) {
            status = SuggestionStatus.PENDING;
        }
    }
}
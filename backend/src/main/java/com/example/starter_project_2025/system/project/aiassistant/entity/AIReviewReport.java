package com.example.starter_project_2025.system.project.aiassistant.entity;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewReportStatus;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(
        name = "ai_review_reports",
        indexes = {
                @Index(
                        name = "idx_ai_review_report_template",
                        columnList = "project_template_id"
                ),
                @Index(
                        name = "idx_ai_review_report_snapshot",
                        columnList = "snapshot_id"
                )
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AIReviewReport extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "project_template_id",
            nullable = false
    )
    ProjectTemplate projectTemplate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "snapshot_id",
            nullable = false
    )
    ProjectTemplateSnapshot snapshot;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 20
    )
    AIReviewReportStatus status;

    @Column(
            name = "summary",
            columnDefinition = "TEXT"
    )
    String summary;

}

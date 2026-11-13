package com.example.starter_project_2025.system.project.aiassistant.entity;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(
        name = "ai_apply_batches",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_ai_apply_batch_suggestion",
                        columnNames = "suggestion_id"
                ),
                @UniqueConstraint(
                        name = "uk_ai_apply_batch_template",
                        columnNames = "project_template_id"
                )
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AIApplyBatch extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "suggestion_id",
            nullable = false,
            unique = true
    )
    AiSuggestion suggestion;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "project_template_id",
            nullable = false,
            unique = true
    )
    ProjectTemplate projectTemplate;

}

package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "project_template_milestone_checklist")
@Getter
@Setter
@NoArgsConstructor
public class TemplateMilestoneChecklistItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "milestone_id", nullable = false, updatable = false)
    private TemplateMilestone milestone;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;
}

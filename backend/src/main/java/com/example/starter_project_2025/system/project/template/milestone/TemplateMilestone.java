package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "project_template_milestones")
@Getter
@Setter
@NoArgsConstructor
public class TemplateMilestone extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private ProjectTemplate template;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(name = "due_after", nullable = false)
    private Integer dueAfter;

    @Enumerated(EnumType.STRING)
    @Column(name = "due_unit", nullable = false, length = 10)
    private TemplateMilestoneTimeUnit dueUnit;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal weight;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(name = "allow_late_submission")
    private Boolean allowLateSubmission;

    @Column(name = "max_late_days")
    private Integer maxLateDays;

    @Column(name = "penalty_per_day_percent", precision = 5, scale = 2)
    private BigDecimal penaltyPerDayPercent;

    @OneToMany(mappedBy = "milestone", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC, id ASC")
    private List<TemplateMilestoneChecklistItem> checklistItems = new ArrayList<>();

    @OneToMany(mappedBy = "milestone", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC, id ASC")
    private List<TemplateRubricCriterion> rubricCriteria = new ArrayList<>();
}

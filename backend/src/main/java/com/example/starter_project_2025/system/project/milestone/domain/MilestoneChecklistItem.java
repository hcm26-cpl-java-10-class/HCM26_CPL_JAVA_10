package com.example.starter_project_2025.system.project.milestone.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Entity
@Table(
        name = "milestone_checklist_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_milestone_checklist_order",
                columnNames = {"milestone_id", "order_index"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "item_id", nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "milestone_id", nullable = false, updatable = false)
    private Milestone milestone;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory;

    @Column(name = "is_completed", nullable = false)
    private boolean completed;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    static MilestoneChecklistItem create(
            Milestone milestone,
            String content,
            boolean mandatory,
            int orderIndex
    ) {
        MilestoneChecklistItem item = new MilestoneChecklistItem();
        item.milestone = milestone;
        item.content = content;
        item.mandatory = mandatory;
        item.completed = false;
        item.orderIndex = orderIndex;
        return item;
    }
}

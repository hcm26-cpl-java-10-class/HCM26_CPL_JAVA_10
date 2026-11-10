package com.example.starter_project_2025.system.training.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_operations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassOperationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false, unique = true)
    private Long classId;

    @Column(name = "actual_start_date")
    private String actualStartDate;

    @Column(name = "early_graduated_date")
    private String earlyGraduatedDate;

    @Column(name = "actual_end_date")
    private String actualEndDate;

    @Column(name = "topic_mark")
    private Integer topicMark;

    @Column(name = "discipline_point")
    private Integer disciplinePoint;

    @Column(name = "bonus_point")
    private Integer bonusPoint;

    @Column(name = "penalty_point")
    private Integer penaltyPoint;

    @Column(name = "has_no_allocation_needs")
    private Boolean hasNoAllocationNeeds;

    @Lob
    @Column(name = "milestones_json", columnDefinition = "TEXT")
    private String milestonesJson;

    @Column(name = "total_weighted_number")
    private Integer totalWeightedNumber;
}


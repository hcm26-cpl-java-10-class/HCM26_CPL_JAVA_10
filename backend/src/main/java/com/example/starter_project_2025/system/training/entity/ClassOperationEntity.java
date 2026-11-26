package com.example.starter_project_2025.system.training.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_operations")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassOperationEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false, unique = true)
    private TrainingClass trainingClass;

    public Long getClassId() {
        return trainingClass != null ? trainingClass.getId() : null;
    }

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

    // TEXT is a character column in the existing schema (VARCHAR in H2).
    // @Lob would instead make schema validation require a JDBC CLOB.
    @Column(name = "milestones_json", columnDefinition = "TEXT")
    private String milestonesJson;

    @Column(name = "total_weighted_number")
    private Integer totalWeightedNumber;

    public static class ClassOperationEntityBuilder {
        public ClassOperationEntityBuilder classId(Long classId) {
            if (classId != null) {
                TrainingClass tc = new TrainingClass();
                tc.setId(classId);
                this.trainingClass = tc;
            }
            return this;
        }
    }
}


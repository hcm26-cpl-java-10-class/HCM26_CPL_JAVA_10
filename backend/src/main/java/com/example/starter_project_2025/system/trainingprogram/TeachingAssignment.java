package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Entity
@Table(name = "teaching_assignments", indexes = {
        @Index(name = "idx_assignment_class_subject", columnList = "class_id, program_subject_id"),
        @Index(name = "idx_assignment_trainer_dates", columnList = "trainer_id, effective_from, effective_to")
})
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("ASSIGNMENT")
public class TeachingAssignment extends BaseEntity {
    /** ID of the class in the shared system; class profile data stays there. */
    @Column(name = "class_id", nullable = false)
    Long classId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_subject_id", nullable = false)
    ProgramSubject programSubject;

    /** ID of the trainer in the shared system; trainer profile data stays there. */
    @Column(name = "trainer_id", nullable = false)
    Long trainerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    AssignmentRole role;

    @Column(name = "effective_from", nullable = false)
    LocalDate effectiveFrom;

    @Column(name = "effective_to")
    LocalDate effectiveTo;
}

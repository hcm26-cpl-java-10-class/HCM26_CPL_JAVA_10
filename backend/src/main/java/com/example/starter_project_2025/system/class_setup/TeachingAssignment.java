package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@Entity
@Table(name = "teaching_assignments",
       indexes = {
           @Index(name = "idx_ta_class_program_subject", columnList = "class_id, program_subject_id"),
           @Index(name = "idx_ta_trainer", columnList = "trainer_id")
       })
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("TEACHING_ASSIGNMENT")
public class TeachingAssignment extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    Long classId;

    // ID of ProgramSubject from BOSS module (keeps reference to curriculum subject item)
    @Column(name = "program_subject_id", nullable = false)
    Long programSubjectId;

    // Reference to User with TEACHER role from core/RBAC system
    @Column(name = "trainer_id", nullable = false)
    Long trainerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    AssignmentRole role = AssignmentRole.MAIN;

    @Column(name = "effective_from", nullable = false)
    LocalDate effectiveFrom;

    @Column(name = "effective_to")
    LocalDate effectiveTo;
}

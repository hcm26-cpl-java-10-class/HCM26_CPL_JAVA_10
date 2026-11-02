package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.OrderColumn;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

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
@ResourceMenu(title = "Teaching Assignments", group = "Subjects & Scheduling", icon = "users",
        url = "/teaching-assignments", order = 4, permission = "ASSIGNMENT_READ")
public class TeachingAssignment extends BaseEntity {
    @Version
    Long revision;

    /** Sticky usage marker, retained even after linked sessions are moved or removed. */
    @Column(nullable = false)
    Boolean everUsed = false;

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

    @ElementCollection
    @CollectionTable(name = "teaching_assignment_slots", joinColumns = @JoinColumn(name = "assignment_id"))
    @OrderColumn(name = "slot_order")
    List<AssignmentTeachingSlot> teachingSlots = new ArrayList<>();
}

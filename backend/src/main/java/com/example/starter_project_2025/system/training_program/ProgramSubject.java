package com.example.starter_project_2025.system.training_program;

import jakarta.persistence.*;
import lombok.*;

@Entity(name = "AcademicProgramSubject")
@Table(name = "program_subjects",
       uniqueConstraints = @UniqueConstraint(name = "uk_program_subject", columnNames = {"program_id", "subject_id"}),
       indexes = @Index(name = "idx_program_subject_order", columnList = "program_id, order_index"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProgramSubject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    TrainingProgram program;

    // ID owned by Minh Hoang's Subject module. Kept as ID to avoid duplicating Subject data.
    @Column(name = "subject_id", nullable = false)
    Long subjectId;

    @Column(name = "order_index", nullable = false)
    Integer orderIndex;
}

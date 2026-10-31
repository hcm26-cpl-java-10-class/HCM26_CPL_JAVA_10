package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "program_subjects")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ProgramSubject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    private TrainingProgram program;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;
}

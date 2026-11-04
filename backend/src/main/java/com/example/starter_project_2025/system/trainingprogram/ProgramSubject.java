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

    // Snapshot fields preserved per program version
    @Column(name = "subject_code", length = 50)
    private String subjectCode;

    @Column(name = "subject_name", length = 255)
    private String subjectName;

    @Column(name = "subject_version", length = 20)
    private String subjectVersion;

    @Column(name = "duration_hours")
    private Integer durationHours;

    public String resolveCode() {
        return subjectCode != null && !subjectCode.isBlank() ? subjectCode : (subject != null ? subject.getCode() : null);
    }

    public String resolveName() {
        return subjectName != null && !subjectName.isBlank() ? subjectName : (subject != null ? subject.getName() : null);
    }

    public String resolveVersion() {
        return subjectVersion != null && !subjectVersion.isBlank() ? subjectVersion : (subject != null ? subject.getVersion() : null);
    }

    public Integer resolveDurationHours() {
        return durationHours != null ? durationHours : (subject != null ? subject.getDurationHours() : null);
    }
}

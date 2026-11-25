package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "program_subjects")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProgramSubject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    TrainingProgram program;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "subject_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    Subject subject;

    @Column(name = "order_index", nullable = false)
    Integer orderIndex;

    // Snapshot fields preserved per program version
    @Column(name = "subject_code", length = 50)
    String subjectCode;

    @Column(name = "subject_name", length = 255)
    String subjectName;

    @Column(name = "subject_version", length = 20)
    String subjectVersion;

    @Column(name = "duration_hours")
    Integer durationHours;

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

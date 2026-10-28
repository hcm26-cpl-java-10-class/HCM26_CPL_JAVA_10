package com.example.trainingprogram.entity;

import jakarta.persistence.*;

@Entity
@Table(
    name = "training_program_subjects",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_program_subject", columnNames = {"program_id", "subject_id"}),
        @UniqueConstraint(name = "uk_program_order", columnNames = {"program_id", "order_index"})
    }
)
public class TrainingProgramSubject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    private TrainingProgram program;

    // Subject is owned by the Subject module/service; keep its ID rather than a cross-module JPA relation.
    @Column(name = "subject_id", nullable = false)
    private Long subjectId;

    @Column(name = "subject_code", length = 80)
    private String subjectCode;

    @Column(name = "subject_name", length = 200)
    private String subjectName;

    @Column(name = "duration_hours", nullable = false)
    private Integer durationHours;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    public Long getId() { return id; }
    public Long getSubjectId() { return subjectId; }
    public void setSubjectId(Long subjectId) { this.subjectId = subjectId; }
    public String getSubjectCode() { return subjectCode; }
    public void setSubjectCode(String subjectCode) { this.subjectCode = subjectCode; }
    public String getSubjectName() { return subjectName; }
    public void setSubjectName(String subjectName) { this.subjectName = subjectName; }
    public Integer getDurationHours() { return durationHours; }
    public void setDurationHours(Integer durationHours) { this.durationHours = durationHours; }
    public Integer getOrderIndex() { return orderIndex; }
    public void setOrderIndex(Integer orderIndex) { this.orderIndex = orderIndex; }
    public TrainingProgram getProgram() { return program; }
    public void setProgram(TrainingProgram program) { this.program = program; }
}

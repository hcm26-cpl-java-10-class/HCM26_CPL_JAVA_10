package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Check;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "training_class_revisions", uniqueConstraints =
        @UniqueConstraint(name = "uk_class_revision_number", columnNames = {"class_id", "revision_no"}))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Check(constraints = "capacity BETWEEN 1 AND 50 AND end_date >= start_date AND revision_no > 0")
public class TrainingClassRevision extends BaseEntity {
    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    private TrainingClass trainingClass;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo;

    private Long baseRevisionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ClassRevisionStatus status;

    @Column(nullable = false)
    private String name;
    @Column(length = 2000)
    private String description;
    @Column(nullable = false)
    private String traineeType;
    @Column(nullable = false)
    private String deliveryFormat;
    @Column(nullable = false)
    private String site;
    @Column(nullable = false)
    private String location;
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;
    @Column(nullable = false)
    private Integer capacity;

    private Long submittedBy;
    private LocalDateTime submittedAt;
    private Long reviewedBy;
    private LocalDateTime reviewedAt;
    @Column(length = 2000)
    private String rejectionReason;
}

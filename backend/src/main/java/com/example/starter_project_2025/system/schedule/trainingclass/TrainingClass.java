package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Check;
import com.example.starter_project_2025.init.annotation.ResourceMenu;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "training_classes", uniqueConstraints =
        @UniqueConstraint(name = "uk_training_class_code", columnNames = "class_code"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@ResourcePermission("TRAINING_CLASS")
@ResourceMenu(
        title = "Training Classes",
        group = "Training Management",
        icon = "graduation-cap",
        url = "/training-classes",
        permission = "TRAINING_CLASS_READ"
)
@Check(constraints = "capacity BETWEEN 1 AND 50 AND end_date >= start_date")
public class TrainingClass extends BaseEntity {
    @Column(name = "open_class_request_id")
    private Long openClassRequestId;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_revision_id")
    private TrainingClassRevision currentRevision;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pending_revision_id")
    private TrainingClassRevision pendingRevision;

    @Builder.Default
    @Column(nullable = false)
    private Integer lastIssuedRevisionNo = 0;

    private LocalDateTime lastRevisionActivityAt;

    @Column(name = "class_code", nullable = false)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(name = "trainee_type", nullable = false)
    private String traineeType;

    @Column(name = "delivery_format", nullable = false)
    private String deliveryFormat;

    @Column(nullable = false)
    private String site;

    @Column(nullable = false)
    private String location;

    @Column(name = "program_version_id", nullable = false)
    private Long programVersionId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ClassStatus status = ClassStatus.PLANNING;
}

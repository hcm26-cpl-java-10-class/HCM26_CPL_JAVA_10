package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Check;

import java.time.LocalDate;

@Entity
@Table(name = "training_classes")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@ResourcePermission("TRAINING_CLASS")
@Check(constraints = "capacity > 0 AND end_date >= start_date")
public class TrainingClass extends BaseEntity {

    @Column(name = "class_code", nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

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
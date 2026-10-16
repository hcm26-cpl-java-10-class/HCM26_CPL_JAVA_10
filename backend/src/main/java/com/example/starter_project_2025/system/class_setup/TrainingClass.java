package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@Entity
@Table(name = "training_classes",
       uniqueConstraints = @UniqueConstraint(name = "uk_training_class_code", columnNames = {"code"}))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("TRAINING_CLASS")
@ResourceMenu(
        title = "Training Classes",
        group = "Academic Management",
        icon = "layout-grid",
        url = "/classes",
        order = 25,
        permission = "TRAINING_CLASS_READ"
)
public class TrainingClass extends BaseEntity {

    @Column(nullable = false, length = 50)
    String code;

    @Column(nullable = false, length = 150)
    String name;

    @Column(name = "program_id")
    Long programId;

    @Column(name = "start_date")
    LocalDate startDate;

    @Column(name = "end_date")
    LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    ClassStatus status = ClassStatus.PLANNING;

    @Column(name = "planned_size")
    Integer plannedSize;
}

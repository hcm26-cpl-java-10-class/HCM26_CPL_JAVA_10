package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/** Stores only the program link for a class owned by the shared system. */
@Entity
@Table(name = "class_training_programs", indexes = {
        @Index(name = "uk_class_training_program_class_id", columnList = "class_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("CLASS")
@ResourceMenu(title = "Class Study Plans", group = "Subjects & Scheduling", icon = "graduation-cap",
        url = "/class-setup", order = 3, permission = "CLASS_READ")
public class ClassTrainingProgram extends BaseEntity {
    @Column(name = "class_id", nullable = false)
    Long classId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "program_id", nullable = false)
    TrainingProgram program;
}

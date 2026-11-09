package com.example.starter_project_2025.system.training.entity;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity(name = "TrainingOperationClass")
@Table(name = "training_operation_classes")
@ResourcePermission("CLASS")
@Getter @Setter @NoArgsConstructor
public class TrainingClass extends BaseEntity {
    @Column(nullable = false, unique = true, length = 30)
    private String code;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(nullable = false, length = 30)
    private String status;
    @Column(nullable = false)
    private LocalDate startDate;
    @Column(nullable = false)
    private LocalDate endDate;
    @Column(nullable = false)
    private Integer plannedSize;
    @Column(length = 255)
    private String site;
    @Column(length = 255)
    private String traineeType;
    @Column(length = 255)
    private String program;
    @Column(length = 255)
    private String classAdmin;
    @Column(length = 255)
    private String masterTrainer;
    @Column(length = 255)
    private String deliveryType;
    @Column(length = 255)
    private String formatType;
    @Column(length = 255)
    private String skills;
    @Column(length = 255)
    private String location;
}

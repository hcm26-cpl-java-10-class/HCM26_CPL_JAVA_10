package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Membership only. Personal profiles stay in the existing master trainee directory. */
@Entity
@Table(name = "class_enrollments", uniqueConstraints = @UniqueConstraint(
        name = "uk_class_enrollment_trainee", columnNames = {"class_id", "trainee_id"}))
@ResourcePermission("ENROLLMENT")
@Getter @Setter @NoArgsConstructor
public class ClassEnrollment extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    private TrainingClass trainingClass;
    @Column(name = "trainee_id", nullable = false)
    private Long traineeId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ACTIVE;
    public enum Status { ACTIVE, INACTIVE, DROPPED_OUT }
}

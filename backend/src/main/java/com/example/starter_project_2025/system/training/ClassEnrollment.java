package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    @Column(name = "student_id", length = 64)
    private String studentId;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(name = "personal_email", length = 254)
    private String personalEmail;

    @Column(name = "dob", length = 20)
    private String dob;

    @Column(name = "gender", length = 20)
    private String gender;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.ACTIVE;

    public enum Status { ACTIVE, INACTIVE, DROPPED_OUT }
}

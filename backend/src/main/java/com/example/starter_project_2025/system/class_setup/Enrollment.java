package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@Entity
@Table(name = "enrollments",
       uniqueConstraints = @UniqueConstraint(name = "uk_student_class", columnNames = {"student_id", "class_id"}))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("ENROLLMENT")
public class Enrollment extends BaseEntity {

    @Column(name = "student_id", nullable = false)
    Long studentId;

    @Column(name = "class_id", nullable = false)
    Long classId;

    @Column(name = "enrolled_at")
    @Builder.Default
    LocalDate enrolledAt = LocalDate.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    EnrollmentStatus status = EnrollmentStatus.ENROLLED;
}

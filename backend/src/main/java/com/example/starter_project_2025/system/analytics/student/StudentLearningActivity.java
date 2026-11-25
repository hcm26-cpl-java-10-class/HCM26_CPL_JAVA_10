package com.example.starter_project_2025.system.analytics.student;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import java.time.Instant;

@Entity
@Table(name = "student_learning_activity", indexes = {
        @Index(name = "idx_learning_activity_time", columnList = "occurred_at"),
        @Index(name = "idx_learning_activity_enrollment_time", columnList = "enrollment_id,occurred_at")
})
@Getter
@Setter
@NoArgsConstructor
public class StudentLearningActivity extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrollment_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private CourseEnrollment enrollment;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}

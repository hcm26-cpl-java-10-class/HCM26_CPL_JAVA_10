package com.example.starter_project_2025.system.demo.lessonreport;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(
        name = "lesson_reports",
        indexes = {
                @Index(name = "idx_lesson_reports_lesson", columnList = "lesson_id"),
                @Index(name = "idx_lesson_reports_reporter_lesson", columnList = "reporter_id, lesson_id")
        }
)
@ResourcePermission("LESSON_REPORT")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LessonReport extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lesson_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    Lesson lesson;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    User reporter;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    LessonReportReason reason;

    @Column(length = 1000)
    String detail;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    LessonReportStatus status = LessonReportStatus.OPEN;
}

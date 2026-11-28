package com.example.starter_project_2025.system.demo.learningpath;

import com.example.starter_project_2025.system.rbac.user.User;
import java.time.LocalDateTime;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Proof that a learner finished every course of a path. completionCode is shown on the learner's page. */
@Entity
@Table(name = "learning_path_completions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_path_completion_user", columnNames = {"user_id", "path_id"}),
                @UniqueConstraint(name = "uk_path_completion_code", columnNames = "completion_code")})
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LearningPathCompletion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "path_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    LearningPath path;

    @Column(name = "completion_code", nullable = false, length = 40)
    String completionCode;

    @Column(nullable = false)
    LocalDateTime completedAt;
}

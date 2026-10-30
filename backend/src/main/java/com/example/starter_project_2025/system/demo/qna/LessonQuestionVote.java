package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** Một lượt upvote của một người dùng cho một câu hỏi (mỗi người chỉ được một lượt / câu hỏi). */
@Entity
@Table(
        name = "lesson_question_votes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_lesson_question_votes_question_user",
                columnNames = {"question_id", "user_id"}
        ),
        indexes = @Index(name = "idx_lesson_question_votes_user", columnList = "user_id")
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LessonQuestionVote extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    LessonQuestion question;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    User user;
}
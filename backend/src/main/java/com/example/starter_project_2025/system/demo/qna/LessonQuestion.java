package com.example.starter_project_2025.system.demo.qna;

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

import java.time.LocalDateTime;

/** Câu hỏi của học viên dưới một bài học. */
@Entity
@Table(
        name = "lesson_questions",
        indexes = {
                @Index(name = "idx_lesson_questions_lesson", columnList = "lesson_id"),
                @Index(name = "idx_lesson_questions_author_created", columnList = "author_id, created_at")
        }
)
@ResourcePermission("LESSON_QUESTION")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LessonQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lesson_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    Lesson lesson;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    User author;

    @Column(nullable = false, length = 2000)
    String content;

    /** Câu hỏi được giảng viên / admin ghim lên đầu danh sách. */
    @Column(nullable = false)
    boolean pinned;

    /** Thời điểm ghim; null nếu không được ghim. */
    LocalDateTime pinnedAt;

    /** Số lượt upvote (số liệu phi chuẩn hóa từ {@link LessonQuestionVote}, để sắp xếp nhanh). */
    @Column(nullable = false)
    int upvoteCount;

    /**
     * Id của câu trả lời được đánh dấu là đúng (accepted answer); null nếu chưa có.
     * Lưu dạng id thay vì quan hệ để xóa câu trả lời không dính ràng buộc khóa ngoại vòng tròn.
     */
    Long acceptedAnswerId;
}
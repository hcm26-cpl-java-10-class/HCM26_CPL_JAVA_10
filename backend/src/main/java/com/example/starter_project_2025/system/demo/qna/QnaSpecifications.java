package com.example.starter_project_2025.system.demo.qna;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/** Các điều kiện truy vấn động cho câu hỏi Q&A. */
final class QnaSpecifications {

    private QnaSpecifications() {
    }

    /**
     * Câu hỏi của một bài học. Nếu có {@code patterns}, mỗi từ phải xuất hiện trong nội dung
     * câu hỏi <em>hoặc</em> trong nội dung một câu trả lời của câu hỏi đó (các từ kết hợp bằng AND).
     */
    static Specification<LessonQuestion> inLesson(Long lessonId, List<String> patterns) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("lesson").get("id"), lessonId));
            for (String pattern : patterns) {
                predicates.add(cb.or(
                        like(cb, root.<String>get("content"), pattern),
                        cb.exists(answerMatching(query, cb, root, pattern))
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Câu hỏi chưa có câu trả lời nào.
     *
     * @param instructorId chỉ lấy khóa học do giảng viên này sở hữu; {@code null} = mọi khóa học (admin)
     * @param courseId     chỉ lấy một khóa học; {@code null} = không lọc
     * @param patterns     mỗi từ phải khớp nội dung câu hỏi, tiêu đề bài học hoặc tên người hỏi
     */
    static Specification<LessonQuestion> unanswered(Long instructorId, Long courseId, List<String> patterns) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            Subquery<Long> anyAnswer = query.subquery(Long.class);
            Root<LessonAnswer> answer = anyAnswer.from(LessonAnswer.class);
            anyAnswer.select(answer.<Long>get("id")).where(cb.equal(answer.get("question"), root));
            predicates.add(cb.not(cb.exists(anyAnswer)));

            Path<Object> course = root.get("lesson").get("section").get("course");
            if (instructorId != null) {
                predicates.add(cb.equal(course.get("instructorUser").get("id"), instructorId));
            }
            if (courseId != null) {
                predicates.add(cb.equal(course.get("id"), courseId));
            }

            for (String pattern : patterns) {
                predicates.add(cb.or(
                        like(cb, root.<String>get("content"), pattern),
                        like(cb, root.get("lesson").<String>get("title"), pattern),
                        like(cb, root.get("author").<String>get("firstName"), pattern),
                        like(cb, root.get("author").<String>get("lastName"), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static Subquery<Long> answerMatching(
            CriteriaQuery<?> query, CriteriaBuilder cb, Root<LessonQuestion> question, String pattern
    ) {
        Subquery<Long> subquery = query.subquery(Long.class);
        Root<LessonAnswer> answer = subquery.from(LessonAnswer.class);
        subquery.select(answer.<Long>get("id")).where(
                cb.equal(answer.get("question"), question),
                like(cb, answer.<String>get("content"), pattern)
        );
        return subquery;
    }

    private static Predicate like(CriteriaBuilder cb, Expression<String> expression, String pattern) {
        return cb.like(cb.lower(expression), pattern, QnaSearchTerms.ESCAPE);
    }
}

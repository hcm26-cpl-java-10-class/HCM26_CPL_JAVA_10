package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface LessonQuestionRepository extends BaseCrudRepository<LessonQuestion, Long> {

    @EntityGraph(attributePaths = "author")
    Page<LessonQuestion> findByLesson_Id(Long lessonId, Pageable pageable);

    @EntityGraph(attributePaths = "author")
    Optional<LessonQuestion> findByIdAndLesson_Id(Long id, Long lessonId);

    /** Câu hỏi gần nhất của một người (dùng cho cooldown). */
    Optional<LessonQuestion> findFirstByAuthor_IdOrderByCreatedAtDescIdDesc(Long authorId);

    /** Số câu hỏi của một người từ một mốc thời gian (dùng cho trần theo ngày). */
    long countByAuthor_IdAndCreatedAtAfter(Long authorId, LocalDateTime since);

    /** Đã hỏi đúng nội dung này ở bài học này chưa (không phân biệt hoa thường). */
    boolean existsByLesson_IdAndAuthor_IdAndContentIgnoreCase(Long lessonId, Long authorId, String content);

    /**
     * Truy vấn động bằng {@link QnaSpecifications} (tìm kiếm trong bài học, danh sách chưa trả lời).
     * Nạp sẵn người hỏi và vị trí bài học/chương/khóa học để không bị N+1 khi dựng DTO.
     */
    @Override
    @EntityGraph(attributePaths = {"author", "lesson", "lesson.section", "lesson.section.course"})
    Page<LessonQuestion> findAll(Specification<LessonQuestion> spec, Pageable pageable);

    /** Số câu hỏi chưa trả lời theo khóa học, trên toàn hệ thống (dành cho admin). */
    @Query("""
            select new com.example.starter_project_2025.system.demo.qna.CourseUnansweredCount(
                course.id, course.name, count(q))
            from LessonQuestion q
              join q.lesson lesson
              join lesson.section section
              join section.course course
            where not exists (select 1 from LessonAnswer a where a.question = q)
            group by course.id, course.name
            order by course.name asc
            """)
    List<CourseUnansweredCount> countUnansweredByCourse();

    /** Như trên nhưng chỉ các khóa học do một giảng viên sở hữu. */
    @Query("""
            select new com.example.starter_project_2025.system.demo.qna.CourseUnansweredCount(
                course.id, course.name, count(q))
            from LessonQuestion q
              join q.lesson lesson
              join lesson.section section
              join section.course course
            where not exists (select 1 from LessonAnswer a where a.question = q)
              and course.instructorUser.id = :instructorId
            group by course.id, course.name
            order by course.name asc
            """)
    List<CourseUnansweredCount> countUnansweredByCourseForInstructor(@Param("instructorId") Long instructorId);
}
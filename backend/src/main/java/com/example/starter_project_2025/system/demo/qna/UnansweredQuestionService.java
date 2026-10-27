package com.example.starter_project_2025.system.demo.qna;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Hàng đợi câu hỏi chưa trả lời cho giảng viên: gom câu hỏi "Awaiting answer" của mọi khóa học
 * mà giảng viên sở hữu (admin thấy tất cả), câu hỏi chờ lâu nhất xếp trước.
 */
@Service
@RequiredArgsConstructor
public class UnansweredQuestionService {

    static final int MAX_PAGE_SIZE = 50;

    private final LessonQuestionRepository questionRepository;

    @Transactional(readOnly = true)
    public Page<UnansweredQuestionDTO> getUnanswered(
            LessonQnaService.Viewer viewer, Long courseId, String keyword, Pageable pageable
    ) {
        requireViewer(viewer);
        List<String> patterns = QnaSearchTerms.toLikePatterns(keyword);
        Long instructorId = viewer.administrator() ? null : viewer.userId();

        return questionRepository
                .findAll(QnaSpecifications.unanswered(instructorId, courseId, patterns), sanitize(pageable))
                .map(UnansweredQuestionService::toDto);
    }

    @Transactional(readOnly = true)
    public List<CourseUnansweredCount> countByCourse(LessonQnaService.Viewer viewer) {
        requireViewer(viewer);
        return viewer.administrator()
                ? questionRepository.countUnansweredByCourse()
                : questionRepository.countUnansweredByCourseForInstructor(viewer.userId());
    }

    private static UnansweredQuestionDTO toDto(LessonQuestion question) {
        var lesson = question.getLesson();
        var section = lesson.getSection();
        var course = section.getCourse();
        return new UnansweredQuestionDTO(
                question.getId(),
                question.getContent(),
                question.getAuthor().getId(),
                question.getAuthor().getFullName(),
                question.getCreatedAt(),
                lesson.getId(),
                lesson.getTitle(),
                section.getId(),
                section.getTitle(),
                course.getId(),
                course.getName()
        );
    }

    private static void requireViewer(LessonQnaService.Viewer viewer) {
        if (viewer == null || viewer.userId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
    }

    /** Câu hỏi chờ lâu nhất lên đầu để giảng viên xử lý theo thứ tự. */
    private static Pageable sanitize(Pageable pageable) {
        int size = Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        Sort sort = Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"));
        return PageRequest.of(Math.max(pageable.getPageNumber(), 0), size, sort);
    }
}

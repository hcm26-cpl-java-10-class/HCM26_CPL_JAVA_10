package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.CourseContentAccessGuard;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Hỏi đáp theo bài học: học viên đặt câu hỏi, giảng viên của khóa học (hoặc admin) trả lời.
 *
 * <ul>
 *   <li>Xem / đặt câu hỏi: admin, giảng viên sở hữu khóa học, hoặc học viên đã ghi danh khóa học đó.</li>
 *   <li>Trả lời: chỉ admin hoặc giảng viên sở hữu khóa học.</li>
 *   <li>Sửa câu hỏi: chỉ tác giả, và chỉ khi chưa có câu trả lời.</li>
 *   <li>Xóa câu hỏi: tác giả, giảng viên sở hữu khóa học hoặc admin.</li>
 *   <li>Sửa câu trả lời: chỉ tác giả. Xóa câu trả lời: tác giả hoặc admin.</li>
 *   <li>Tìm kiếm: lọc câu hỏi của bài học theo từ khóa (khớp nội dung câu hỏi hoặc câu trả lời).</li>
 *   <li>Thông báo email (bất đồng bộ, sau khi commit): giảng viên khi có câu hỏi mới,
 *       người hỏi khi được trả lời. Xem {@link QnaNotificationListener}.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class LessonQnaService {

    static final int MAX_PAGE_SIZE = 50;
    static final int MAX_CONTENT_LENGTH = QnaContentPolicy.MAX_LENGTH;

    private final LessonQuestionRepository questionRepository;
    private final LessonAnswerRepository answerRepository;
    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final CourseContentAccessGuard accessGuard;
    private final ApplicationEventPublisher eventPublisher;
    private final QnaRateLimiter rateLimiter;

    /** Người đang gọi API. */
    public record Viewer(Long userId, boolean administrator) {
    }

    private record Access(Lesson lesson, Course course, boolean administrator, boolean instructor) {
        boolean canModerate() {
            return administrator || instructor;
        }
    }

    // ------------------------------------------------------------------ questions

    @Transactional(readOnly = true)
    public Page<LessonQuestionDTO> getQuestions(Viewer viewer, Long lessonId, String keyword, Pageable pageable) {
        Access access = requireAccess(viewer, lessonId);
        Pageable safePageable = sanitize(pageable);

        List<String> patterns = QnaSearchTerms.toLikePatterns(keyword);
        Page<LessonQuestion> page = patterns.isEmpty()
                ? questionRepository.findByLesson_Id(lessonId, safePageable)
                : questionRepository.findAll(QnaSpecifications.inLesson(lessonId, patterns), safePageable);
        if (page.isEmpty()) {
            return new PageImpl<>(List.of(), safePageable, page.getTotalElements());
        }

        List<Long> questionIds = page.getContent().stream().map(LessonQuestion::getId).toList();
        Map<Long, List<LessonAnswer>> answersByQuestion = answerRepository
                .findByQuestion_IdInOrderByCreatedAtAscIdAsc(questionIds)
                .stream()
                .collect(Collectors.groupingBy(answer -> answer.getQuestion().getId()));

        return page.map(question -> toDto(
                question,
                answersByQuestion.getOrDefault(question.getId(), List.of()),
                viewer,
                access
        ));
    }

    @Transactional
    public LessonQuestionDTO createQuestion(Viewer viewer, Long lessonId, String content) {
        Access access = requireAccess(viewer, lessonId);
        User author = requireUser(viewer);

        String text = QnaContentPolicy.normalize(content);
        rateLimiter.checkCanAsk(author.getId(), lessonId, text, LocalDateTime.now());

        LessonQuestion question = questionRepository.save(LessonQuestion.builder()
                .lesson(access.lesson())
                .author(author)
                .content(text)
                .build());

        publishQuestionPosted(access, author, question);
        return toDto(question, List.of(), viewer, access);
    }

    @Transactional
    public LessonQuestionDTO updateQuestion(Viewer viewer, Long lessonId, Long questionId, String content) {
        Access access = requireAccess(viewer, lessonId);
        LessonQuestion question = requireQuestion(lessonId, questionId);

        if (!isAuthor(question.getAuthor(), viewer)) {
            throw forbidden("You can only edit your own questions");
        }
        if (answerRepository.existsByQuestion_Id(questionId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "A question that already has answers can no longer be edited");
        }

        question.setContent(QnaContentPolicy.normalize(content));
        LessonQuestion saved = questionRepository.save(question);
        return toDto(saved, List.of(), viewer, access);
    }

    @Transactional
    public void deleteQuestion(Viewer viewer, Long lessonId, Long questionId) {
        Access access = requireAccess(viewer, lessonId);
        LessonQuestion question = requireQuestion(lessonId, questionId);

        if (!isAuthor(question.getAuthor(), viewer) && !access.canModerate()) {
            throw forbidden("You are not allowed to delete this question");
        }
        questionRepository.delete(question);
    }

    // -------------------------------------------------------------------- answers

    @Transactional
    public LessonQuestionDTO createAnswer(Viewer viewer, Long lessonId, Long questionId, String content) {
        Access access = requireAccess(viewer, lessonId);
        if (!access.canModerate()) {
            throw forbidden("Only the course instructor can answer questions");
        }
        LessonQuestion question = requireQuestion(lessonId, questionId);
        User author = requireUser(viewer);

        LessonAnswer answer = answerRepository.save(LessonAnswer.builder()
                .question(question)
                .author(author)
                .content(QnaContentPolicy.normalize(content))
                .build());

        publishQuestionAnswered(access, author, question, answer);
        return reload(question, viewer, access);
    }

    @Transactional
    public LessonQuestionDTO updateAnswer(
            Viewer viewer, Long lessonId, Long questionId, Long answerId, String content
    ) {
        Access access = requireAccess(viewer, lessonId);
        LessonQuestion question = requireQuestion(lessonId, questionId);
        LessonAnswer answer = requireAnswer(questionId, answerId);

        if (!isAuthor(answer.getAuthor(), viewer)) {
            throw forbidden("You can only edit your own answers");
        }

        answer.setContent(QnaContentPolicy.normalize(content));
        answerRepository.save(answer);
        return reload(question, viewer, access);
    }

    @Transactional
    public LessonQuestionDTO deleteAnswer(Viewer viewer, Long lessonId, Long questionId, Long answerId) {
        Access access = requireAccess(viewer, lessonId);
        LessonQuestion question = requireQuestion(lessonId, questionId);
        LessonAnswer answer = requireAnswer(questionId, answerId);

        if (!isAuthor(answer.getAuthor(), viewer) && !viewer.administrator()) {
            throw forbidden("You are not allowed to delete this answer");
        }

        answerRepository.delete(answer);
        return reload(question, viewer, access);
    }

    // -------------------------------------------------------------------- helpers

    private Access requireAccess(Viewer viewer, Long lessonId) {
        if (viewer == null || viewer.userId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
        Course course = lesson.getSection().getCourse();

        boolean instructor = accessGuard.isOwner(course, viewer.userId());
        boolean enrolled = enrollmentRepository.existsByUser_IdAndCourse_Id(viewer.userId(), course.getId());
        if (!viewer.administrator() && !instructor && !enrolled) {
            throw forbidden("Enroll in this course to join the lesson Q&A");
        }
        return new Access(lesson, course, viewer.administrator(), instructor);
    }

    /** Báo cho giảng viên của khóa học (trừ khi chính họ là người đặt câu hỏi). */
    private void publishQuestionPosted(Access access, User asker, LessonQuestion question) {
        User instructor = access.course().getInstructorUser();
        if (!isNotifiable(instructor) || instructor.getId().equals(asker.getId())) {
            return;
        }
        Lesson lesson = access.lesson();
        eventPublisher.publishEvent(new QnaNotificationEvents.QuestionPosted(
                instructor.getEmail(),
                instructor.getFullName(),
                asker.getFullName(),
                access.course().getName(),
                lesson.getTitle(),
                question.getContent(),
                access.course().getId(),
                lesson.getSection().getId(),
                lesson.getId(),
                question.getId()
        ));
    }

    /** Báo cho người đặt câu hỏi (trừ khi họ tự trả lời câu hỏi của mình). */
    private void publishQuestionAnswered(Access access, User answerer, LessonQuestion question, LessonAnswer answer) {
        User asker = question.getAuthor();
        if (!isNotifiable(asker) || asker.getId().equals(answerer.getId())) {
            return;
        }
        Long enrollmentId = enrollmentRepository
                .findByUser_IdAndCourse_Id(asker.getId(), access.course().getId())
                .map(CourseEnrollment::getId)
                .orElse(null);
        eventPublisher.publishEvent(new QnaNotificationEvents.QuestionAnswered(
                asker.getEmail(),
                asker.getFullName(),
                answerer.getFullName(),
                access.course().getName(),
                access.lesson().getTitle(),
                question.getContent(),
                answer.getContent(),
                enrollmentId,
                access.lesson().getId(),
                question.getId()
        ));
    }

    private static boolean isNotifiable(User user) {
        return user != null
                && user.getId() != null
                && user.getEmail() != null
                && !user.getEmail().isBlank()
                && !Boolean.FALSE.equals(user.getIsActive());
    }

    private User requireUser(Viewer viewer) {
        return userRepository.findById(viewer.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first"));
    }

    private LessonQuestion requireQuestion(Long lessonId, Long questionId) {
        return questionRepository.findByIdAndLesson_Id(questionId, lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Question not found"));
    }

    private LessonAnswer requireAnswer(Long questionId, Long answerId) {
        return answerRepository.findByIdAndQuestion_Id(answerId, questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Answer not found"));
    }

    private LessonQuestionDTO reload(LessonQuestion question, Viewer viewer, Access access) {
        List<LessonAnswer> answers = answerRepository.findByQuestion_IdOrderByCreatedAtAscIdAsc(question.getId());
        return toDto(question, answers, viewer, access);
    }

    private LessonQuestionDTO toDto(
            LessonQuestion question,
            List<LessonAnswer> answers,
            Viewer viewer,
            Access access
    ) {
        boolean answered = !answers.isEmpty();
        boolean own = isAuthor(question.getAuthor(), viewer);

        List<LessonQuestionDTO.AnswerDTO> answerDtos = answers.stream()
                .map(answer -> toAnswerDto(answer, viewer, access))
                .toList();

        return new LessonQuestionDTO(
                question.getId(),
                question.getLesson().getId(),
                question.getContent(),
                question.getAuthor().getId(),
                question.getAuthor().getFullName(),
                question.getCreatedAt(),
                question.getUpdatedAt(),
                answered,
                own && !answered,
                own || access.canModerate(),
                access.canModerate(),
                answerDtos
        );
    }

    private LessonQuestionDTO.AnswerDTO toAnswerDto(LessonAnswer answer, Viewer viewer, Access access) {
        User author = answer.getAuthor();
        boolean own = isAuthor(author, viewer);
        boolean byInstructor = access.course().getInstructorUser() != null
                && access.course().getInstructorUser().getId().equals(author.getId());

        return new LessonQuestionDTO.AnswerDTO(
                answer.getId(),
                answer.getQuestion().getId(),
                answer.getContent(),
                author.getId(),
                author.getFullName(),
                byInstructor,
                answer.getCreatedAt(),
                answer.getUpdatedAt(),
                own,
                own || viewer.administrator()
        );
    }

    private static boolean isAuthor(User author, Viewer viewer) {
        return author != null && author.getId() != null && author.getId().equals(viewer.userId());
    }

    private static Pageable sanitize(Pageable pageable) {
        int size = Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
        return PageRequest.of(Math.max(pageable.getPageNumber(), 0), size, sort);
    }

    private static ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }
}
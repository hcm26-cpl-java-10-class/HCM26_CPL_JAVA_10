package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.certificate.Certificate;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course_review.CourseReview;
import com.example.starter_project_2025.system.demo.course_review.CourseReviewRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Seed dữ liệu phục vụ demo/test cho trang Course Analytics.
 *
 * <p>Mục tiêu: mỗi API trong {@code /api/reports} đều có dữ liệu thật để kiểm thử thủ công:
 * <ol>
 *   <li>lesson funnel: enrollment + lesson progress có tụt dần theo thứ tự bài</li>
 *   <li>trend: enrollment/completion/certificate rải rác trong 12 tháng</li>
 *   <li>activity: học viên active / idle / never-started và nhóm nguy cơ bỏ học</li>
 *   <li>review: rating 1-5 sao rải trên nhiều khóa học để có bảng xếp hạng</li>
 *   <li>exam: bài thi gắn với khóa học kèm lượt thi có điểm</li>
 * </ol>
 *
 * <p>Chạy sau {@link CourseDataInitializer} (khóa học + giáo trình) và
 * {@link DepartmentStudentDataInitializer} (học viên mẫu). Tắt bằng
 * {@code APP_SEED_COURSE_ANALYTICS_ENABLED=false}.
 */
@Slf4j
@Order(30)
@Component
@RequiredArgsConstructor
public class CourseAnalyticsDataInitializer implements CommandLineRunner {

    private static final String PRIMARY_COURSE_NAME = "Java Fundamentals";
    private static final int LEARNER_COUNT = 50;
    private static final String LEARNER_EMAIL_TEMPLATE = "student%02d@example.com";

    /** Số bài học viên tương ứng với index trong danh sách (dùng để dựng funnel). */
    private static final int[] COMPLETED_LESSON_PATTERN = {
            10, 10, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6,
            5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1,
            0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 10,
            10, 10, 2, 0
    };

    /** Ngày không truy cập gần nhất (null = chưa từng vào học). */
    private static final Integer[] IDLE_DAYS_PATTERN = {
            0, 1, 2, 3, 5, 8, 12, 16, 20, 26,
            33, 40, 47, 55, 62, 70, 80, 90, 100, 120,
            150, 180, 210, 240, 270, 300, 330, 360, 20, 45,
            null, null, null, null, 5, 11, 17, 23, 29, 36,
            50, 65, 75, 95, 110, 130, 150, 170, 200, 240
    };

    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonProgressRepository lessonProgressRepository;
    private final LessonRepository lessonRepository;
    private final CertificateRepository certificateRepository;
    private final CourseReviewRepository courseReviewRepository;
    private final ExamRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JdbcTemplate jdbc;

    @Value("${app.seed.course-analytics.enabled:true}")
    private boolean enabled;

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) {
            log.info("Course analytics seed disabled (app.seed.course-analytics.enabled=false).");
            return;
        }

        Course primary = courseRepository.findByName(PRIMARY_COURSE_NAME)
                .orElseThrow(() -> new IllegalStateException(
                        "Seed course not found: " + PRIMARY_COURSE_NAME));

        List<User> learners = loadLearners();
        if (learners.isEmpty()) {
            log.warn("Course analytics seed skipped: no learner accounts found.");
            return;
        }

        List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(primary.getId());
        if (lessons.isEmpty()) {
            log.warn("Course analytics seed skipped: course {} has no lessons.", primary.getName());
            return;
        }

        seedEnrollments(primary, learners, lessons);
        seedReviews(primary, learners);
        seedExams(primary, learners);

        log.info("Seeded course analytics demo data: course={}, learners={}, lessons={}.",
                primary.getName(), learners.size(), lessons.size());
    }

    // =====================================================================
    // Enrollment + lesson progress + certificate
    // =====================================================================

    private void seedEnrollments(Course course, List<User> learners, List<Lesson> lessons) {
        LocalDateTime now = LocalDateTime.now();
        int lessonCount = lessons.size();

        for (int i = 0; i < learners.size(); i++) {
            User learner = learners.get(i);
            int completedLessons = Math.min(
                    COMPLETED_LESSON_PATTERN[i % COMPLETED_LESSON_PATTERN.length], lessonCount);
            Integer idleDays = IDLE_DAYS_PATTERN[i % IDLE_DAYS_PATTERN.length];

            CourseEnrollment enrollment = enrollmentRepository
                    .findByUser_IdAndCourse_Id(learner.getId(), course.getId())
                    .orElseGet(CourseEnrollment::new);
            enrollment.setUser(learner);
            enrollment.setCourse(course);
            enrollment.setIsActive(true);
            enrollment.setLastAccessedAt(idleDays == null ? null : now.minusDays(idleDays));
            enrollment = enrollmentRepository.save(enrollment);

            // createdAt dùng @CreationTimestamp nên phải backdate bằng SQL sau khi insert.
            // Rải đăng ký trong 12 tháng gần nhất để biểu đồ "Xu hướng" có dữ liệu.
            LocalDateTime enrolledAt = now.minusDays(360 - (i * 7L) % 360)
                    .minusHours(i % 12)
                    .withSecond(0)
                    .withNano(0);
            jdbc.update("UPDATE course_enrollments SET created_at = ?, updated_at = ? WHERE id = ?",
                    enrolledAt, enrolledAt, enrollment.getId());

            seedProgress(enrollment, learner, lessons, completedLessons, enrolledAt, now);
            seedCertificate(course, learner, completedLessons, lessonCount, now);
        }
    }

    private void seedProgress(
            CourseEnrollment enrollment,
            User learner,
            List<Lesson> lessons,
            int completedLessons,
            LocalDateTime enrolledAt,
            LocalDateTime now
    ) {
        for (int index = 0; index < lessons.size(); index++) {
            Lesson lesson = lessons.get(index);
            LessonProgress progress = lessonProgressRepository
                    .findByEnrollment_IdAndLesson_Id(enrollment.getId(), lesson.getId())
                    .orElseGet(LessonProgress::new);
            progress.setEnrollment(enrollment);
            progress.setLesson(lesson);
            progress.setIsActive(true);

            boolean completed = index < completedLessons;
            progress.setCompleted(completed);

            if (completed) {
                // Rải bài hoàn thành đều trong khoảng từ lúc đăng ký đến hiện tại
                // để biểu đồ "Xu hướng" có dữ liệu trên cả 12 tháng.
                long windowDays = Math.max(1, ChronoUnit.DAYS.between(enrolledAt, now));
                long offset = windowDays - Math.min(windowDays,
                        (completedLessons - index) * (windowDays / (completedLessons + 1)));
                LocalDateTime completedAt = enrolledAt.plusDays(offset)
                        .minusHours(index % 9)
                        .withSecond(0)
                        .withNano(0);
                if (completedAt.isAfter(now)) {
                    completedAt = now.minusMinutes(index * 13L + 5);
                }
                progress.setCompletedAt(completedAt);
                progress.setLastAccessedAt(completedAt);
            } else {
                progress.setCompletedAt(null);
                progress.setLastAccessedAt(enrolledAt.plusDays(index % 3));
            }

            lessonProgressRepository.save(progress);
        }
    }

    private void seedCertificate(
            Course course,
            User learner,
            int completedLessons,
            int lessonCount,
            LocalDateTime now
    ) {
        if (completedLessons < lessonCount) {
            return;
        }
        Certificate certificate = certificateRepository
                .findByUser_IdAndCourse_Id(learner.getId(), course.getId())
                .orElseGet(Certificate::new);
        certificate.setUser(learner);
        certificate.setCourse(course);
        certificate.setIssuedAt(LocalDate.now().minusDays(1 + (Math.abs(learner.getEmail().hashCode()) % 120)));
        certificate.setIsActive(true);
        certificateRepository.save(certificate);
    }

    // =====================================================================
    // Review (phân bố 1-5 sao)
    // =====================================================================

    /** Rating theo thứ tự học viên để tạo phân bố đầy đủ 1..5 sao. */
    private static final int[] RATING_PATTERN = {
            5, 5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 2, 2, 1,
            5, 4, 3, 2, 1, 5, 5, 4, 4, 3, 3, 2, 1, 1, 5,
            4, 4, 3, 3, 2, 5, 5, 5, 4, 4, 3, 2, 1, 5, 4
    };

    private void seedReviews(Course primary, List<User> learners) {
        List<Course> courses = courseRepository.findAll();
        if (courses.isEmpty()) {
            return;
        }

        for (int c = 0; c < courses.size(); c++) {
            Course course = courses.get(c);
            // Mỗi khóa học lấy tập học viên khác nhau một chút để bảng xếp hạng có thứ hạng khác nhau.
            for (int i = 0; i < learners.size(); i++) {
                User learner = learners.get((i + c * 7) % learners.size());
                if (courseReviewRepository.existsByCourseIdAndUserId(course.getId(), learner.getId())) {
                    continue;
                }

                int rating = RATING_PATTERN[(i + c * 3) % RATING_PATTERN.length];
                CourseReview review = new CourseReview();
                review.setCourse(course);
                review.setUser(learner);
                review.setRating(rating);
                review.setComment(reviewComment(rating));
                review.setIsActive(true);
                courseReviewRepository.save(review);
            }
        }
    }

    private static String reviewComment(int rating) {
        return switch (rating) {
            case 5 -> "Nội dung rất rõ ràng, tài liệu hữu ích, giảng viên giải thích kỹ.";
            case 4 -> "Khóa học tốt, một số bài hơi dài nhưng đáng học.";
            case 3 -> "Nội dung ổn, cần thêm bài thực hành.";
            case 2 -> "Một số phần hơi khó theo dõi, tài liệu chưa đầy đủ.";
            default -> "Bài học chưa đáp ứng kỳ vọng, cần cải thiện nội dung.";
        };
    }

    // =====================================================================
    // Exam + attempts
    // =====================================================================

    private void seedExams(Course course, List<User> learners) {
        List<Exam> exams = new ArrayList<>();
        exams.add(ensureExam(course, "Java Basics Quiz",
                ExamCategory.QUIZ, BigDecimal.TEN, BigDecimal.valueOf(5), 20));
        exams.add(ensureExam(course, "OOP Midterm Test",
                ExamCategory.MIDTERM, BigDecimal.valueOf(100), BigDecimal.valueOf(50), 60));
        exams.add(ensureExam(course, "Final Assignment",
                ExamCategory.ASSIGNMENT, BigDecimal.TEN, BigDecimal.valueOf(6), 45));

        for (int e = 0; e < exams.size(); e++) {
            Exam exam = exams.get(e);
            for (int i = 0; i < learners.size(); i++) {
                User learner = learners.get(i);
                if (examAttemptRepository.findByExam_IdAndStudent_Id(exam.getId(), learner.getId()).isPresent()) {
                    continue;
                }

                ExamAttempt attempt = new ExamAttempt();
                attempt.setExam(exam);
                attempt.setStudent(learner);
                attempt.setAttemptNumber(1);
                attempt.setDurationMinutes(exam.getDurationMinutes());
                attempt.setTotalPoints(10);
                attempt.setMaxScore(exam.getMaxScore());
                attempt.setPassScore(exam.getPassScore());

                Instant startedAt = Instant.now().minus(3 + (i % 20), ChronoUnit.DAYS)
                        .minusSeconds(i * 137L);
                attempt.setStartedAt(startedAt);

                // Vài lượt chưa nộp để "Tổng lượt thi" khác "Lượt đã chấm".
                boolean notSubmitted = (i % 11 == 0);
                if (notSubmitted) {
                    attempt.setStatus(ExamAttemptStatus.IN_PROGRESS);
                } else {
                    attempt.setStatus(ExamAttemptStatus.SUBMITTED);
                    attempt.setSubmittedAt(startedAt.plus(20, ChronoUnit.MINUTES));
                    attempt.setFinalScore(scoreFor(exam, i, e));
                }
                examAttemptRepository.save(attempt);
            }
        }
    }

    /** Sinh điểm trong khoảng 30% - 100% để có cả vùng đạt và vùng không đạt. */
    private BigDecimal scoreFor(Exam exam, int learnerIndex, int examIndex) {
        BigDecimal max = exam.getMaxScore();
        int percent = 30 + ((learnerIndex * 7 + examIndex * 13) % 71);
        return max.multiply(BigDecimal.valueOf(percent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private Exam ensureExam(
            Course course,
            String title,
            ExamCategory category,
            BigDecimal maxScore,
            BigDecimal passScore,
            int durationMinutes
    ) {
        Optional<Exam> existing = examRepository.findAll().stream()
                .filter(e -> title.equals(e.getTitle())
                        && e.getCourse() != null
                        && course.getId().equals(e.getCourse().getId()))
                .findFirst();
        if (existing.isPresent()) {
            return existing.get();
        }

        Exam exam = new Exam();
        exam.setTitle(title);
        exam.setCourse(course);
        exam.setCategory(category);
        exam.setMaxScore(maxScore);
        exam.setPassScore(passScore);
        exam.setDurationMinutes(durationMinutes);
        exam.setMaxAttempts(3);
        exam.setIsActive(true);
        return examRepository.save(exam);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /** Lấy danh sách học viên mẫu (student01@example.com ... student50@example.com). */
    private List<User> loadLearners() {
        Role studentRole = roleRepository.findByName("STUDENT").orElse(null);

        List<User> learners = new ArrayList<>();
        for (int i = 1; i <= LEARNER_COUNT; i++) {
            String email = String.format(LEARNER_EMAIL_TEMPLATE, i);
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null || Boolean.FALSE.equals(user.getIsActive())) {
                continue;
            }
            if (studentRole != null && user.getRoles().stream().noneMatch(r -> "STUDENT".equals(r.getName()))) {
                user.getRoles().add(studentRole);
                user = userRepository.save(user);
            }
            learners.add(user);
        }
        return learners;
    }
}

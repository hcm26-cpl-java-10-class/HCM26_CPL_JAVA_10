package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.certificate.Certificate;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course_review.CourseReview;
import com.example.starter_project_2025.system.demo.course_review.CourseReviewRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.department.DepartmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.lessonreport.LessonReport;
import com.example.starter_project_2025.system.demo.lessonreport.LessonReportReason;
import com.example.starter_project_2025.system.demo.lessonreport.LessonReportRepository;
import com.example.starter_project_2025.system.demo.lessonreport.LessonReportStatus;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.demo.qna.LessonAnswer;
import com.example.starter_project_2025.system.demo.qna.LessonAnswerRepository;
import com.example.starter_project_2025.system.demo.qna.LessonQuestion;
import com.example.starter_project_2025.system.demo.qna.LessonQuestionRepository;
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

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Random;

@Slf4j
@Order(30)
@Component
@RequiredArgsConstructor
public class CourseAnalyticsDataInitializer implements CommandLineRunner {

    /** Số học viên seed cho mỗi khóa học (ghi đè bằng APP_SEED_ANALYTICS_LEARNERS_PER_COURSE). */
    public static final int DEFAULT_LEARNERS_PER_COURSE = 50;

    /** Tổng số học viên mẫu được load (student01 ... student100). */
    private static final int LEARNER_COUNT = 100;
    private static final String LEARNER_EMAIL_TEMPLATE = "student%02d@example.com";

    /**
     * Profile dữ liệu riêng cho từng khóa học (xoay vòng theo index) để mỗi khóa học có
     * hình dạng dữ liệu khác nhau:
     * <ul>
     *   <li>{@code segments} – tỉ lệ học viên thuộc mỗi nhóm hành vi (xem {@link LearnerSegment})</li>
     *   <li>{@code idleScale} – nhân tỉ lệ ngày không truy cập (nhóm active/inactive khác nhau)</li>
     *   <li>{@code ratingShift} – dịch phân bố sao (bảng xếp hạng có thứ hạng khác nhau)</li>
     *   <li>{@code studyFactor} – nhân thời lượng học (giờ học khác nhau giữa các khóa)</li>
     *   <li>{@code learnerScale} – nhân số học viên của khóa học</li>
     * </ul>
     */
    private record CourseProfile(
            String label,
            LearnerSegment[] segments,
            double idleScale,
            int ratingShift,
            int enrollmentSpreadDays,
            double studyFactor,
            double learnerScale
    ) {
    }

    /**
     * Nhóm hành vi của một học viên, quyết định mức độ "ở lại" với khóa học.
     *
     * <p>Mỗi khóa học có tỉ lệ khác nhau cho từng nhóm -> tỉ lệ hoàn thành, tỉ lệ
     * hoạt động và tỉ lệ bỏ học khác nhau rõ rệt giữa các khóa.
     */
    private enum LearnerSegment {
        /** Hoàn thành 100% khóa học (và được cấp chứng chỉ). */
        COMPLETER,
        /** Học gần hết nhưng chưa xong, vẫn truy cập gần đây. */
        ENGAGED,
        /** Học được một phần, truy cập gần đây. */
        CASUAL,
        /** Học được một phần rồi bỏ (không truy cập >= 14 ngày). */
        DROPOUT,
        /** Chưa từng mở bài học nào. */
        NEVER_STARTED
    }

    /**
     * Mỗi khóa học có hình dạng dữ liệu khác nhau để so sánh trong tab "Course ranking":
     * <ul>
     *   <li>{@code balanced} – mọi chỉ số ở mức trung bình</li>
     *   <li>{@code high-retention} – giữ chân tốt, tỉ lệ hoàn thành cao</li>
     *   <li>{@code high-dropout} – khóa học khó, phần lớn bỏ học</li>
     *   <li>{@code new-course} – mới ra mắt, nhiều người chưa bắt đầu</li>
     *   <li>{@code popular} – đông học viên nhất, học đều</li>
     *   <li>{@code gentle} – hoàn thành cao, đánh giá tốt, giờ học cao</li>
     * </ul>
     */
    private static final CourseProfile[] PROFILES = {
            //                  COMPLETER ENGAGED CASUAL DROPOUT NEVER_STARTED
            new CourseProfile("balanced",
                    new LearnerSegment[]{LearnerSegment.COMPLETER, LearnerSegment.ENGAGED, LearnerSegment.CASUAL,
                            LearnerSegment.DROPOUT, LearnerSegment.NEVER_STARTED},
                    1.0, 0, 360, 1.0, 1.0),
            new CourseProfile("high-retention",
                    new LearnerSegment[]{LearnerSegment.COMPLETER, LearnerSegment.COMPLETER, LearnerSegment.ENGAGED,
                            LearnerSegment.ENGAGED, LearnerSegment.CASUAL, LearnerSegment.CASUAL,
                            LearnerSegment.DROPOUT, LearnerSegment.NEVER_STARTED},
                    0.7, 1, 300, 1.1, 0.85),
            new CourseProfile("high-dropout",
                    new LearnerSegment[]{LearnerSegment.COMPLETER, LearnerSegment.CASUAL, LearnerSegment.CASUAL,
                            LearnerSegment.DROPOUT, LearnerSegment.DROPOUT, LearnerSegment.DROPOUT,
                            LearnerSegment.DROPOUT, LearnerSegment.NEVER_STARTED},
                    1.9, -1, 500, 0.5, 0.95),
            new CourseProfile("new-course",
                    new LearnerSegment[]{LearnerSegment.COMPLETER, LearnerSegment.CASUAL, LearnerSegment.CASUAL,
                            LearnerSegment.CASUAL, LearnerSegment.DROPOUT, LearnerSegment.DROPOUT,
                            LearnerSegment.NEVER_STARTED, LearnerSegment.NEVER_STARTED},
                    1.5, 0, 150, 0.65, 0.7),
            new CourseProfile("popular",
                    new LearnerSegment[]{LearnerSegment.COMPLETER, LearnerSegment.ENGAGED, LearnerSegment.ENGAGED,
                            LearnerSegment.CASUAL, LearnerSegment.CASUAL, LearnerSegment.DROPOUT,
                            LearnerSegment.NEVER_STARTED},
                    0.9, 0, 380, 1.05, 1.6),
            new CourseProfile("gentle",
                    new LearnerSegment[]{LearnerSegment.COMPLETER, LearnerSegment.COMPLETER, LearnerSegment.COMPLETER,
                            LearnerSegment.ENGAGED, LearnerSegment.ENGAGED, LearnerSegment.CASUAL,
                            LearnerSegment.DROPOUT, LearnerSegment.NEVER_STARTED},
                    1.2, 1, 420, 1.25, 1.1)
    };

    /**
     * Các phòng ban mẫu để tab "Phòng ban" có dữ liệu so sánh.
     * Học viên được chia vòng tròn theo danh sách này nên mỗi phòng ban có
     * số lượng học viên và tỉ lệ hoàn thành khác nhau.
     */
    private static final String[][] DEPARTMENTS = {
            {"FPT", "Phòng Phát triển FPT"},
            {"IT", "Trung tâm Công nghệ Thông tin"},
            {"HR", "Nhân sự và Đào tạo"},
            {"SALES", "Khối Kinh doanh"},
            {"QA", "Bộ phận Kiểm thử"}
    };

    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonProgressRepository lessonProgressRepository;
    private final LessonRepository lessonRepository;
    private final CertificateRepository certificateRepository;
    private final CourseReviewRepository courseReviewRepository;
    private final DepartmentRepository departmentRepository;
    private final LessonReportRepository lessonReportRepository;
    private final LessonQuestionRepository lessonQuestionRepository;
    private final LessonAnswerRepository lessonAnswerRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final JdbcTemplate jdbc;

    @Value("${app.seed.course-analytics.enabled:true}")
    private boolean enabled;

    @Value("${app.seed.course-analytics.learners-per-course:" + DEFAULT_LEARNERS_PER_COURSE + "}")
    private int learnersPerCourse;

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) {
            log.info("Course analytics seed disabled (app.seed.course-analytics.enabled=false).");
            return;
        }

        List<User> learners = loadLearners();
        if (learners.isEmpty()) {
            log.warn("Course analytics seed skipped: no learner accounts found.");
            return;
        }

        List<Course> courses = loadCourses();
        if (courses.isEmpty()) {
            log.warn("Course analytics seed skipped: no courses found.");
            return;
        }

        // Chia học viên vào các phòng ban mẫu (cần làm trước khi seed enrollment
        // để mỗi phòng ban có tỉ lệ hoàn thành khác nhau).
        assignDepartments(learners);

        int perCourse = Math.max(1, Math.min(learnersPerCourse, learners.size()));
        int seededCourses = 0;

        for (int c = 0; c < courses.size(); c++) {
            Course course = courses.get(c);
            List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(course.getId());
            if (lessons.isEmpty()) {
                log.warn("Course analytics seed skipped for course '{}': no active lessons.", course.getName());
                continue;
            }

            CourseProfile profile = PROFILES[c % PROFILES.length];

            // Mỗi khóa học có lượng học viên khác nhau để bảng "Course ranking" có sự phân hóa.
            int courseLearnerCount = Math.max(1, Math.min(
                    (int) Math.round(perCourse * profile.learnerScale()), learners.size()));
            List<User> courseLearners = pickLearners(learners, courseLearnerCount, c);

            seedEnrollments(course, courseLearners, lessons, c, profile);
            seedReviews(course, courseLearners, c, profile);
            seededCourses++;
        }

        seedLessonReportsAndQuestions(courses);

        log.info("Seeded course analytics demo data: courses={}, learnersPerCourse<={}, totalLearners={}.",
                seededCourses, perCourse, learners.size());
    }

    /** Lấy các khóa học đang active (bỏ qua bản nháp / bị vô hiệu hoá). */
    private List<Course> loadCourses() {
        List<Course> courses = new ArrayList<>();
        for (Course course : courseRepository.findAll()) {
            if (Boolean.FALSE.equals(course.getIsActive())) {
                continue;
            }
            courses.add(course);
        }
        courses.sort((a, b) -> {
            String an = a.getName() == null ? "" : a.getName();
            String bn = b.getName() == null ? "" : b.getName();
            return an.compareToIgnoreCase(bn);
        });
        return courses;
    }

    /**
     * Chọn {@code count} học viên cho khóa học.
     *
     * <p>Dùng {@link Random} với seed cố định theo từng khóa học để:
     * <ul>
     *   <li>tập học viên của các khóa học khác nhau (không trùng hoàn toàn)</li>
     *   <li>kết quả seed ổn định giữa các lần chạy (dễ test lại)</li>
     * </ul>
     */
    private List<User> pickLearners(List<User> learners, int count, int courseIndex) {
        if (learners.isEmpty()) {
            return List.of();
        }
        Random random = new Random(1000L + courseIndex * 7919L);
        List<User> pool = new ArrayList<>(learners);
        // Xáo trộn toàn bộ danh sách rồi lấy đầu N -> mỗi khóa học có tập học viên khác nhau.
        Collections.shuffle(pool, random);
        return new ArrayList<>(pool.subList(0, Math.min(count, pool.size())));
    }

    // =====================================================================
    // Enrollment + lesson progress + certificate
    // =====================================================================

    private void seedEnrollments(
            Course course,
            List<User> learners,
            List<Lesson> lessons,
            int courseIndex,
            CourseProfile profile
    ) {
        LocalDateTime now = LocalDateTime.now();
        int lessonCount = lessons.size();
        Random random = new Random(42L + courseIndex * 104729L);

        // Xáo trộn danh sách học viên để hành vi được phân bố ngẫu nhiên.
        List<User> shuffled = new ArrayList<>(learners);
        Collections.shuffle(shuffled, random);

        for (int i = 0; i < shuffled.size(); i++) {
            User learner = shuffled.get(i);
            LearnerSegment segment = pickSegment(profile, i);

            int completedLessons = completedLessonsFor(segment, lessonCount, random);
            Integer idleDays = idleDaysFor(segment, profile, random);

            // Phong ban manh thi ti le hoan thanh 100% cao hon.
            int deptStride = departmentCompletionStride(learner);
            if (deptStride > 0) {
                boolean strong = segment == LearnerSegment.COMPLETER || segment == LearnerSegment.ENGAGED;
                int stride = strong ? deptStride : deptStride * 3;
                if (i % stride == 0) {
                    completedLessons = lessonCount;
                }
            }

            CourseEnrollment enrollment = enrollmentRepository
                    .findByUser_IdAndCourse_Id(learner.getId(), course.getId())
                    .orElseGet(CourseEnrollment::new);
            enrollment.setUser(learner);
            enrollment.setCourse(course);
            enrollment.setIsActive(true);
            enrollment.setLastAccessedAt(idleDays == null ? null : now.minusDays(idleDays));
            enrollment = enrollmentRepository.save(enrollment);

            // createdAt dung @CreationTimestamp nen phai backdate bang SQL sau khi insert.
            // Rai dang ky ngau nhien trong N thang gan day de bieu do "Xu huong" co du lieu.
            int spread = profile.enrollmentSpreadDays();
            long ageDays = 1 + random.nextInt(Math.max(1, spread));
            LocalDateTime enrolledAt = now.minusDays(ageDays)
                    .minusHours(random.nextInt(24))
                    .withSecond(0)
                    .withNano(0);
            jdbc.update("UPDATE course_enrollments SET created_at = ?, updated_at = ? WHERE id = ?",
                    enrolledAt, enrolledAt, enrollment.getId());

            seedProgress(enrollment, lessons, completedLessons, enrolledAt, now, profile, random);
            seedCertificate(course, learner, completedLessons, lessonCount);
        }
    }

    /**
     * Chon nhom hanh vi cho hoc vien thu {@code index} cua khoa hoc.
     *
     * <p>Tinh theo chu ky co dinh de ty le moi nhom chinh xac va o dinh giua cac lan chay.
     */
    private LearnerSegment pickSegment(CourseProfile profile, int index) {
        LearnerSegment[] segments = profile.segments();
        int slot = index % segments.length;
        return segments[slot];
    }

    /** So bai hoc hoan thanh theo nhom hanh vi. */
    private int completedLessonsFor(LearnerSegment segment, int lessonCount, Random random) {
        if (lessonCount <= 0) {
            return 0;
        }
        return switch (segment) {
            case COMPLETER -> lessonCount;
            case ENGAGED -> Math.max(1, (int) Math.round(lessonCount * (0.65 + random.nextDouble() * 0.25)));
            case CASUAL -> Math.max(0, (int) Math.round(lessonCount * (0.15 + random.nextDouble() * 0.35)));
            case DROPOUT -> (int) Math.round(lessonCount * (random.nextDouble() * 0.3));
            case NEVER_STARTED -> 0;
        };
    }

    /**
     * So ngay khong truy cap gan nhat.
     *
     * <p>Tra ve {@code null} nghia la hoc vien chua tung truy cap khoa hoc.
     */
    private Integer idleDaysFor(LearnerSegment segment, CourseProfile profile, Random random) {
        if (segment == LearnerSegment.NEVER_STARTED) {
            return null;
        }
        double scale = profile.idleScale();
        return switch (segment) {
            case ENGAGED -> (int) Math.round(random.nextDouble() * 12);
            case CASUAL -> (int) Math.round(14 + random.nextDouble() * 30 * scale);
            case DROPOUT -> (int) Math.round(20 + random.nextDouble() * 60 * scale);
            default -> (int) Math.round(random.nextDouble() * 365 * scale);
        };
    }

    /**
     * Điểm "chất lượng học viên" theo phòng ban: phòng ban mạnh học nhanh hơn,
     * phòng ban yếu học chậm hơn. Dùng để tạo khác biệt về tỉ lệ hoàn thành.
     */
    private static int departmentBias(User learner) {
        return switch (primaryDepartmentCode(learner)) {
            case "FPT" -> 2;
            case "IT" -> 1;
            case "QA" -> 0;
            case "HR" -> -1;
            case "SALES" -> -2;
            default -> 0;
        };
    }

    /**
     * Chu kỳ "học viên hoàn thành 100%": phòng ban mạnh hoàn thành thường xuyên hơn.
     * Trả về 0 nghĩa là không ai trong phòng ban này được đánh dấu hoàn thành tuyệt đối.
     */
    private static int departmentCompletionStride(User learner) {
        return switch (primaryDepartmentCode(learner)) {
            case "FPT" -> 5;
            case "IT" -> 7;
            case "QA" -> 9;
            case "HR" -> 12;
            case "SALES" -> 16;
            default -> 0;
        };
    }

    /** Mã phòng ban chính của học viên (phòng ban đầu tiên trong danh sách). */
    private static String primaryDepartmentCode(User learner) {
        if (learner.getDepartments() == null || learner.getDepartments().isEmpty()) {
            return "";
        }
        return learner.getDepartments().stream()
                .filter(java.util.Objects::nonNull)
                .map(Department::getCode)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse("");
    }

    private void seedProgress(
            CourseEnrollment enrollment,
            List<Lesson> lessons,
            int completedLessons,
            LocalDateTime enrolledAt,
            LocalDateTime now,
            CourseProfile profile,
            Random random
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
                // Học viên đã học xong bài này -> thời lượng học ~= thời lượng bài.
                progress.setStudySeconds(
                        studySecondsFor(lesson, enrollment, index, true, profile, random));
            } else {
                progress.setCompletedAt(null);
                progress.setLastAccessedAt(enrolledAt.plusDays(index % 3));
                // Bài chưa hoàn thành -> mới xem một phần (30%-70% thời lượng bài).
                progress.setStudySeconds(
                        studySecondsFor(lesson, enrollment, index, false, profile, random));
            }

            lessonProgressRepository.save(progress);
        }
    }

    /**
     * Tính số giây học cho một bài của một học viên.
     *
     * <p>Cơ sở là {@code Lesson.duration} (đơn vị giây). Học viên đã hoàn thành bài thì
     * dành gần hết thời lượng bài (dao động 80%-115%); bài chưa hoàn thành thì mới xem
     * một phần (30%-70%). Dao động được tính theo hash ổn định của
     * (enrollment, lesson) để dữ liệu seed luôn giống nhau giữa các lần chạy.
     *
     * <p>{@code profile.studyFactor} nhân thêm vào để mỗi khóa học có tổng giờ học
     * khác nhau (khóa "dễ" học lâu hơn, khóa "khó" học ít hơn).
     */
    private long studySecondsFor(
            Lesson lesson,
            CourseEnrollment enrollment,
            int index,
            boolean completed,
            CourseProfile profile,
            Random random
    ) {
        int duration = lesson.getDuration() == null ? 0 : Math.max(0, lesson.getDuration());
        if (duration == 0) {
            return 0L;
        }
        // 0..99
        int variation = Math.floorMod(
                Objects.hash(enrollment.getId(), lesson.getId(), index), 100);
        double ratio = completed
                ? 0.80 + variation / 100.0 * 0.35
                : 0.30 + variation / 100.0 * 0.40;
        // Dao động ngẫu nhiên nhỏ cho từng học viên để giờ học không bị trùng lặp.
        double jitter = 0.85 + random.nextDouble() * 0.30;
        return Math.round(duration * ratio * profile.studyFactor() * jitter);
    }

    private void seedCertificate(
            Course course,
            User learner,
            int completedLessons,
            int lessonCount
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

    private void seedReviews(Course course, List<User> learners, int courseIndex, CourseProfile profile) {
        Random random = new Random(7L + courseIndex * 15485863L);

        for (int i = 0; i < learners.size(); i++) {
            User learner = learners.get(i);
            if (courseReviewRepository.existsByCourseIdAndUserId(course.getId(), learner.getId())) {
                continue;
            }

            // Điểm ngẫu nhiên lệch về phía 4-5 sao, rồi dịch theo profile của khóa học.
            int rating = 3 + (int) Math.round(Math.pow(random.nextDouble(), 1.4) * 2);
            rating = clampRating(rating + profile.ratingShift());

            CourseReview review = new CourseReview();
            review.setCourse(course);
            review.setUser(learner);
            review.setRating(rating);
            review.setComment(reviewComment(rating));
            review.setIsActive(true);
            courseReviewRepository.save(review);
        }
    }

    private static int clampRating(int rating) {
        return Math.max(1, Math.min(5, rating));
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
    // Lesson reports + Q&A (chất lượng nội dung)
    // =====================================================================

    /**
     * Sinh dữ liệu báo lỗi bài học + hỏi đáp (Q&A) cho từng khóa học.
     *
     * <p>Mục tiêu: tab "Chất lượng nội dung" có dữ liệu thật để test:
     * <ul>
     *   <li>bài học bị báo lỗi nhiều nhất (một vài bài tập trung nhiều report)</li>
     *   <li>phân loại report theo 5 lý do {@link LessonReportReason}</li>
     *   <li>câu hỏi chưa trả lời (chiếm ~30% tổng câu hỏi)</li>
     *   <li>thời gian phản hồi trung bình khác nhau theo khóa học</li>
     * </ul>
     */
    private void seedLessonReportsAndQuestions(List<Course> courses) {
        List<User> learners = loadLearners();
        if (learners.isEmpty()) {
            return;
        }

        int courseIndex = 0;
        for (Course course : courses) {
            List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(course.getId());
            if (lessons.isEmpty()) {
                continue;
            }

            User instructor = course.getInstructorUser();
            List<User> courseLearners = pickLearners(learners, Math.min(12, learners.size()), courseIndex);

            seedLessonReports(course, lessons, courseLearners, courseIndex);
            seedQuestionsAndAnswers(course, lessons, courseLearners, instructor, courseIndex);
            courseIndex++;
        }
    }

    /** Bài học "nóng" (bị báo nhiều) khác nhau theo từng khóa học. */
    private void seedLessonReports(
            Course course,
            List<Lesson> lessons,
            List<User> learners,
            int courseIndex
    ) {
        // Tập trung report vào 2-3 bài để có "bài học bị báo lỗi nhiều nhất".
        int hotLessonIndex = courseIndex % lessons.size();
        int secondHotIndex = (hotLessonIndex + 2) % lessons.size();

        for (int i = 0; i < learners.size(); i++) {
            User reporter = learners.get(i);
            int reportCount = 0;

            // Bài nóng: 3-5 report.
            if (i % 3 == 0) {
                reportCount = 3 + (i % 3);
                saveReport(lessons.get(hotLessonIndex), reporter, reportReason(i), courseIndex, i);
            }
            // Bài nóng thứ 2: 2-3 report.
            if (i % 4 == 0) {
                reportCount += 2;
                saveReport(lessons.get(secondHotIndex), reporter, reportReason(i + 1), courseIndex, i);
            }
            // Bài bình thường: đôi khi 1 report.
            if (i % 5 == 0) {
                reportCount += 1;
                saveReport(lessons.get((hotLessonIndex + 5 + i) % lessons.size()),
                        reporter, reportReason(i + 2), courseIndex, i);
            }

            if (reportCount > 0) {
                log.debug("Seeded {} lesson reports for course {} by {}",
                        reportCount, course.getName(), reporter.getEmail());
            }
        }
    }

    private void saveReport(
            Lesson lesson,
            User reporter,
            LessonReportReason reason,
            int courseIndex,
            int index
    ) {
        if (lessonReportRepository.existsByLesson_IdAndReporter_IdAndStatus(
                lesson.getId(), reporter.getId(), LessonReportStatus.OPEN)) {
            return;
        }

        // Một phần report đã xử lý để có số liệu "đang mở" vs "đã xử lý".
        LessonReportStatus status = (index % 3 == 0)
                ? LessonReportStatus.RESOLVED
                : LessonReportStatus.OPEN;

        LessonReport report = new LessonReport();
        report.setLesson(lesson);
        report.setReporter(reporter);
        report.setReason(reason);
        report.setDetail(reportDetail(reason));
        report.setStatus(status);
        lessonReportRepository.save(report);
    }

    private static LessonReportReason reportReason(int index) {
        LessonReportReason[] reasons = LessonReportReason.values();
        return reasons[Math.floorMod(index, reasons.length)];
    }

    private static String reportDetail(LessonReportReason reason) {
        return switch (reason) {
            case BROKEN_CONTENT -> "Video không phát được, có lỗi 404 tại mốc thời gian 03:12.";
            case INCORRECT_CONTENT -> "Đoạn ví dụ ở phần 2 sai về cài đặt dependency.";
            case OUTDATED_CONTENT -> "Thông tin trong bài đã cũ so với phiên bản mới nhất.";
            case INAPPROPRIATE_CONTENT -> "Nội dung có thuật ngữ không phù hợp với môi trường làm việc.";
            case OTHER -> "Tài liệu đính kèm bị thiếu, đề nghị bổ sung.";
        };
    }

    /** Sinh câu hỏi + câu trả lời; ~30% câu hỏi để nguyên (chưa trả lời). */
    private void seedQuestionsAndAnswers(
            Course course,
            List<Lesson> lessons,
            List<User> learners,
            User instructor,
            int courseIndex
    ) {
        if (instructor == null) {
            return;
        }

        for (int i = 0; i < learners.size(); i++) {
            User learner = learners.get(i);
            Lesson lesson = lessons.get((i * 3 + courseIndex) % lessons.size());

            if (lessonQuestionRepository.existsByLesson_IdAndAuthor_IdAndContentIgnoreCase(
                    lesson.getId(), learner.getId(), questionContent(lesson, i))) {
                continue;
            }

            LessonQuestion question = lessonQuestionRepository.save(LessonQuestion.builder()
                    .lesson(lesson)
                    .author(learner)
                    .content(questionContent(lesson, i))
                    .build());

            // Backdate câu hỏi để câu chưa trả lời cũng có "số giờ đã chờ" khác 0.
            int askedHoursAgo = 12 + (i * 11 + courseIndex * 5) % 400;
            LocalDateTime askedAt = LocalDateTime.now().minusHours(askedHoursAgo);
            jdbc.update("UPDATE lesson_questions SET created_at = ?, updated_at = ? WHERE id = ?",
                    askedAt, askedAt, question.getId());

            // ~30% câu hỏi không được trả lời.
            if (i % 10 < 3) {
                continue;
            }

            LessonAnswer answer = new LessonAnswer();
            answer.setQuestion(question);
            answer.setAuthor(instructor);
            answer.setContent(answerContent(i));
            lessonAnswerRepository.save(answer);

            // Backdate câu trả lời để có "thời gian phản hồi" khác nhau.
            int responseHours = 1 + (i * 7 + courseIndex * 3) % 72;
            LocalDateTime answeredAt = askedAt.plusHours(responseHours);
            jdbc.update("UPDATE lesson_answers SET created_at = ?, updated_at = ? WHERE id = ?",
                    answeredAt, answeredAt, answer.getId());
        }
    }

    private static String questionContent(Lesson lesson, int index) {
        String[] templates = {
                "Ở phần %s, tại sao cần dùng cách này thay vì cách làm thông thường?"
            , "Bài %s có ví dụ nào áp dụng trong dự án thực tế không?"
            , "Mình làm theo hướng dẫn ở bài %s nhưng vẫn bị lỗi, ai giúp mình với?"
            , "Có thể giải thích lại phần %s theo cách đơn giản hơn không?"
        };
        return String.format(templates[Math.floorMod(index, templates.length)], lesson.getTitle());
    }

    private static String answerContent(int index) {
        String[] templates = {
            "Chào bạn, mình đã giải thích chi tiết trong bài ghi âm, bạn xem lại mốc 05:20 nhé."
            , "Bạn kiểm tra lại phần khai báo dependency trước, nhiều khả năng thiếu import."
            , "Mình đã cập nhật lại tài liệu trong bài, giờ đã có ví dụ đầy đủ rồi."
            , "Nếu vẫn lỗi, bạn gửi mình stack trace để mình hỗ trợ nhé."
        };
        return templates[Math.floorMod(index, templates.length)];
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /**
     * Tạo các phòng ban mẫu (nếu chưa có) và gán học viên vào phòng ban.
     *
     * <p>Học viên được chia vòng tròn theo danh sách phòng ban, mỗi phòng ban có
     * "chất lượng học viên" khác nhau (được điều khiển qua {@code completionBias})
     * để tab "Phòng ban" có dữ liệu so sánh ý nghĩa.
     */
    private void assignDepartments(List<User> learners) {
        if (learners.isEmpty()) {
            return;
        }

        List<Department> departments = new ArrayList<>();
        for (String[] template : DEPARTMENTS) {
            String code = template[0];
            String name = template[1];

            Department department = departmentRepository.findByCodeIgnoreCase(code)
                    .orElseGet(Department::new);
            department.setCode(code);
            department.setName(name);
            department.setDescription(name);
            department.setIsActive(true);
            departments.add(departmentRepository.save(department));
        }

        for (int i = 0; i < learners.size(); i++) {
            User learner = learners.get(i);
            Department department = departments.get(i % departments.size());

            // Bỏ phòng ban cũ (nếu có) rồi gán phòng ban theo vòng tròn.
            learner.getDepartments().clear();
            learner.getDepartments().add(department);
            userRepository.save(learner);
        }

        log.info("Assigned {} learners across {} departments.", learners.size(), departments.size());
    }

    /** Lấy danh sách học viên mẫu (student01@example.com ... student100@example.com). */
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

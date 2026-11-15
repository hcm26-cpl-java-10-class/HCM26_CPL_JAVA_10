package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.certificate.Certificate;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course_review.CourseReview;
import com.example.starter_project_2025.system.demo.course_review.CourseReviewRepository;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.department.DepartmentRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;

/**
 * Seed dữ liệu demo cho trang <b>Course Analytics</b>.
 *
 * <p>Mục tiêu: dữ liệu phải <b>thật và khác biệt rõ rệt giữa các khóa học</b> để khi
 * mở từng tab (Phễu học tập, Xu hướng, Hoạt động, Đánh giá, Phòng ban, Xếp hạng,
 * Chất lượng &amp; Q&amp;A, Thời gian học) thì thấy rõ sự khác nhau, không phải mọi
 * khóa học đều giống nhau.
 *
 * <p>Cấu hình:
 * <ul>
 *   <li>{@code app.seed.course-analytics.enabled} – bật/tắt seed (mặc định <b>bật</b>).</li>
 *   <li>{@code app.seed.course-analytics.learners-per-course} – số học viên cho các khóa
 *       học <i>không</i> có profile riêng (các khóa demo chính luôn dùng số lượng cố định).</li>
 * </ul>
 *
 * <p>Phần <b>Bài thi (exams)</b> cố ý <b>không</b> seed ở đây – nhóm phụ trách khác
 * quản lý dữ liệu thi.
 */
@Slf4j
@Order(30)
@Component
@RequiredArgsConstructor
public class CourseAnalyticsDataInitializer implements CommandLineRunner {

    /** Số học viên seed cho các khóa học không có profile riêng. */
    public static final int DEFAULT_LEARNERS_PER_COURSE = 50;

    /** Tổng số học viên mẫu trong hệ thống (student01 ... student100). */
    private static final int LEARNER_COUNT = 100;
    private static final String LEARNER_EMAIL_TEMPLATE = "student%02d@example.com";

    /** Ngưỡng "không hoạt động" mặc định của trang analytics (ngày). */
    private static final int INACTIVE_THRESHOLD_DAYS = 14;

    /**
     * Các phòng ban mẫu để tab "Phòng ban" có dữ liệu so sánh.
     * Học viên được chia vòng tròn theo danh sách này (một số người để trống để có
     * thêm nhóm "Chưa phân phòng ban").
     */
    private static final String[][] DEPARTMENTS = {
            {"FPT", "Phòng Phát triển FPT"},
            {"IT", "Trung tâm Công nghệ Thông tin"},
            {"HR", "Nhân sự và Đào tạo"},
            {"SALES", "Khối Kinh doanh"},
            {"QA", "Bộ phận Kiểm thử"}
    };

    /**
     * Nhóm hành vi của một học viên – quyết định mức độ "ở lại" với khóa học.
     *
     * <p>Mỗi khóa học có tỉ lệ khác nhau cho từng nhóm nên tỉ lệ hoàn thành, hoạt động
     * và bỏ học khác nhau rõ rệt giữa các khóa.
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
     * Profile dữ liệu riêng cho từng khóa học.
     *
     * @param label                 tên mô tả (dùng cho log)
     * @param learnerCount          số học viên của khóa học
     * @param segmentWeights        tỉ trọng % của 5 nhóm: COMPLETER, ENGAGED, CASUAL, DROPOUT, NEVER_STARTED
     * @param enrollmentSpreadDays  số ngày tối đa kể từ lúc mở khóa học (biểu đồ "Xu hướng")
     * @param idleScale             nhân tỉ lệ ngày không truy cập của nhóm casual/dropout
     * @param studyFactor           nhân thời lượng học (tổng giờ học khác nhau giữa các khóa)
     * @param targetRating          điểm đánh giá trung bình mong muốn
     * @param ratingSpread          độ lệch của điểm đánh giá
     * @param reviewCoveragePercent % học viên có viết đánh giá
     * @param hardLessonIndex       index bài học "khó" gây tụt trong funnel (-1 = không có)
     * @param hardLessonSkipRate    tỉ lệ học viên bỏ qua bài khó
     * @param strongDepartments     phòng ban học tốt trong khóa học này
     * @param weakDepartments       phòng ban học kém trong khóa học này
     * @param reportScale           hệ số số báo lỗi bài học
     * @param questionScale         hệ số số câu hỏi Q&amp;A
     * @param answeredPercent       % câu hỏi được trả lời
     * @param casualProgressMax     % bài hoàn thành tối đa của nhóm CASUAL
     * @param dropoutProgressMax    % bài hoàn thành tối đa của nhóm DROPOUT
     * @param engagedProgressMin    % bài hoàn thành tối thiểu của nhóm ENGAGED
     */
    private record CourseProfile(
            String label,
            int learnerCount,
            int[] segmentWeights,
            int enrollmentSpreadDays,
            double idleScale,
            double studyFactor,
            double targetRating,
            double ratingSpread,
            int reviewCoveragePercent,
            int hardLessonIndex,
            double hardLessonSkipRate,
            Set<String> strongDepartments,
            Set<String> weakDepartments,
            int reportScale,
            int questionScale,
            int answeredPercent,
            int casualProgressMax,
            int dropoutProgressMax,
            int engagedProgressMin
    ) {
    }

    /**
     * Profile riêng cho 4 khóa học demo – mỗi khóa một "hình dạng" dữ liệu khác nhau:
     * <ul>
     *   <li><b>Java Fundamentals</b> – khóa học chủ lực, ~50 học viên, giữ chân tốt,
     *       giờ học cao, đánh giá tốt (điểm chuẩn để so sánh).</li>
     *   <li><b>Spring Boot for Beginners</b> – đông học viên nhất, dễ nhất, hoàn thành
     *       cao nhất, ít bỏ học nhất, đánh giá cao nhất.</li>
     *   <li><b>Java Spring Boot</b> – khóa học khó: tỉ lệ bỏ học cao nhất, tiến độ thấp,
     *       giờ học ít, đánh giá thấp nhất, nhiều report bài học.</li>
     *   <li><b>Database Design</b> – khóa học mới mở: ít học viên, phần lớn chưa bắt đầu,
     *       xu hướng chỉ có dữ liệu vài tuần gần đây.</li>
     * </ul>
     */
    private static final Map<String, CourseProfile> PROFILES_BY_COURSE = buildProfiles();

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

        int seededCourses = 0;
        for (int c = 0; c < courses.size(); c++) {
            Course course = courses.get(c);
            List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(course.getId());
            if (lessons.isEmpty()) {
                log.warn("Course analytics seed skipped for course '{}': no active lessons.", course.getName());
                continue;
            }

            CourseProfile profile = profileFor(course, c);
            int courseLearnerCount = Math.max(1, Math.min(profile.learnerCount(), learners.size()));
            List<User> courseLearners = pickLearners(learners, courseLearnerCount, c);

            seedEnrollments(course, courseLearners, lessons, c, profile);
            seedReviews(course, courseLearners, c, profile);
            seedLessonReportsAndQuestions(course, lessons, courseLearners, c, profile);
            seededCourses++;

            log.info("Seeded analytics for course '{}' [{}]: learners={}, profile={}",
                    course.getName(), profile.label(), courseLearners.size(), profile.label());
        }

        log.info("Seeded course analytics demo data: courses={}, totalLearners={}.",
                seededCourses, learners.size());
    }

    // =====================================================================
    // Profile của khóa học
    // =====================================================================

    private static Map<String, CourseProfile> buildProfiles() {
        Map<String, CourseProfile> profiles = new LinkedHashMap<>();

        // Khóa chủ lực: ~50 học viên, giữ chân tốt, giờ học cao, đánh giá tốt.
        profiles.put("Java Fundamentals", new CourseProfile(
                "flagship", 50,
                new int[]{34, 28, 18, 12, 8},
                330, 0.9, 1.25, 4.2, 0.7, 78,
                4, 0.22, Set.of("FPT", "IT"), Set.of("SALES"),
                1, 1, 72, 55, 30, 65));

        // Đông nhất, dễ nhất, hoàn thành cao nhất, bỏ học ít nhất.
        profiles.put("Spring Boot for Beginners", new CourseProfile(
                "popular-friendly", 62,
                new int[]{42, 26, 16, 10, 6},
                300, 0.7, 1.40, 4.6, 0.5, 88,
                7, 0.12, Set.of("FPT", "IT", "QA"), Set.of(),
                1, 1, 80, 60, 25, 70));

        // Khóa học khó: bỏ học nhiều, tiến độ thấp, giờ học ít, đánh giá thấp.
        profiles.put("Java Spring Boot", new CourseProfile(
                "hard-high-dropout", 42,
                new int[]{10, 20, 24, 34, 12},
                420, 1.9, 0.60, 2.9, 1.1, 42,
                2, 0.40, Set.of("IT"), Set.of("HR", "SALES"),
                2, 1, 45, 40, 20, 55));

        // Khóa học mới: ít học viên, nhiều người chưa bắt đầu, xu hướng ngắn.
        profiles.put("Database Design", new CourseProfile(
                "newly-launched", 28,
                new int[]{12, 18, 26, 22, 22},
                70, 1.5, 0.45, 3.4, 1.0, 45,
                1, 0.35, Set.of("QA", "FPT"), Set.of("SALES"),
                1, 1, 58, 45, 22, 60));

        return Collections.unmodifiableMap(profiles);
    }

    /**
     * Lấy profile của khóa học. Khóa demo dùng profile riêng; các khóa khác (không
     * thuộc nhóm demo) dùng profile trung tính với số học viên lấy từ cấu hình.
     */
    private CourseProfile profileFor(Course course, int courseIndex) {
        CourseProfile profile = PROFILES_BY_COURSE.get(course.getName());
        if (profile != null) {
            return profile;
        }
        int count = Math.max(1, Math.min(learnersPerCourse, LEARNER_COUNT));
        return new CourseProfile(
                "standard", count,
                new int[]{12, 24, 26, 24, 14},
                360, 1.0, 1.0, 3.8, 1.0, 55,
                3, 0.25, Set.of(), Set.of(),
                1, 1, 65, 50, 25, 65);
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

        // Phân bố nhóm hành vi riêng cho từng phòng ban -> khác biệt rõ ở tab "Phòng ban".
        Map<String, List<LearnerSegment>> segmentsByDepartment =
                buildSegmentsByDepartment(shuffled, profile, random);
        Map<String, Integer> cursorByDepartment = new LinkedHashMap<>();

        for (int i = 0; i < shuffled.size(); i++) {
            User learner = shuffled.get(i);
            String departmentCode = primaryDepartmentCode(learner);
            List<LearnerSegment> deptSegments = segmentsByDepartment.get(departmentCode);
            int cursor = cursorByDepartment.getOrDefault(departmentCode, 0);
            LearnerSegment segment = deptSegments.get(Math.min(cursor, deptSegments.size() - 1));
            cursorByDepartment.put(departmentCode, cursor + 1);

            int completedLessons = completedLessonsFor(segment, lessonCount, profile, random);
            completedLessons = applyDepartmentDelta(completedLessons, lessonCount, departmentCode, profile, segment);

            // Bài "khó" bị một phần học viên bỏ qua -> tạo điểm tụt rõ trong funnel.
            boolean skipHardLesson = profile.hardLessonIndex() >= 0
                    && profile.hardLessonIndex() < lessonCount
                    && segment != LearnerSegment.COMPLETER
                    && segment != LearnerSegment.NEVER_STARTED
                    && random.nextDouble() < profile.hardLessonSkipRate();
            boolean[] completedMask = buildCompletionMask(lessonCount, completedLessons, skipHardLesson, profile.hardLessonIndex());

            Integer idleDays = idleDaysFor(segment, profile, random);
            boolean neverStarted = idleDays == null;

            // Ngày đăng ký: rải theo tỉ lệ 35% trong 30 ngày gần đây, 30% trong 30-90 ngày,
            // 35% lâu hơn -> biểu đồ "Xu hướng" có dữ liệu ở cả các nút 30/90/365 ngày.
            int spread = Math.max(1, profile.enrollmentSpreadDays());
            long ageDays = enrollmentAgeDays(random, spread);
            if (segment == LearnerSegment.NEVER_STARTED) {
                // 1/4 người "chưa bắt đầu" vừa đăng ký (chưa bị tính là bỏ học),
                // 3/4 đăng ký từ lâu -> bị tính là bỏ học.
                ageDays = random.nextInt(4) == 0
                        ? 1 + random.nextInt(INACTIVE_THRESHOLD_DAYS - 1)
                        : INACTIVE_THRESHOLD_DAYS + random.nextInt(Math.max(1, spread - INACTIVE_THRESHOLD_DAYS));
            } else if (idleDays != null) {
                // Không thể truy cập trước khi đăng ký.
                ageDays = Math.max(ageDays, idleDays + 1);
            }

            LocalDateTime enrolledAt = now.minusDays(ageDays)
                    .minusHours(random.nextInt(24))
                    .withSecond(0)
                    .withNano(0);

            CourseEnrollment enrollment = enrollmentRepository
                    .findByUser_IdAndCourse_Id(learner.getId(), course.getId())
                    .orElseGet(CourseEnrollment::new);
            enrollment.setUser(learner);
            enrollment.setCourse(course);
            enrollment.setIsActive(true);
            enrollment.setLastAccessedAt(idleDays == null ? null : now.minusDays(idleDays));
            enrollment.setDepartment(singleDepartmentOf(learner));
            enrollment = enrollmentRepository.save(enrollment);

            // createdAt dùng @CreationTimestamp nên phải backdate bằng SQL sau khi insert.
            // Rải đăng ký ngẫu nhiên trong N tháng gần đây để biểu đồ "Xu hướng" có dữ liệu.
            jdbc.update("UPDATE course_enrollments SET created_at = ?, updated_at = ? WHERE id = ?",
                    enrolledAt, enrolledAt, enrollment.getId());

            seedProgress(enrollment, lessons, completedMask, enrolledAt, now, profile, random, neverStarted);
            seedCertificate(course, learner, completedMask, lessonCount);
        }
    }

    /**
     * Chia học viên theo tỉ trọng của từng nhóm hành vi, <b>riêng cho từng phòng ban</b>.
     *
     * <p>Cơ chế:
     * <ol>
     *   <li>Học viên được xếp vào từng nhóm theo tỉ trọng gốc của khóa học (tính trên
     *       quy mô của phòng ban đó).</li>
     *   <li>Phòng ban <b>mạnh</b> (strongDepartments): một phần học viên của nhóm yếu
     *       được "nâng" lên nhóm tốt hơn.</li>
     *   <li>Phòng ban <b>yếu</b> (weakDepartments): một phần học viên của nhóm tốt
     *       bị "hạ" xuống nhóm kém hơn.</li>
     * </ol>
     *
     * <p>Kết quả: tỉ lệ hoàn thành / giờ học / bỏ học khác nhau rõ rệt giữa các phòng
     * ban <b>trong cùng một khóa học</b>, đồng thời mỗi khóa học lại có một bộ phòng
     * ban mạnh/yếu riêng nên so sánh giữa các khóa cũng khác nhau.
     */
    private Map<String, List<LearnerSegment>> buildSegmentsByDepartment(
            List<User> learners,
            CourseProfile profile,
            Random random
    ) {
        LearnerSegment[] values = LearnerSegment.values();
        int[] weights = profile.segmentWeights();
        int totalWeight = 0;
        for (int weight : weights) {
            totalWeight += weight;
        }

        // Gom học viên theo phòng ban (giữ nguyên thứ tự để kết quả ổn định).
        Map<String, List<User>> byDepartment = new LinkedHashMap<>();
        for (User learner : learners) {
            byDepartment.computeIfAbsent(primaryDepartmentCode(learner), key -> new ArrayList<>())
                    .add(learner);
        }
        List<String> deptCodes = new ArrayList<>(byDepartment.keySet());

        // --- Mục tiêu cột: tỉ trọng thiết kế của khóa học (giữ nguyên qua mọi phòng ban) ---
        int learnerCount = learners.size();
        int[] columnTargets = new int[values.length];
        int assigned = 0;
        for (int s = 0; s < values.length; s++) {
            columnTargets[s] = (int) Math.floor(learnerCount * weights[s] / (double) totalWeight);
            assigned += columnTargets[s];
        }
        columnTargets[0] += learnerCount - assigned;

        // --- Mục tiêu hàng: số học viên của từng phòng ban ---
        int[] rowTargets = new int[deptCodes.size()];
        for (int r = 0; r < deptCodes.size(); r++) {
            rowTargets[r] = byDepartment.get(deptCodes.get(r)).size();
        }

        // --- Ma trận khởi tạo: tỉ trọng khóa học x hệ số chất lượng phòng ban ---
        double[][] matrix = new double[deptCodes.size()][values.length];
        for (int r = 0; r < deptCodes.size(); r++) {
            String deptCode = deptCodes.get(r);
            // "Chất lượng" của phòng ban: 1.0 = mạnh, 0.5 = trung bình, 0.0 = yếu.
            double quality = profile.strongDepartments().contains(deptCode) ? 1.0
                    : profile.weakDepartments().contains(deptCode) ? 0.0
                    : 0.5;
            double[] multipliers = {
                    0.3 + 1.7 * quality,   // COMPLETER
                    0.5 + 1.2 * quality,   // ENGAGED
                    1.7 - 0.8 * quality,   // CASUAL
                    2.1 - 1.5 * quality,   // DROPOUT
                    1.7 - 1.3 * quality    // NEVER_STARTED
            };
            double rowTotal = 0;
            for (int s = 0; s < values.length; s++) {
                matrix[r][s] = weights[s] * multipliers[s];
                rowTotal += matrix[r][s];
            }
            for (int s = 0; s < values.length; s++) {
                matrix[r][s] = rowTotal == 0 ? 0 : matrix[r][s] / rowTotal;
            }
        }

        // --- IPF (Iterative Proportional Fitting) ---
        // Giữ đúng tổng số học viên của từng phòng ban (hàng) VÀ tỉ trọng thiết kế
        // của khóa học (cột), để mỗi phòng ban có hình dạng khác nhau nhưng tổng
        // thể hiện trùng khớp với profile của khóa.
        for (int iteration = 0; iteration < 60; iteration++) {
            for (int r = 0; r < matrix.length; r++) {
                double rowSum = 0;
                for (int s = 0; s < values.length; s++) {
                    rowSum += matrix[r][s];
                }
                if (rowSum <= 0) {
                    continue;
                }
                double factor = rowTargets[r] / rowSum;
                for (int s = 0; s < values.length; s++) {
                    matrix[r][s] *= factor;
                }
            }
            for (int s = 0; s < values.length; s++) {
                double colSum = 0;
                for (int r = 0; r < matrix.length; r++) {
                    colSum += matrix[r][s];
                }
                if (colSum <= 0) {
                    continue;
                }
                double factor = columnTargets[s] / colSum;
                for (int r = 0; r < matrix.length; r++) {
                    matrix[r][s] *= factor;
                }
            }
        }

        // Chuyển ma trận sang số nguyên.
        // Dùng phương pháp "largest remainder" để mọi nhóm (kể cả nhóm nhỏ như
        // NEVER_STARTED) đều giữ được đúng số lượng thiết kế -> tỉ lệ bỏ học /
        // chưa bắt đầu đúng với profile của khóa học.
        int[][] counts = allocateIntegers(matrix, rowTargets, columnTargets);

        // Chuyển ma trận thành danh sách nhóm hành vi cho từng phòng ban.
        Map<String, List<LearnerSegment>> result = new LinkedHashMap<>();
        for (int r = 0; r < deptCodes.size(); r++) {
            int size = rowTargets[r];
            List<LearnerSegment> segments = new ArrayList<>(size);
            for (int s = 0; s < values.length; s++) {
                for (int k = 0; k < counts[r][s]; k++) {
                    segments.add(values[s]);
                }
            }
            while (segments.size() > size) {
                segments.remove(segments.size() - 1);
            }
            while (segments.size() < size) {
                segments.add(LearnerSegment.CASUAL);
            }
            Collections.shuffle(segments, random);
            result.put(deptCodes.get(r), segments);
        }
        return result;
    }

    /**
     * Chuyển ma trận xác suất thành ma trận số nguyên, vừa giữ tổng từng hàng
     * (số học viên của phòng ban) vừa giữ tổng từng cột (số học viên của nhóm hành vi).
     *
     * <p>Thuật toán: làm tròn xuống trước, rồi phân phối phần dư cho các ô có
     * phần thập phân lớn nhất (largest remainder), ưu tiên các cột còn thiếu người.
     */
    private int[][] allocateIntegers(double[][] matrix, int[] rowTargets, int[] columnTargets) {
        int rows = matrix.length;
        int cols = columnTargets.length;

        int[][] result = new int[rows][cols];
        int[] rowRemaining = new int[rows];
        int[] colRemaining = new int[cols];
        for (int r = 0; r < rows; r++) {
            rowRemaining[r] = rowTargets[r];
        }
        for (int s = 0; s < cols; s++) {
            colRemaining[s] = columnTargets[s];
        }

        for (int r = 0; r < rows; r++) {
            for (int s = 0; s < cols; s++) {
                double value = matrix[r][s];
                if (value <= 0 || Double.isNaN(value) || Double.isInfinite(value)) {
                    value = 0;
                }
                int floored = (int) Math.floor(value);
                result[r][s] = floored;
                rowRemaining[r] -= floored;
                colRemaining[s] -= floored;
            }
        }

        // Phân phối phần dư theo phần thập phân lớn nhất (largest remainder).
        // Luôn kiểm tra "> 0" để đảm bảo vòng lặp kết thúc.
        while (true) {
            int bestRow = -1;
            int bestCol = -1;
            double bestFraction = -1;
            for (int r = 0; r < rows; r++) {
                if (rowRemaining[r] <= 0) {
                    continue;
                }
                for (int s = 0; s < cols; s++) {
                    if (colRemaining[s] <= 0) {
                        continue;
                    }
                    double fraction = matrix[r][s] - Math.floor(matrix[r][s]);
                    if (fraction > bestFraction) {
                        bestFraction = fraction;
                        bestRow = r;
                        bestCol = s;
                    }
                }
            }
            if (bestRow < 0) {
                break;
            }
            result[bestRow][bestCol]++;
            rowRemaining[bestRow]--;
            colRemaining[bestCol]--;
        }

        // Vẫn còn hàng/cột lệch (do sai số số thực) -> cân bằng lại bằng cách
        // chuyển người từ cột dư sang cột thiếu, ưu tiên giữ tổng cột chuẩn.
        for (int r = 0; r < rows; r++) {
            while (rowRemaining[r] < 0) {
                int donor = -1;
                for (int s = 0; s < cols; s++) {
                    if (result[r][s] > 0) {
                        donor = s;
                        break;
                    }
                }
                if (donor < 0) {
                    break;
                }
                result[r][donor]--;
                rowRemaining[r]++;
                colRemaining[donor]++;
            }
            while (rowRemaining[r] > 0) {
                int receiver = -1;
                for (int s = 0; s < cols; s++) {
                    if (colRemaining[s] > 0) {
                        receiver = s;
                        break;
                    }
                }
                if (receiver < 0) {
                    // Không còn cột nào thiếu -> đưa vào cột có số lượng lớn nhất.
                    for (int s = 0; s < cols; s++) {
                        if (receiver < 0 || result[r][s] > result[r][receiver]) {
                            receiver = s;
                        }
                    }
                }
                result[r][receiver]++;
                rowRemaining[r]--;
                colRemaining[receiver]--;
            }
        }
        return result;
    }

    /** Cộng/trừ số bài hoàn thành theo "chất lượng" của phòng ban. */
    private int applyDepartmentDelta(
            int completedLessons,
            int lessonCount,
            String departmentCode,
            CourseProfile profile,
            LearnerSegment segment
    ) {
        if (segment == LearnerSegment.COMPLETER || lessonCount == 0) {
            return completedLessons;
        }
        if (profile.strongDepartments().contains(departmentCode)) {
            int boost = Math.max(1, (int) Math.round(lessonCount * 0.15));
            // Không vượt quá mốc "hoàn thành" để nhóm hành vi và phòng ban độc lập nhau.
            return Math.min(lessonCount - 1, completedLessons + boost);
        }
        if (profile.weakDepartments().contains(departmentCode)) {
            int penalty = Math.max(1, (int) Math.round(lessonCount * 0.20));
            return Math.max(0, completedLessons - penalty);
        }
        return completedLessons;
    }

    /**
     * Số ngày trôi qua kể từ lúc đăng ký, phân bố theo 3 khoảng thời gian.
     *
     * <p>Mục tiêu: các nút "30 ngày / 90 ngày / 1 năm" của tab "Xu hướng" đều có dữ liệu,
     * và biểu đồ không bị "dồn cục" ở một đầu.
     */
    private long enrollmentAgeDays(Random random, int spread) {
        double roll = random.nextDouble();
        if (roll < 0.35) {
            // 30 ngày gần nhất.
            return 1 + random.nextInt(Math.max(1, Math.min(30, spread)));
        }
        if (roll < 0.65) {
            // 30 -> 90 ngày.
            return 30 + random.nextInt(Math.max(1, Math.min(60, Math.max(31, spread - 30))));
        }
        // Lâu hơn 90 ngày (nếu khóa học mới hơn thì dồn về khoảng 30-90 ngày).
        if (spread <= 90) {
            return 30 + random.nextInt(Math.max(1, Math.min(60, spread - 30)));
        }
        return 90 + random.nextInt(Math.max(1, spread - 90));
    }

    /** Số bài học hoàn thành theo nhóm hành vi. */
    private int completedLessonsFor(
            LearnerSegment segment,
            int lessonCount,
            CourseProfile profile,
            Random random
    ) {
        if (lessonCount <= 0) {
            return 0;
        }
        return switch (segment) {
            case COMPLETER -> lessonCount;
            case ENGAGED -> {
                int min = Math.min(profile.engagedProgressMin(), 90);
                int value = (int) Math.round(lessonCount * (min / 100.0 + random.nextDouble() * (90 - min) / 100.0));
                yield Math.max(1, Math.min(lessonCount - 1, value));
            }
            case CASUAL -> Math.max(0, (int) Math.round(
                    lessonCount * (0.10 + random.nextDouble() * (profile.casualProgressMax() - 10) / 100.0)));
            case DROPOUT -> (int) Math.round(
                    lessonCount * (random.nextDouble() * profile.dropoutProgressMax() / 100.0));
            case NEVER_STARTED -> 0;
        };
    }

    /**
     * Dựng danh sách bài đã hoàn thành.
     *
     * <p>Nếu học viên bỏ qua bài khó thì bài đó bị đánh dấu chưa hoàn thành nhưng bài
     * ngay sau vẫn hoàn thành -> biểu đồ "Phễu học tập" có điểm tụt rõ rệt ở bài khó.
     */
    private boolean[] buildCompletionMask(
            int lessonCount,
            int completedLessons,
            boolean skipHardLesson,
            int hardLessonIndex
    ) {
        boolean[] done = new boolean[lessonCount];
        for (int i = 0; i < completedLessons && i < lessonCount; i++) {
            done[i] = true;
        }
        if (skipHardLesson && hardLessonIndex >= 0 && hardLessonIndex < lessonCount && done[hardLessonIndex]) {
            done[hardLessonIndex] = false;
            if (hardLessonIndex + 1 < lessonCount) {
                done[hardLessonIndex + 1] = true;
            }
        }
        return done;
    }

    /**
     * Số ngày không truy cập gần nhất.
     *
     * <p>Trả về {@code null} nghĩa là học viên chưa từng truy cập khóa học.
     */
    private Integer idleDaysFor(LearnerSegment segment, CourseProfile profile, Random random) {
        if (segment == LearnerSegment.NEVER_STARTED) {
            return null;
        }
        double scale = profile.idleScale();
        return switch (segment) {
            case ENGAGED -> (int) Math.round(random.nextDouble() * (INACTIVE_THRESHOLD_DAYS - 2));
            case CASUAL -> (int) Math.round(
                    INACTIVE_THRESHOLD_DAYS + random.nextDouble() * 30 * scale);
            case DROPOUT -> (int) Math.round(
                    INACTIVE_THRESHOLD_DAYS + 6 + random.nextDouble() * 60 * scale);
            case COMPLETER -> (int) Math.round(random.nextDouble() * 120);
            case NEVER_STARTED -> null;
        };
    }

    private void seedProgress(
            CourseEnrollment enrollment,
            List<Lesson> lessons,
            boolean[] completedMask,
            LocalDateTime enrolledAt,
            LocalDateTime now,
            CourseProfile profile,
            Random random,
            boolean neverStarted
    ) {
        int lessonCount = lessons.size();

        // Học viên chưa từng mở bài nào -> không tạo bản ghi progress nào.
        if (neverStarted) {
            return;
        }

        // Bài "đang xem dở" (chưa hoàn thành nhưng đã mở) -> tạo funnel "started" khác "completed".
        int startedLessonIndex = -1;
        for (int i = 0; i < lessonCount; i++) {
            if (!completedMask[i]) {
                startedLessonIndex = i;
                break;
            }
        }

        int completedTotal = 0;
        for (boolean done : completedMask) {
            if (done) {
                completedTotal++;
            }
        }

        long windowDays = Math.max(1, ChronoUnit.DAYS.between(enrolledAt, now));

        for (int index = 0; index < lessonCount; index++) {
            Lesson lesson = lessons.get(index);
            boolean completed = completedMask[index];
            boolean started = completed || index == startedLessonIndex;

            // Học viên chưa từng mở bài nào -> không tạo bản ghi progress.
            if (!started) {
                continue;
            }

            LessonProgress progress = lessonProgressRepository
                    .findByEnrollment_IdAndLesson_Id(enrollment.getId(), lesson.getId())
                    .orElseGet(LessonProgress::new);
            progress.setEnrollment(enrollment);
            progress.setLesson(lesson);
            progress.setIsActive(true);
            progress.setCompleted(completed);

            if (completed) {
                // Rải bài hoàn thành đều trong khoảng từ lúc đăng ký đến hiện tại
                // để biểu đồ "Xu hướng" có dữ liệu trên cả 12 tháng.
                int order = 0;
                for (int i = 0; i <= index; i++) {
                    if (completedMask[i]) {
                        order++;
                    }
                }
                long offset = windowDays - Math.min(windowDays,
                        (completedTotal - order + 1L) * (windowDays / (completedTotal + 1L)));
                LocalDateTime completedAt = enrolledAt.plusDays(Math.max(0, offset))
                        .minusHours(index % 9)
                        .withSecond(0)
                        .withNano(0);
                if (completedAt.isAfter(now)) {
                    completedAt = now.minusMinutes(index * 13L + 5);
                }
                if (completedAt.isBefore(enrolledAt)) {
                    completedAt = enrolledAt.plusHours(index + 1);
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
            boolean[] completedMask,
            int lessonCount
    ) {
        for (boolean done : completedMask) {
            if (!done) {
                return;
            }
        }
        if (lessonCount == 0) {
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

        int coverage = Math.max(0, Math.min(100, profile.reviewCoveragePercent()));
        for (int i = 0; i < learners.size(); i++) {
            if (i * 100 >= learners.size() * coverage) {
                break;
            }
            User learner = learners.get(i);
            if (courseReviewRepository.existsByCourseIdAndUserId(course.getId(), learner.getId())) {
                continue;
            }

            int rating = ratingFor(profile, random);
            CourseReview review = new CourseReview();
            review.setCourse(course);
            review.setUser(learner);
            review.setRating(rating);
            review.setComment(reviewComment(rating));
            review.setIsActive(true);
            courseReviewRepository.save(review);
        }
    }

    /** Điểm đánh giá dao động quanh điểm trung bình mong muốn của khóa học. */
    private int ratingFor(CourseProfile profile, Random random) {
        double value = profile.targetRating()
                + (random.nextDouble() - 0.5) * 2 * profile.ratingSpread();
        // Thiên về phía 4-5 sao một chút (người học ít kêu phàn nàn).
        value += 0.25;
        return clampRating((int) Math.round(value));
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
     * Sinh dữ liệu báo lỗi bài học + hỏi đáp (Q&amp;A) cho một khóa học.
     *
     * <p>Mục tiêu: tab "Chất lượng nội dung" có dữ liệu thật để test:
     * <ul>
     *   <li>bài học bị báo lỗi nhiều nhất (mỗi khóa học "bài nóng" khác nhau)</li>
     *   <li>phân loại report theo 5 lý do {@link LessonReportReason}</li>
     *   <li>câu hỏi chưa trả lời (tỉ lệ khác nhau theo khóa học)</li>
     *   <li>thời gian phản hồi trung bình khác nhau theo khóa học</li>
     * </ul>
     */
    private void seedLessonReportsAndQuestions(
            Course course,
            List<Lesson> lessons,
            List<User> learners,
            int courseIndex,
            CourseProfile profile
    ) {
        if (learners.isEmpty() || lessons.isEmpty()) {
            return;
        }
        User instructor = course.getInstructorUser();
        List<User> courseLearners = pickLearners(learners, Math.min(12, learners.size()), courseIndex);

        seedLessonReports(course, lessons, courseLearners, courseIndex, profile);
        seedQuestionsAndAnswers(course, lessons, courseLearners, instructor, courseIndex, profile);
    }

    /** Bài học "nóng" (bị báo nhiều) khác nhau theo từng khóa học. */
    private void seedLessonReports(
            Course course,
            List<Lesson> lessons,
            List<User> learners,
            int courseIndex,
            CourseProfile profile
    ) {
        int scale = Math.max(0, profile.reportScale());
        if (scale == 0) {
            return;
        }

        // Tập trung report vào 2-3 bài để có "bài học bị báo lỗi nhiều nhất".
        int hotLessonIndex = profile.hardLessonIndex() >= 0
                ? profile.hardLessonIndex() % lessons.size()
                : courseIndex % lessons.size();
        int secondHotIndex = (hotLessonIndex + 2) % lessons.size();

        for (int i = 0; i < learners.size(); i++) {
            User reporter = learners.get(i);

            // Bài nóng: 3-5 report.
            if (i % 3 == 0) {
                for (int k = 0; k < scale; k++) {
                    saveReport(lessons.get(hotLessonIndex), reporter, reportReason(i + k), courseIndex, i);
                }
            }
            // Bài nóng thứ 2: 2-3 report.
            if (i % 4 == 0) {
                for (int k = 0; k < Math.max(1, scale - 1); k++) {
                    saveReport(lessons.get(secondHotIndex), reporter, reportReason(i + 1 + k), courseIndex, i);
                }
            }
            // Bài bình thường: đôi khi 1 report.
            if (i % 5 == 0) {
                saveReport(lessons.get((hotLessonIndex + 5 + i) % lessons.size()),
                        reporter, reportReason(i + 2), courseIndex, i);
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
        // Kiểm tra theo (bài học, người báo, lý do) bất kể trạng thái: nếu chỉ check
        // OPEN thì các report đã RESOLVED sẽ bị tạo lại mỗi lần restart.
        if (lessonReportRepository.existsByLesson_IdAndReporter_IdAndReason(
                lesson.getId(), reporter.getId(), reason)) {
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

    /** Sinh câu hỏi + câu trả lời; phần câu hỏi để nguyên (chưa trả lời) theo profile. */
    private void seedQuestionsAndAnswers(
            Course course,
            List<Lesson> lessons,
            List<User> learners,
            User instructor,
            int courseIndex,
            CourseProfile profile
    ) {
        if (instructor == null) {
            return;
        }
        int scale = Math.max(0, profile.questionScale());
        if (scale == 0) {
            return;
        }

        int answerThreshold = Math.max(0, Math.min(100, profile.answeredPercent()));

        for (int i = 0; i < learners.size(); i++) {
            User learner = learners.get(i);
            Lesson lesson = lessons.get((i * 3 + courseIndex) % lessons.size());

            for (int k = 0; k < scale; k++) {
                String content = questionContent(lesson, i + k);
                if (lessonQuestionRepository.existsByLesson_IdAndAuthor_IdAndContentIgnoreCase(
                        lesson.getId(), learner.getId(), content)) {
                    continue;
                }

                LessonQuestion question = lessonQuestionRepository.save(LessonQuestion.builder()
                        .lesson(lesson)
                        .author(learner)
                        .content(content)
                        .build());

                // Backdate câu hỏi để câu chưa trả lời cũng có "số giờ đã chờ" khác 0.
                int askedHoursAgo = 12 + (i * 11 + courseIndex * 5) % 400;
                LocalDateTime askedAt = LocalDateTime.now().minusHours(askedHoursAgo);
                jdbc.update("UPDATE lesson_questions SET created_at = ?, updated_at = ? WHERE id = ?",
                        askedAt, askedAt, question.getId());

                // Phần câu hỏi không được trả lời (để có nhóm "chưa trả lời").
                int roll = Math.floorMod(i * 10 + k * 3 + courseIndex, 100);
                if (roll >= answerThreshold) {
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
     * <p>Học viên được chia vòng tròn theo danh sách phòng ban; một phần nhỏ để trống
     * để tab "Phòng ban" có thêm nhóm "Chưa phân phòng ban".
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

            // Bỏ phòng ban cũ (nếu có) rồi gán phòng ban theo vòng tròn.
            learner.getDepartments().clear();
            // Cứ 8 người thì 1 người để trống -> có nhóm "Chưa phân phòng ban".
            if (i % 8 != 7) {
                learner.getDepartments().add(departments.get(i % departments.size()));
            }
            userRepository.save(learner);
        }

        log.info("Assigned {} learners across {} departments.", learners.size(), departments.size());
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

    /** Phòng ban duy nhất của học viên (null nếu chưa phân phòng ban hoặc thuộc nhiều phòng). */
    private static Department singleDepartmentOf(User learner) {
        if (learner.getDepartments() == null || learner.getDepartments().size() != 1) {
            return null;
        }
        return learner.getDepartments().iterator().next();
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

package com.example.starter_project_2025.system.exam.core.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

import com.example.starter_project_2025.init.SeededRandom;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptOption;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamStatus;
import com.example.starter_project_2025.system.exam.core.domain.ExamType;
import com.example.starter_project_2025.system.exam.result.domain.ResultVisibility;
import com.example.starter_project_2025.system.question.core.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionOption;
import com.example.starter_project_2025.system.question.core.domain.QuestionRepository;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Seed dữ liệu bài thi mẫu: tạo đề thi cho từng khóa học đã xuất bản và sinh
 * lịch sử làm bài ({@link ExamAttempt}) để các API thống kê theo Course / Exam /
 * Student đọc được dữ liệu thực tế.
 *
 * <p>Nguyên tắc:
 * <ul>
 *   <li><b>Idempotent:</b> đề thi được nhận diện theo tiêu đề; lượt làm bài được
 *       nhận diện theo ràng buộc duy nhất {@code (exam_id, student_id, attempt_number)}.
 *       Chạy lại nhiều lần không tạo bản ghi trùng và không xoá dữ liệu cũ.</li>
 *   <li><b>Ổn định theo seed:</b> mọi phân bổ ngẫu nhiên dùng
 *       {@link SeededRandom} với fixed seed nên dữ liệu luôn giống nhau.</li>
 *   <li><b>Không phá vỡ dữ liệu thật:</b> không {@code deleteAll}, không ghi đè
 *       bản ghi do người dùng tạo (chỉ bổ sung phần còn thiếu).</li>
 * </ul>
 */
@Slf4j
@Order(31)
@Component
@RequiredArgsConstructor
@StartupMutation
public class ExamDataInitializer implements CommandLineRunner {

    /** Tỉ lệ học viên đăng ký khóa học nhưng chưa tham gia làm bài: 10%..15%. */
    private static final int MIN_NOT_ATTEMPTED_PERCENT = 10;
    private static final int MAX_NOT_ATTEMPTED_PERCENT = 15;

    /** Tỉ lệ học viên trượt lần 1 sẽ thi lại: 40%..70%. */
    private static final int MIN_RETAKE_PERCENT = 40;
    private static final int MAX_RETAKE_PERCENT = 70;

    /** Tỉ lệ người thi lại vẫn trượt (sau lần 2): 30%..50%. */
    private static final int MIN_STILL_FAIL_PERCENT = 30;
    private static final int MAX_STILL_FAIL_PERCENT = 50;

    /** Số lượt thi tối đa của đề thi mẫu (khớp {@code Exam.maxAttempts}). */
    private static final int MAX_ATTEMPTS = 3;

    /** Thời điểm nộp bài cách nhau (giờ) giữa các lượt thi của một học viên. */
    private static final int HOURS_BETWEEN_ATTEMPTS = 72;

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    @Override
    @Transactional
    public void run(String... args) {
        List<Question> bank = loadQuestionBank();
        if (bank.isEmpty()) {
            log.info("Skip sample assessments: question bank is empty.");
            return;
        }

        User creator = userRepository.findByEmail("admin@example.com").orElse(null);
        Long creatorId = creator == null ? null : creator.getId();

        int createdExams = createSampleExams(creatorId, bank);
        int linkedExams = linkExistingCourseExams();
        int seededAttempts = seedAttemptsForCourseExams();

        if (createdExams > 0) {
            log.info("Created {} sample assessments.", createdExams);
        }
        if (linkedExams > 0) {
            log.info("Linked {} existing sample assessments to their course.", linkedExams);
        }
        if (seededAttempts > 0) {
            log.info("Seeded {} exam attempts.", seededAttempts);
        }
    }

    /**
     * Gắn khóa học cho các đề thi mẫu đã tồn tại từ lần chạy trước.
     *
     * <p>Đề thi được nhận diện theo tiêu đề chuẩn
     * {@code "<tên khóa học> - Bài kiểm tra (mẫu)"}. Trước đây các đề này được
     * tạo mà không gắn khóa học, khiến các API thống kê theo Course (tab
     * "Exam Analytics", phân tích theo phòng ban) không đọc được dữ liệu.
     *
     * @return số đề thi vừa được gắn khóa học
     */
    private int linkExistingCourseExams() {
        Map<String, Course> byTitle = new HashMap<>();
        for (Course course : loadPublishedCourses()) {
            byTitle.put(courseExamTitle(course), course);
        }
        if (byTitle.isEmpty()) {
            return 0;
        }

        int linked = 0;
        for (Exam exam : examRepository.findAll()) {
            Course course = byTitle.get(exam.getTitle());
            if (course == null) {
                continue;
            }
            if (exam.getCourse() != null && exam.getCourse().getId().equals(course.getId())) {
                continue;
            }
            exam.setCourse(course);
            examRepository.save(exam);
            linked++;
        }
        return linked;
    }

    // =====================================================================
    // Ngân hàng câu hỏi
    // =====================================================================

    /** Lấy các câu hỏi gốc (không phải bản sao trong đề) đang active. */
    private List<Question> loadQuestionBank() {
        return questionRepository.findAll().stream()
                .filter(q -> q.getSourceQuestionId() == null && Boolean.TRUE.equals(q.getIsActive()))
                .sorted((a, b) -> Long.compare(a.getId(), b.getId()))
                .collect(Collectors.toList());
    }

    private static List<Question> byType(List<Question> bank, QuestionType type) {
        return bank.stream().filter(q -> q.getType() == type).collect(Collectors.toList());
    }

    private static List<Question> head(List<Question> list, int n) {
        return new ArrayList<>(list.subList(0, Math.min(n, list.size())));
    }

    @SafeVarargs
    private static List<Question> join(List<Question>... lists) {
        List<Question> all = new ArrayList<>();
        for (List<Question> l : lists) {
            all.addAll(l);
        }
        return all;
    }

    // =====================================================================
    // Tạo đề thi
    // =====================================================================

    /**
     * Tạo đề thi mẫu: một bộ đề "độc lập" (không gắn khóa học) như trước, cộng
     * thêm một đề thi cho <b>mỗi khóa học đã xuất bản</b> để sinh lượt làm bài.
     */
    private int createSampleExams(Long creatorId, List<Question> bank) {
        List<Question> mc = byType(bank, QuestionType.MULTIPLE_CHOICE);
        List<Question> essay = byType(bank, QuestionType.ESSAY);
        List<Question> coding = byType(bank, QuestionType.CODING);

        Set<String> existing = examRepository.findAll().stream()
                .map(Exam::getTitle)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        int created = 0;
        created += create(existing, creatorId, "Java Core - Quiz trắc nghiệm 15 phút (mẫu)", 15,
                ExamCategory.QUIZ, ExamType.MULTIPLE_CHOICE, ResultVisibility.IMMEDIATE, true, "5", false,
                head(mc, 10), null) ? 1 : 0;
        created += create(existing, creatorId, "Java OOP - Giữa kỳ (mẫu)", 45,
                ExamCategory.MIDTERM, ExamType.MIXED, ResultVisibility.MANUAL_RELEASE, false, "5", false,
                join(head(mc, 8), head(essay, 2)), null) ? 1 : 0;
        created += create(existing, creatorId, "Java - Bài tự luận (mẫu)", 60,
                ExamCategory.ASSIGNMENT, ExamType.ESSAY, ResultVisibility.MANUAL_RELEASE, false, "5", false,
                head(essay, 4), null) ? 1 : 0;
        created += create(existing, creatorId, "Lập trình Java - Thuật toán cơ bản (mẫu)", 45,
                ExamCategory.ASSIGNMENT, ExamType.CODING, ResultVisibility.AFTER_EXAM_CLOSED, true, "5", false,
                head(coding, 5), null) ? 1 : 0;
        created += create(existing, creatorId, "Java tổng hợp - Cuối kỳ (mẫu)", 90,
                ExamCategory.FINAL_TEST, ExamType.MIXED, ResultVisibility.MANUAL_RELEASE, false, "5", true,
                join(head(mc, 6), head(essay, 2), head(coding, 2)), null) ? 1 : 0;

        // Một đề thi cho mỗi khóa học đã xuất bản -> sinh lượt làm bài & thống kê.
        for (Course course : loadPublishedCourses()) {
            List<Question> sources = pickCourseQuestions(course, bank);
            if (sources.isEmpty()) {
                continue;
            }
            String title = courseExamTitle(course);
            created += create(existing, creatorId, title, durationFor(course),
                    categoryFor(course), examTypeFor(sources), ResultVisibility.IMMEDIATE,
                    true, passScoreFor(course), false, sources, course) ? 1 : 0;
        }

        return created;
    }

    /** Danh sách khóa học đã xuất bản và đang active. */
    private List<Course> loadPublishedCourses() {
        List<Course> courses = new ArrayList<>();
        for (Course course : courseRepository.findAll()) {
            if (Boolean.FALSE.equals(course.getIsActive())) {
                continue;
            }
            if (course.getStatus() != CourseStatus.PUBLISHED) {
                continue;
            }
            courses.add(course);
        }
        courses.sort(Comparator.comparing(c -> c.getName() == null ? "" : c.getName()));
        return courses;
    }

    /**
     * Chọn câu hỏi cho đề thi của một khóa học.
     *
     * <p>Ưu tiên câu hỏi trắc nghiệm; nếu không có thì dùng câu hỏi tự luận /
     * lập trình. Lát cắt được xoay vòng theo id khóa học để mỗi khóa có bộ câu
     * hỏi khác nhau nhưng vẫn ổn định giữa các lần chạy.
     */
    private List<Question> pickCourseQuestions(Course course, List<Question> bank) {
        List<Question> mc = byType(bank, QuestionType.MULTIPLE_CHOICE);
        List<Question> essay = byType(bank, QuestionType.ESSAY);
        List<Question> coding = byType(bank, QuestionType.CODING);

        int offset = course.getId() == null ? 0 : (int) Math.floorMod(course.getId(), Math.max(1, mc.size()));
        List<Question> rotated = new ArrayList<>(mc.subList(offset, mc.size()));
        rotated.addAll(mc.subList(0, offset));

        List<Question> sources = head(rotated, 8);
        if (sources.isEmpty()) {
            sources = head(essay, 4);
        }
        if (sources.isEmpty()) {
            sources = head(coding, 4);
        }
        return sources;
    }

    private static String courseExamTitle(Course course) {
        return course.getName() + " - Bài kiểm tra (mẫu)";
    }

    private static int durationFor(Course course) {
        // Khóa dễ -> đề nhanh; khóa nâng cao -> đề dài hơn.
        return switch (course.getLevel()) {
            case BEGINNER -> 20;
            case INTERMEDIATE -> 30;
            case ADVANCED -> 45;
            default -> 30;
        };
    }

    private static ExamCategory categoryFor(Course course) {
        return switch (course.getLevel()) {
            case BEGINNER -> ExamCategory.QUIZ;
            case ADVANCED -> ExamCategory.FINAL_TEST;
            default -> ExamCategory.MIDTERM;
        };
    }

    private static ExamType examTypeFor(List<Question> sources) {
        boolean hasEssay = sources.stream().anyMatch(q -> q.getType() == QuestionType.ESSAY);
        boolean hasCoding = sources.stream().anyMatch(q -> q.getType() == QuestionType.CODING);
        if (hasEssay || hasCoding) {
            return ExamType.MIXED;
        }
        return ExamType.MULTIPLE_CHOICE;
    }

    /**
     * Điểm đạt của đề thi theo độ khó của khóa học.
     *
     * <p>Khóa cơ bản dễ đạt hơn; khóa nâng cao khó đạt hơn -> tỉ lệ Pass/Fail
     * khác nhau rõ rệt giữa các khóa.
     */
    private static String passScoreFor(Course course) {
        return switch (course.getLevel()) {
            case BEGINNER -> "4";
            case INTERMEDIATE -> "5";
            case ADVANCED -> "6";
            default -> "5";
        };
    }

    /**
     * Tạo một đề thi.
     *
     * @param course khóa học liên kết (null = đề độc lập, không gắn khóa học nào)
     */
    private boolean create(Set<String> existing, Long creatorId, String title, int minutes, ExamCategory category,
                           ExamType type, ResultVisibility visibility, boolean showAnswers, String passScore,
                           boolean antiCheat, List<Question> sources, Course course) {
        if (existing.contains(title) || sources.isEmpty()) {
            return false;
        }
        Exam exam = new Exam();
        exam.setIsActive(true);
        exam.setTitle(title);
        exam.setDurationMinutes(minutes);
        exam.setCategory(category);
        exam.setExamType(type);
        exam.setStatus(ExamStatus.PUBLISHED);
        exam.setResultVisibility(visibility);
        exam.setShowAnswersAfterExam(showAnswers);
        exam.setMaxScore(BigDecimal.TEN);
        exam.setPassScore(new BigDecimal(passScore));
        exam.setMaxAttempts(MAX_ATTEMPTS);
        exam.setShuffleQuestions(true);
        exam.setShuffleOptions(true);
        exam.setAntiCheatEnabled(antiCheat);
        exam.setDetectTabSwitch(antiCheat);
        exam.setBlockCopyPaste(antiCheat);
        // Liên kết khóa học: bắt buộc để các API thống kê theo Course (tab
        // "Exam Analytics", phân tích theo phòng ban) đọc được đề + lượt thi.
        exam.setCourse(course);
        if (creatorId != null) {
            exam.setCreatedBy(creatorId);
        }
        Set<Question> copies = new LinkedHashSet<>();
        for (Question source : sources) {
            copies.add(questionRepository.save(copyOf(source)));
        }
        exam.setQuestions(copies);
        examRepository.save(exam);
        existing.add(title);
        return true;
    }

    /** Ban sao rieng cua cau hoi trong de (giong cach ExamServiceImpl them cau hoi vao de). */
    private static Question copyOf(Question source) {
        Question copy = new Question();
        copy.setIsActive(Boolean.TRUE);
        copy.setContent(source.getContent());
        copy.setType(source.getType());
        copy.setDifficulty(source.getDifficulty());
        copy.setTopic(source.getTopic());
        copy.setImageUrl(source.getImageUrl());
        copy.setPoints(source.getPoints());
        copy.setCodeSpec(source.getCodeSpec());
        copy.setSourceQuestionId(source.getId());
        source.getGradingCriteria().forEach(sc -> {
            EssayGradingCriterion c = new EssayGradingCriterion();
            c.setName(sc.getName());
            c.setDescription(sc.getDescription());
            c.setWeightPercentage(sc.getWeightPercentage());
            copy.getGradingCriteria().add(c);
        });
        for (QuestionOption o : source.getOptions()) {
            QuestionOption oc = new QuestionOption();
            oc.setContent(o.getContent());
            oc.setCorrect(o.isCorrect());
            oc.setImageUrl(o.getImageUrl());
            oc.setQuestion(copy);
            copy.getOptions().add(oc);
        }
        return copy;
    }

    // =====================================================================
    // Luot lam bai (ExamAttempt)
    // =====================================================================

    /**
     * Sinh lượt làm bài cho các đề thi gắn với khóa học.
     *
     * <p>Mỗi học viên đã đăng ký khóa học sẽ:
     * <ul>
     *   <li>10%..15% không làm bài (trạng thái "chưa thi").</li>
     *   <li>Còn lại làm bài lần 1 với điểm phân bổ đa dạng.</li>
     *   <li>Người trượt lần 1 có thể thi lại lần 2 (có người đạt, có người vẫn trượt).</li>
     *   <li>Người vẫn trượt lần 2 có thể thi lại lần 3.</li>
     * </ul>
     */
    private int seedAttemptsForCourseExams() {
        int total = 0;

        for (Course course : loadPublishedCourses()) {
            Exam exam = findCourseExam(course);
            if (exam == null) {
                continue;
            }

            List<User> students = enrolledStudents(course);
            if (students.isEmpty()) {
                continue;
            }

            total += seedAttemptsForExam(exam, students, course);
        }

        return total;
    }

    /** Tìm đề thi mẫu gắn với một khóa học (theo tiêu đề chuẩn). */
    private Exam findCourseExam(Course course) {
        String title = courseExamTitle(course);
        return examRepository.findAll().stream()
                .filter(e -> title.equals(e.getTitle()))
                .findFirst()
                .orElse(null);
    }

    /** Danh sách học viên đã đăng ký khóa học (dùng cho đề thi của khóa học đó). */
    private List<User> enrolledStudents(Course course) {
        List<CourseEnrollment> enrollments = enrollmentRepository.findAllByCourse_Id(course.getId());
        List<User> students = new ArrayList<>();
        Set<Long> seen = new LinkedHashSet<>();
        for (CourseEnrollment enrollment : enrollments) {
            User user = enrollment.getUser();
            if (user == null || user.getId() == null) {
                continue;
            }
            if (Boolean.FALSE.equals(user.getIsActive())) {
                continue;
            }
            if (seen.add(user.getId())) {
                students.add(user);
            }
        }
        students.sort(Comparator.comparing(u -> u.getEmail() == null ? "" : u.getEmail()));
        return students;
    }

    /**
     * Sinh lượt làm bài cho một đề thi.
     *
     * <p>Tỉ lệ đạt/trượt khác nhau theo độ khó của khóa học:
     * <ul>
     *   <li>Khóa cơ bản: tỉ lệ đạt ~85%.</li>
     *   <li>Khóa trung cấp: tỉ lệ đạt ~70%.</li>
     *   <li>Khóa nâng cao: tỉ lệ đạt ~55%.</li>
     * </ul>
     */
    private int seedAttemptsForExam(Exam exam, List<User> students, Course course) {
        Random random = SeededRandom.forScope("exam-attempts", exam.getId());
        BigDecimal passScore = exam.getPassScore() == null ? new BigDecimal("5") : exam.getPassScore();
        BigDecimal maxScore = exam.getMaxScore() == null ? BigDecimal.TEN : exam.getMaxScore();

        double passRate = passRateFor(course);
        int notAttemptedPercent = MIN_NOT_ATTEMPTED_PERCENT
                + random.nextInt(MAX_NOT_ATTEMPTED_PERCENT - MIN_NOT_ATTEMPTED_PERCENT + 1);
        int retakePercent = MIN_RETAKE_PERCENT
                + random.nextInt(MAX_RETAKE_PERCENT - MIN_RETAKE_PERCENT + 1);
        int stillFailPercent = MIN_STILL_FAIL_PERCENT
                + random.nextInt(MAX_STILL_FAIL_PERCENT - MIN_STILL_FAIL_PERCENT + 1);

        int created = 0;
        int studentIndex = 0;

        for (User student : students) {
            studentIndex++;

            // 1) Hoc vien chua tham gia lam bai.
            if (studentIndex % 100 < notAttemptedPercent) {
                continue;
            }

            // 2) Luot thi 1.
            BigDecimal firstScore = scoreFor(random, passRate, maxScore);
            Instant submittedAt = submittedAtFor(random, studentIndex, exam.getId());
            ExamAttempt attempt1 = createAttempt(
                    exam, student, 1, firstScore, maxScore, passScore, submittedAt,
                    totalPointsOf(exam));
            created++;
            if (attempt1 == null) {
                continue;
            }

            if (firstScore.compareTo(passScore) >= 0) {
                // Da dat -> khong thi lai.
                continue;
            }

            // 3) Luot thi 2 (mot phan nguoi truot thi lai).
            if (!shouldRetake(random, retakePercent)) {
                continue;
            }

            boolean passOnRetake = random.nextInt(100) >= stillFailPercent;
            BigDecimal secondScore = passOnRetake
                    ? scoreFor(random, 1.0, maxScore)
                    : scoreFor(random, 0.0, maxScore);
            Instant secondSubmittedAt = submittedAt.plus(HOURS_BETWEEN_ATTEMPTS, ChronoUnit.HOURS);
            ExamAttempt attempt2 = createAttempt(
                    exam, student, 2, secondScore, maxScore, passScore, secondSubmittedAt,
                    totalPointsOf(exam));
            created++;
            if (attempt2 == null || passOnRetake) {
                continue;
            }

            // 4) Luot thi 3 (nguoi van truot o lan 2).
            if (!shouldRetake(random, retakePercent / 2)) {
                continue;
            }
            boolean passOnThird = random.nextInt(100) >= stillFailPercent;
            BigDecimal thirdScore = passOnThird
                    ? scoreFor(random, 1.0, maxScore)
                    : scoreFor(random, 0.0, maxScore);
            Instant thirdSubmittedAt = secondSubmittedAt.plus(HOURS_BETWEEN_ATTEMPTS, ChronoUnit.HOURS);
            createAttempt(
                    exam, student, 3, thirdScore, maxScore, passScore, thirdSubmittedAt,
                    totalPointsOf(exam));
            created++;
        }

        log.info("Seeded attempts for exam '{}': students={}, attempts={}, passRate={}%, notAttempted={}%.",
                exam.getTitle(), students.size(), created, Math.round(passRate * 100), notAttemptedPercent);

        return created;
    }

    /** Ti le dat mong muon theo do kho cua khoa hoc. */
    private static double passRateFor(Course course) {
        return switch (course.getLevel()) {
            case BEGINNER -> 0.85;
            case INTERMEDIATE -> 0.70;
            case ADVANCED -> 0.55;
            default -> 0.70;
        };
    }

    private static boolean shouldRetake(Random random, int percent) {
        return random.nextInt(100) < percent;
    }

    /**
     * Sinh điểm theo phân bổ đa dạng.
     *
     * <p>Có 3 nhóm rõ rệt:
     * <ul>
     *   <li>Xuat sac: 8.5..10 (nhom tren cung).</li>
     *   <li>Trung binh kha: 6.0..8.0.</li>
     *   <li>Kem / truot: duoi 5.0.</li>
     * </ul>
     *
     * @param passRate ti le dat mong muon (0..1)
     */
    private static BigDecimal scoreFor(Random random, double passRate, BigDecimal maxScore) {
        double max = maxScore.doubleValue();
        double value;

        double roll = random.nextDouble();
        if (roll < passRate) {
            // Nhom dat: phan bo tu nguong dat toi diem toi da, tap trung o khoang
            // 6.0 - 8.5 (da dang nhung khong don cuc).
            double threshold = max * 0.5;
            value = threshold + random.nextDouble() * (max - threshold);
            // Co mot phan nhom xuat sac (>= 8.5).
            if (random.nextInt(100) < 25) {
                value = 8.5 + random.nextDouble() * Math.max(0.1, max - 8.5);
            }
        } else {
            // Nhom truot: duoi nguong dat, phan bo tu 1.0 toi nguong.
            double threshold = max * 0.5;
            value = 1.0 + random.nextDouble() * Math.max(0.5, threshold - 1.0);
        }

        value = Math.max(0.0, Math.min(max, value));
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }

    /** Thoi diem nop bai rai rac trong 120 ngay gan nhat. */
    private static Instant submittedAtFor(Random random, int studentIndex, Long examId) {
        long daysAgo = 1 + random.nextInt(120);
        long minutesOffset = Math.floorMod(studentIndex * 37L + (examId == null ? 0 : examId), 60);
        return Instant.now()
                .minus(daysAgo, ChronoUnit.DAYS)
                .minus(minutesOffset, ChronoUnit.MINUTES)
                .truncatedTo(ChronoUnit.SECONDS);
    }

    /** Tong diem cua de thi (dung lam {@code totalPoints} cho luot lam bai). */
    private int totalPointsOf(Exam exam) {
        return exam.getQuestions().stream()
                .mapToInt(Question::getPoints)
                .sum();
    }

    /**
     * Tạo một lượt làm bài đã hoàn tất.
     *
     * <p><b>Idempotent:</b> nếu lượt làm bài với cùng
     * {@code (exam, student, attemptNumber)} đã tồn tại thì không tạo lại.
     *
     * @return lượt làm bài vừa tạo, hoặc {@code null} nếu đã tồn tại
     */
    private ExamAttempt createAttempt(
            Exam exam,
            User student,
            int attemptNumber,
            BigDecimal score,
            BigDecimal maxScore,
            BigDecimal passScore,
            Instant submittedAt,
            int totalPoints
    ) {
        // Kiem tra ton tai truoc khi tao (rang buoc unique tren DB).
        boolean exists = attemptRepository
                .findAllByExam_IdAndStudent_IdOrderByAttemptNumberAsc(exam.getId(), student.getId())
                .stream()
                .anyMatch(a -> a.getAttemptNumber() == attemptNumber);
        if (exists) {
            return null;
        }

        Instant startedAt = submittedAt.minus(20, ChronoUnit.MINUTES);

        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setAttemptNumber(attemptNumber);
        attempt.setDurationMinutes(exam.getDurationMinutes());
        attempt.setTotalPoints(totalPoints);
        attempt.setMaxScore(maxScore);
        attempt.setPassScore(passScore);
        attempt.setStartedAt(startedAt);
        attempt.setOfficialDeadlineAt(startedAt.plus(exam.getDurationMinutes(), ChronoUnit.MINUTES));
        attempt.setDeadlineAt(startedAt.plus(exam.getDurationMinutes(), ChronoUnit.MINUTES));
        attempt.setLateGraceEligible(false);
        attempt.setLatePolicy(exam.getLatePolicy());
        attempt.setLatePenaltyPercent(exam.getLatePenaltyPercent());
        attempt.setSubmittedAt(submittedAt);
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt.setObjectiveScore(score);
        attempt.setFinalScore(score);

        // Snapshot cau hoi + dap an tuong ung voi diem de du lieu bai lam khop
        // voi diem so (API xem lai bai lam hien thi dung).
        snapshotQuestions(attempt, exam, score);

        return attemptRepository.save(attempt);
    }

    /**
     * Snapshot câu hỏi của đề vào lượt làm bài, đánh dấu đúng/sai theo tỉ lệ
     * điểm đạt được để bài làm nhất quán với điểm số.
     */
    private void snapshotQuestions(ExamAttempt attempt, Exam exam, BigDecimal score) {
        List<Question> source = new ArrayList<>(exam.getQuestions());
        source.sort(Comparator.comparing(Question::getId));
        if (source.isEmpty()) {
            return;
        }

        int totalPoints = source.stream().mapToInt(Question::getPoints).sum();
        BigDecimal maxScore = attempt.getMaxScore() == null ? BigDecimal.TEN : attempt.getMaxScore();
        double achievedRatio = totalPoints <= 0
                ? 0.0
                : score.doubleValue() * totalPoints / maxScore.doubleValue();

        // So diem "dung" tuong dung voi ti le dat duoc.
        int earnedPoints = (int) Math.round(achievedRatio);

        int order = 0;
        int remainingEarned = earnedPoints;
        for (Question q : source) {
            ExamAttemptQuestion snap = new ExamAttemptQuestion();
            snap.setAttempt(attempt);
            snap.setSourceQuestionId(q.getId());
            snap.setContent(q.getContent());
            snap.setImageUrl(q.getImageUrl());
            snap.setType(q.getType());
            snap.setPoints(q.getPoints());
            snap.setCodeSpec(q.getCodeSpec());
            snap.setDisplayOrder(order++);
            q.getGradingCriteria().forEach(sourceCriterion -> {
                EssayGradingCriterion criterion = new EssayGradingCriterion();
                criterion.setName(sourceCriterion.getName());
                criterion.setDescription(sourceCriterion.getDescription());
                criterion.setWeightPercentage(sourceCriterion.getWeightPercentage());
                snap.getGradingCriteria().add(criterion);
            });

            List<QuestionOption> options = new ArrayList<>(q.getOptions());
            options.sort(Comparator.comparing(QuestionOption::getId));
            int optionOrder = 0;
            for (QuestionOption o : options) {
                ExamAttemptOption snapOption = new ExamAttemptOption();
                snapOption.setQuestion(snap);
                snapOption.setSourceOptionId(o.getId());
                snapOption.setContent(o.getContent());
                snapOption.setImageUrl(o.getImageUrl());
                snapOption.setCorrect(o.isCorrect());
                snapOption.setDisplayOrder(optionOrder++);
                snap.getOptions().add(snapOption);
            }
            attempt.getQuestions().add(snap);

            // Cau hoi trac nghiem: chon dap an dung neu con "diem dat", nguoc lai
            // chon mot dap an sai (hoac bo trong neu khong con diem).
            if (q.getType() == QuestionType.MULTIPLE_CHOICE) {
                int questionPoints = q.getPoints();
                List<QuestionOption> correct = options.stream()
                        .filter(QuestionOption::isCorrect)
                        .collect(Collectors.toList());
                List<QuestionOption> wrong = options.stream()
                        .filter(o -> !o.isCorrect())
                        .collect(Collectors.toList());

                Optional<QuestionOption> chosen;
                boolean isCorrectChoice = false;
                if (remainingEarned >= questionPoints && !correct.isEmpty()) {
                    chosen = Optional.of(correct.get(0));
                    remainingEarned -= questionPoints;
                    isCorrectChoice = true;
                } else if (!wrong.isEmpty()) {
                    chosen = Optional.of(wrong.get(0));
                } else {
                    chosen = Optional.empty();
                }

                if (chosen.isPresent()) {
                    ExamAttemptAnswer answer = new ExamAttemptAnswer();
                    answer.setAttempt(attempt);
                    answer.setQuestion(snap);
                    answer.setSaved(true);
                    answer.setScore(BigDecimal.valueOf(isCorrectChoice ? questionPoints : 0)
                            .setScale(4, RoundingMode.HALF_UP));
                    snap.getOptions().stream()
                            .filter(o -> o.getSourceOptionId().equals(chosen.get().getId()))
                            .findFirst()
                            .ifPresent(o -> answer.getSelectedOptions().add(o));
                    attempt.getAnswers().add(answer);
                }
            } else if (q.getType() == QuestionType.ESSAY) {
                ExamAttemptAnswer answer = new ExamAttemptAnswer();
                answer.setAttempt(attempt);
                answer.setQuestion(snap);
                answer.setSaved(true);
                answer.setTextAnswer(essayAnswerFor(attempt.getStudent()));
                answer.setScore(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
                attempt.getAnswers().add(answer);
            }
        }
    }

    private static String essayAnswerFor(User student) {
        String name = student == null ? "Học viên" : student.getFullName();
        return "Bài làm của " + name
                + ". Câu trả lời nêu rõ định nghĩa, giải thích nguyên nhân và đưa ra ví dụ thực tế.";
    }
}

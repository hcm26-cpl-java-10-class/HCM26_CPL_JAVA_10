package com.example.starter_project_2025.system.demo.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseReportService {

    private final CourseReportRepository courseReportRepository;
    private final LessonRepository lessonRepository;
    private final LessonProgressRepository lessonProgressRepository;
    private final CertificateRepository certificateRepository;

    @Transactional(readOnly = true)
    public List<CourseReportDTO> getCourseReport() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        List<Course> courses = getCoursesForCurrentUser(auth);

        List<CourseReportDTO> result = new ArrayList<>();

        for (Course course : courses) {
            List<CourseEnrollment> enrollments = courseReportRepository.findByCourseIdWithUser(course.getId())
                    .stream()
                    .filter(enrollment -> !Boolean.FALSE.equals(enrollment.getIsActive()))
                    .toList();

            int lessonCount = lessonRepository.findActiveByCourseIdOrdered(course.getId()).size();
            List<CourseLearnerReportDTO> learners = enrollments.stream()
                    .map(enrollment -> {
                        long completedLessons = lessonProgressRepository.findAllByEnrollment_Id(enrollment.getId())
                                .stream()
                                .filter(progress -> progress.isCompleted())
                                .count();
                        int percentage = lessonCount == 0
                                ? 0
                                : (int) Math.round(completedLessons * 100.0 / lessonCount);
                        return CourseLearnerReportDTO.builder()
                                .enrollmentId(enrollment.getId())
                                .studentName(enrollment.getUser().getFullName())
                                .studentEmail(enrollment.getUser().getEmail())
                                .progressPercentage(percentage)
                                .completed(percentage == 100)
                                .enrolledAt(enrollment.getCreatedAt())
                                .build();
                    })
                    .toList();

            List<String> studentNames = enrollments.stream()
                    .map(enrollment -> enrollment.getUser())
                    .filter(user -> user != null)
                    .map(user -> user.getFullName())
                    .filter(name -> name != null && !name.isBlank())
                    .distinct()
                    .sorted(String::compareToIgnoreCase)
                    .toList();

            long completedLearners = learners.stream().filter(CourseLearnerReportDTO::isCompleted).count();
            int averageProgress = learners.isEmpty()
                    ? 0
                    : (int) Math.round(learners.stream().mapToInt(CourseLearnerReportDTO::getProgressPercentage).average().orElse(0));
            int completionRate = learners.isEmpty()
                    ? 0
                    : (int) Math.round(completedLearners * 100.0 / learners.size());

            result.add(CourseReportDTO.builder()
                    .courseId(course.getId())
                    .courseName(course.getName())
                    .instructor(course.getInstructor())
                    .courseStatus(course.getStatus() != null
                            ? course.getStatus().name()
                            : CourseStatus.DRAFT.name())
                    .studentCount((long) studentNames.size())
                    .students(studentNames)
                    .categories(course.getCategories().stream()
                            .map(category -> category.getName())
                            .filter(name -> name != null && !name.isBlank())
                            .sorted(String::compareToIgnoreCase)
                            .toList())
                    .courseLevel(course.getLevel() == null ? null : course.getLevel().name())
                    .averageProgress(averageProgress)
                    .activeLearners(learners.size() - completedLearners)
                    .completedLearners(completedLearners)
                    .completionRate(completionRate)
                    .certificatesIssued(certificateRepository.findUserIdsByCourseId(course.getId()).size())
                    .learners(learners)
                    .thumbnailUrl(course.getThumbnailUrl())
                    .lessonCount(lessonCount)
                    .build());
        }

        result.sort(Comparator.comparing(
                CourseReportDTO::getCourseName,
                Comparator.nullsLast(String::compareToIgnoreCase)
        ));

        return result;
    }

    private List<Course> getCoursesForCurrentUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return Collections.emptyList();
        }

        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()) || "ADMIN".equals(a.getAuthority()));

        if (isAdmin) {
            return courseReportRepository.findAllCoursesWithMeta();
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            User user = userPrincipal.getUser();
            Long userId = user.getId();
            String fullName = (user.getFullName() != null && !user.getFullName().isBlank())
                    ? user.getFullName().trim()
                    : "___NON_EXISTING___";
            String email = (user.getEmail() != null && !user.getEmail().isBlank())
                    ? user.getEmail().trim()
                    : "___NON_EXISTING___";

            return courseReportRepository.findCoursesByTeacher(userId, fullName, email);
        }

        return Collections.emptyList();
    }

    // =====================================================================
    // Learning hours analytics
    // =====================================================================

    /**
     * Bảng "Learning hours analytics": mỗi dòng là một lượt đăng ký, kèm
     * giờ học ở 4 cấp (học viên / phòng ban / khóa học / riêng lượt đăng ký)
     * cùng ngày đăng ký để đối chiếu.
     *
     * <p>Giờ học được tính từ {@code LessonProgress.studySeconds} - tổng số giây
     * học viên đã dành cho các bài của khóa học.
     */
    @Transactional(readOnly = true)
    public LearningHoursReportDTO getLearningHoursReport() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        Set<Long> accessibleCourseIds = getCoursesForCurrentUser(auth).stream()
                .map(Course::getId)
                .collect(Collectors.toSet());

        List<Object[]> rawRows = courseReportRepository.findLearningHoursRows();

        // --- Phòng ban của từng học viên (một người có thể thuộc nhiều phòng ban) ---
        Set<Long> userIds = new HashSet<>();
        for (Object[] row : rawRows) {
            userIds.add((Long) row[1]);
        }
        Map<Long, List<DepartmentRef>> departmentsByUser = new HashMap<>();
        Map<Long, String> departmentCodes = new HashMap<>();
        if (!userIds.isEmpty()) {
            for (Object[] row : courseReportRepository.findUserDepartments(userIds)) {
                Long userId = (Long) row[0];
                Long deptId = (Long) row[1];
                String deptName = (String) row[2];
                departmentsByUser.computeIfAbsent(userId, k -> new ArrayList<>())
                        .add(new DepartmentRef(deptId, deptName));
                departmentCodes.putIfAbsent(deptId, deptName);
            }
        }

        LocalDateTime now = LocalDateTime.now();

        // --- Gom nhóm từ chính các dòng (nguồn sự thật duy nhất) ---
        // hoursByStudent: tổng giờ của học viên (mỗi enrollment chỉ tính 1 lần).
        Map<Long, Double> hoursByStudent = new LinkedHashMap<>();
        Map<Long, Set<Long>> coursesByStudent = new LinkedHashMap<>();
        Map<Long, Long> enrollmentCountByStudent = new LinkedHashMap<>();
        Map<Long, String> studentNames = new LinkedHashMap<>();
        Map<Long, String> studentEmails = new LinkedHashMap<>();

        Map<Long, Double> hoursByDepartment = new LinkedHashMap<>();
        Map<Long, Set<Long>> learnersByDepartment = new LinkedHashMap<>();
        Map<Long, Long> enrollmentCountByDepartment = new LinkedHashMap<>();

        Map<Long, Double> hoursByCourse = new LinkedHashMap<>();
        Map<Long, Set<Long>> learnersByCourse = new LinkedHashMap<>();
        Map<Long, Long> enrollmentCountByCourse = new LinkedHashMap<>();

        // Dòng chi tiết, kèm giờ học của từng cấp.
        List<LearningHoursRowDTO> rows = new ArrayList<>();
        // Tổng giờ của toàn hệ thống: mỗi enrollment chỉ tính đúng 1 lần.
        double totalHours = 0;
        // Học viên không thuộc phòng ban nào -> gom vào nhóm "Unassigned".
        long unassignedEnrollments = 0;
        double unassignedHours = 0;

        // Lưu giờ học theo enrollment để tính lại tổng cấp phòng ban/khóa học.
        List<RowDraft> drafts = new ArrayList<>();

        for (Object[] row : rawRows) {
            Long enrollmentId = (Long) row[0];
            Long userId = (Long) row[1];
            String studentName = trimToNull((String) row[2]);
            String studentEmail = (String) row[3];
            Long courseId = (Long) row[4];
            String courseName = (String) row[5];
            LocalDateTime enrolledAt = (LocalDateTime) row[6];
            LocalDateTime lastAccessedAt = (LocalDateTime) row[7];
            int completedLessons = ((Number) row[8]).intValue();
            int totalLessons = ((Number) row[9]).intValue();
            long studySeconds = ((Number) row[10]).longValue();

            // Giới hạn theo các khóa học mà user được xem (admin thì xem tất cả).
            if (!accessibleCourseIds.isEmpty() && !accessibleCourseIds.contains(courseId)) {
                continue;
            }

            double enrollmentHours = round2(studySeconds / 3600.0);
            totalHours += enrollmentHours;

            studentNames.putIfAbsent(userId, studentName);
            studentEmails.putIfAbsent(userId, studentEmail);
            hoursByStudent.merge(userId, enrollmentHours, Double::sum);
            coursesByStudent.computeIfAbsent(userId, k -> new LinkedHashSet<>()).add(courseId);
            enrollmentCountByStudent.merge(userId, 1L, Long::sum);

            hoursByCourse.merge(courseId, enrollmentHours, Double::sum);
            learnersByCourse.computeIfAbsent(courseId, k -> new LinkedHashSet<>()).add(userId);
            enrollmentCountByCourse.merge(courseId, 1L, Long::sum);

            // Phòng ban chính (phòng ban đầu tiên theo id) để gắn cho dòng.
            // Thời gian học được tính cho MỌI phòng ban mà học viên thuộc về,
            // nhưng phòng ban chính là nơi hiển thị trên dòng.
            List<DepartmentRef> userDepartments = departmentsByUser.getOrDefault(userId, List.of());
            DepartmentRef primaryDepartment = userDepartments.isEmpty() ? null : userDepartments.get(0);

            for (DepartmentRef dept : userDepartments) {
                hoursByDepartment.merge(dept.id(), enrollmentHours, Double::sum);
                learnersByDepartment.computeIfAbsent(dept.id(), k -> new LinkedHashSet<>()).add(userId);
                enrollmentCountByDepartment.merge(dept.id(), 1L, Long::sum);
            }

            if (primaryDepartment == null) {
                unassignedEnrollments++;
                unassignedHours += enrollmentHours;
            }

            drafts.add(new RowDraft(enrollmentId, userId, studentName, studentEmail,
                    primaryDepartment == null ? null : primaryDepartment.name(),
                    courseId, courseName, enrolledAt, lastAccessedAt,
                    completedLessons, totalLessons, enrollmentHours, userDepartments));
        }

        // Tổng giờ của một học viên (dùng cho cột "Student hours").
        Map<Long, Double> studentTotalHours = new HashMap<>(hoursByStudent);
        // Tổng giờ của một khóa học (dùng cho cột "Course hours").
        Map<Long, Double> courseTotalHours = new HashMap<>(hoursByCourse);
        // Tổng giờ của một phòng ban (dùng cho cột "Department hours").
        Map<Long, Double> departmentTotalHours = new HashMap<>(hoursByDepartment);

        // Dựng lại danh sách dòng với các tổng cấp đã tính.
        for (RowDraft draft : drafts) {
            double studentHours = round2(studentTotalHours.getOrDefault(draft.userId(), 0.0));
            double courseHours = round2(courseTotalHours.getOrDefault(draft.courseId(), 0.0));
            double departmentHours = 0;
            DepartmentRef primary = draft.primaryDepartment();
            if (primary != null) {
                departmentHours = round2(departmentTotalHours.getOrDefault(primary.id(), 0.0));
            }

            long daysSinceEnrollment = draft.enrolledAt() == null
                    ? 0
                    : Math.max(0, ChronoUnit.DAYS.between(draft.enrolledAt(), now));

            rows.add(new LearningHoursRowDTO(
                    draft.enrollmentId(), draft.userId(), draft.studentName(), draft.studentEmail(),
                    draft.departmentName(), draft.courseId(), draft.courseName(),
                    draft.enrolledAt(), draft.lastAccessedAt(),
                    draft.completedLessons(), draft.totalLessons(),
                    draft.totalLessons() == 0
                            ? 0
                            : round1(draft.completedLessons() * 100.0 / draft.totalLessons()),
                    draft.enrollmentHours(), studentHours, departmentHours, courseHours,
                    daysSinceEnrollment));
        }

        // --- Nhóm tổng hợp ---
        List<LearningHoursGroupDTO> departmentGroups = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : hoursByDepartment.entrySet()) {
            Long deptId = entry.getKey();
            long learners = learnersByDepartment.getOrDefault(deptId, Set.of()).size();
            departmentGroups.add(new LearningHoursGroupDTO(
                    deptId,
                    departmentCodes.getOrDefault(deptId, "Unassigned"),
                    null,
                    round2(entry.getValue()),
                    learners,
                    enrollmentCountByDepartment.getOrDefault(deptId, 0L),
                    learners == 0 ? 0 : round2(entry.getValue() / learners)));
        }
        // Học viên không thuộc phòng ban nào.
        if (unassignedEnrollments > 0) {
            long unassignedLearners = drafts.stream()
                    .filter(d -> d.primaryDepartment() == null)
                    .map(RowDraft::userId)
                    .distinct()
                    .count();
            departmentGroups.add(new LearningHoursGroupDTO(
                    null, "Unassigned", null,
                    round2(unassignedHours),
                    unassignedLearners,
                    unassignedEnrollments,
                    unassignedLearners == 0 ? 0 : round2(unassignedHours / unassignedLearners)));
        }
        departmentGroups.sort(Comparator.comparingDouble(LearningHoursGroupDTO::totalHours).reversed()
                .thenComparing(g -> g.name(), Comparator.nullsLast(String::compareToIgnoreCase)));

        List<LearningHoursGroupDTO> courseGroups = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : hoursByCourse.entrySet()) {
            Long courseId = entry.getKey();
            long learners = learnersByCourse.getOrDefault(courseId, Set.of()).size();
            courseGroups.add(new LearningHoursGroupDTO(
                    courseId,
                    drafts.stream()
                            .filter(d -> Objects.equals(d.courseId(), courseId))
                            .map(RowDraft::courseName)
                            .filter(Objects::nonNull)
                            .findFirst()
                            .orElse("Course " + courseId),
                    null,
                    round2(entry.getValue()),
                    learners,
                    enrollmentCountByCourse.getOrDefault(courseId, 0L),
                    learners == 0 ? 0 : round2(entry.getValue() / learners)));
        }
        courseGroups.sort(Comparator.comparingDouble(LearningHoursGroupDTO::totalHours).reversed()
                .thenComparing(g -> g.name(), Comparator.nullsLast(String::compareToIgnoreCase)));

        List<LearningHoursGroupDTO> studentGroups = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : hoursByStudent.entrySet()) {
            Long userId = entry.getKey();
            long courses = coursesByStudent.getOrDefault(userId, Set.of()).size();
            String label = studentNames.get(userId);
            if (label == null || label.isBlank()) {
                label = studentEmails.getOrDefault(userId, "Unknown learner");
            }
            studentGroups.add(new LearningHoursGroupDTO(
                    userId,
                    label,
                    studentEmails.get(userId),
                    round2(entry.getValue()),
                    1,
                    enrollmentCountByStudent.getOrDefault(userId, 0L),
                    round2(entry.getValue()),
                    courses));
        }
        studentGroups.sort(Comparator.comparingDouble(LearningHoursGroupDTO::totalHours).reversed()
                .thenComparing(g -> g.name(), Comparator.nullsLast(String::compareToIgnoreCase)));

        long studentCount = hoursByStudent.size();
        long courseCount = hoursByCourse.size();

        LearningHoursTotalsDTO totals = new LearningHoursTotalsDTO(
                round2(totalHours),
                rows.size(),
                studentCount,
                courseCount,
                departmentGroups.size(),
                studentCount == 0 ? 0 : round2(totalHours / studentCount),
                courseCount == 0 ? 0 : round2(totalHours / courseCount));

        return new LearningHoursReportDTO(rows, totals, departmentGroups, courseGroups, studentGroups);
    }

    /** Tham chiếu phòng ban của một học viên. */
    private record DepartmentRef(Long id, String name) {
    }

    /** Dòng dữ liệu thô trước khi gắn các tổng cấp. */
    private record RowDraft(
            Long enrollmentId,
            Long userId,
            String studentName,
            String studentEmail,
            String departmentName,
            Long courseId,
            String courseName,
            LocalDateTime enrolledAt,
            LocalDateTime lastAccessedAt,
            int completedLessons,
            int totalLessons,
            double enrollmentHours,
            List<DepartmentRef> departments
    ) {
        DepartmentRef primaryDepartment() {
            return departments.isEmpty() ? null : departments.get(0);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}

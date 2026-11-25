package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnrollmentAuditService {

    private static final String TYPE_ENROLLMENT = "ENROLLMENT";
    private static final String TYPE_DEPARTMENT = "DEPARTMENT";
    private static final String SOURCE_DEPARTMENT = "DEPARTMENT";

    private final CourseEnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final LessonRepository lessonRepository;
    private final LessonProgressRepository lessonProgressRepository;

    /** Một dòng log + dữ liệu phụ (không trả ra API) dùng để lọc / thống kê. */
    private record Entry(
            AuditLogRowDTO row,
            Set<Long> departmentIds,
            Set<Long> studentIds,
            String searchText
    ) {
    }

    // ------------------------------------------------------------------ public API

    public Page<AuditLogRowDTO> getAuditLogs(AuditLogFilterDTO filter, Pageable pageable) {
        List<AuditLogRowDTO> allLogs = filterEntries(filter).stream()
                .map(Entry::row)
                .sorted(Comparator.comparing(
                        AuditLogRowDTO::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toCollection(ArrayList::new));

        return paginate(allLogs, pageable);
    }

    /** Thống kê trên đúng tập log đang được lọc (số department, số học viên, số khóa học). */
    public AuditSummaryDTO getSummary(AuditLogFilterDTO filter) {
        List<Entry> entries = filterEntries(filter);
        Set<Long> departments = new HashSet<>();
        Set<Long> students = new HashSet<>();
        Set<Long> courses = new HashSet<>();
        for (Entry entry : entries) {
            departments.addAll(entry.departmentIds());
            students.addAll(entry.studentIds());
            if (entry.row().getCourseId() != null) {
                courses.add(entry.row().getCourseId());
            }
        }
        return new AuditSummaryDTO(entries.size(), departments.size(), students.size(), courses.size());
    }

    /** Danh sách department / course thực sự xuất hiện trong log, dùng cho dropdown lọc. */
    public AuditFilterOptionsDTO getFilterOptions() {
        Map<Long, String> departments = new TreeMap<>();
        Map<Long, String> courses = new TreeMap<>();
        for (CourseEnrollment e : enrollmentRepository.findAllForAudit()) {
            if (e.getCourse() != null) {
                courses.put(e.getCourse().getId(), e.getCourse().getName());
            }
            if (e.getDepartment() != null) {
                departments.put(e.getDepartment().getId(), e.getDepartment().getName());
            } else if (e.getUser() != null && e.getUser().getDepartments() != null) {
                for (Department d : e.getUser().getDepartments()) {
                    departments.put(d.getId(), d.getName());
                }
            }
        }
        Comparator<AuditFilterOptionsDTO.Option> byName =
                Comparator.comparing(o -> o.name() == null ? "" : o.name().toLowerCase());
        return new AuditFilterOptionsDTO(
                departments.entrySet().stream()
                        .map(en -> new AuditFilterOptionsDTO.Option(en.getKey(), en.getValue()))
                        .sorted(byName).toList(),
                courses.entrySet().stream()
                        .map(en -> new AuditFilterOptionsDTO.Option(en.getKey(), en.getValue()))
                        .sorted(byName).toList());
    }

    /** Học viên của một lần assign department -> course (có tìm kiếm + phân trang). */
    public Page<DepartmentLogStudentDTO> getDepartmentLogStudents(
            Long departmentId, Long courseId, String search, Pageable pageable
    ) {
        List<CourseEnrollment> enrollments =
                enrollmentRepository.findAllByDepartmentAndCourse(departmentId, courseId);
        if (enrollments.isEmpty()) {
            throw new ResourceNotFoundException("Department log not found");
        }

        String kw = search == null ? "" : search.trim().toLowerCase();
        List<CourseEnrollment> matched = enrollments.stream()
                .filter(e -> kw.isEmpty()
                        || containsIgnoreCase(displayName(e.getUser()), kw)
                        || containsIgnoreCase(e.getUser().getEmail(), kw))
                .sorted(Comparator.comparing(e -> displayName(e.getUser()).toLowerCase()))
                .toList();

        int total = matched.size();
        int from = pageable.isUnpaged() ? 0 : (int) Math.min(pageable.getOffset(), total);
        int to = pageable.isUnpaged() ? total : Math.min(from + pageable.getPageSize(), total);

        int totalLessons = lessonRepository.findActiveByCourseIdOrdered(courseId).size();
        List<DepartmentLogStudentDTO> content = new ArrayList<>();
        for (CourseEnrollment e : matched.subList(from, to)) {
            long completed = lessonProgressRepository.findAllByEnrollment_Id(e.getId()).stream()
                    .filter(progress -> progress.isCompleted())
                    .count();
            int progress = totalLessons == 0 ? 0 : (int) Math.round(completed * 100.0 / totalLessons);
            content.add(new DepartmentLogStudentDTO(
                    e.getUser().getId(),
                    displayName(e.getUser()),
                    e.getUser().getEmail(),
                    Boolean.FALSE.equals(e.getIsActive()) ? "DROPPED" : "ACTIVE",
                    progress,
                    e.getCreatedAt()));
        }
        return new PageImpl<>(content, pageable, total);
    }

    // ------------------------------------------------------------------ build entries

    private List<Entry> buildEntries() {
        List<CourseEnrollment> enrollments = enrollmentRepository.findAllForAudit();

        Set<Long> actorIds = enrollments.stream()
                .map(CourseEnrollment::getCreatedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> actorMap = actorIds.isEmpty()
                ? Collections.emptyMap()
                : userRepository.findAllById(actorIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        List<Entry> entries = new ArrayList<>();
        Map<String, List<CourseEnrollment>> departmentGroups = new LinkedHashMap<>();

        for (CourseEnrollment e : enrollments) {
            if (e.getDepartment() != null && e.getCourse() != null) {
                departmentGroups
                        .computeIfAbsent(e.getDepartment().getId() + ":" + e.getCourse().getId(),
                                k -> new ArrayList<>())
                        .add(e);
            } else {
                entries.add(buildStudentEntry(e, actorMap));
            }
        }
        for (List<CourseEnrollment> group : departmentGroups.values()) {
            entries.add(buildDepartmentEntry(group, actorMap));
        }
        return entries;
    }

    private Entry buildStudentEntry(CourseEnrollment e, Map<Long, User> actorMap) {
        User student = e.getUser();
        Course course = e.getCourse();
        Long createdBy = e.getCreatedBy();

        Set<Long> departmentIds = new HashSet<>();
        String deptName = "-";
        if (student != null && student.getDepartments() != null && !student.getDepartments().isEmpty()) {
            student.getDepartments().forEach(d -> departmentIds.add(d.getId()));
            deptName = student.getDepartments().stream()
                    .map(Department::getName)
                    .filter(Objects::nonNull)
                    .collect(Collectors.joining(", "));
            if (deptName.isBlank()) {
                deptName = "-";
            }
        }

        String[] actor = resolveActor(createdBy, actorMap);
        String actorName = actor[0];
        String actorEmail = actor[1];

        String source;
        if (createdBy != null && student != null && createdBy.equals(student.getId())) {
            source = "SELF_ENROLLED";
        } else if (createdBy != null) {
            source = "MANUAL";
        } else {
            source = "API";
        }

        String targetName = student != null ? displayName(student) : "Unknown Student";
        String courseName = (course != null && course.getName() != null) ? course.getName() : "-";
        String status = Boolean.FALSE.equals(e.getIsActive()) ? "DROPPED" : "ACTIVE";

        Integer progressPercentage = null;
        String cancellationReason = null;
        if ("DROPPED".equals(status) && course != null) {
            int totalLessons = lessonRepository.findActiveByCourseIdOrdered(course.getId()).size();
            long completedLessons = lessonProgressRepository.findAllByEnrollment_Id(e.getId()).stream()
                    .filter(progress -> progress.isCompleted())
                    .count();
            progressPercentage = totalLessons == 0
                    ? 0
                    : (int) Math.round(completedLessons * 100.0 / totalLessons);
            cancellationReason = "Student requested cancellation within the allowed progress limit";
        }

        String detail = "SELF_ENROLLED".equals(source)
                ? String.format("Student %s self-enrolled into course \"%s\"", targetName, courseName)
                : String.format("Enrolled %s into course \"%s\" by %s", targetName, courseName, actorName);

        AuditLogRowDTO row = AuditLogRowDTO.builder()
                .id("ENR-" + e.getId())
                .type(TYPE_ENROLLMENT)
                .actorName(actorName)
                .actorEmail(actorEmail)
                .targetName(targetName)
                .targetType("STUDENT")
                .courseId(course != null ? course.getId() : null)
                .courseName(courseName)
                .departmentName(deptName)
                .studentCount(1L)
                .detail(detail)
                .status(status)
                .source(source)
                .progressPercentage(progressPercentage)
                .cancellationReason(cancellationReason)
                .createdAt("DROPPED".equals(status) ? e.getUpdatedAt() : e.getCreatedAt())
                .build();

        Set<Long> studentIds = student != null ? Set.of(student.getId()) : Set.of();
        String searchText = String.join(" ",
                nullToEmpty(targetName), nullToEmpty(courseName), nullToEmpty(deptName),
                nullToEmpty(actorName), nullToEmpty(actorEmail), row.getId(), nullToEmpty(detail),
                student != null ? nullToEmpty(student.getEmail()) : "").toLowerCase();
        return new Entry(row, departmentIds, studentIds, searchText);
    }

    private Entry buildDepartmentEntry(List<CourseEnrollment> group, Map<Long, User> actorMap) {
        CourseEnrollment first = group.get(0);
        Department department = first.getDepartment();
        Course course = first.getCourse();

        long active = group.stream().filter(e -> !Boolean.FALSE.equals(e.getIsActive())).count();
        LocalDateTime latest = group.stream()
                .map(CourseEnrollment::getCreatedAt)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        // Người thực hiện = người assign đầu tiên của nhóm
        Long createdBy = group.stream()
                .filter(e -> e.getCreatedBy() != null)
                .min(Comparator.comparing(CourseEnrollment::getCreatedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(CourseEnrollment::getCreatedBy)
                .orElse(null);
        String[] actor = resolveActor(createdBy, actorMap);

        String deptName = department.getName() != null ? department.getName() : "-";
        String courseName = course.getName() != null ? course.getName() : "-";
        long count = group.size();

        AuditLogRowDTO row = AuditLogRowDTO.builder()
                .id("DEP-" + department.getId() + "-" + course.getId())
                .type(TYPE_DEPARTMENT)
                .actorName(actor[0])
                .actorEmail(actor[1])
                .targetName(deptName)
                .targetType("DEPARTMENT")
                .departmentId(department.getId())
                .departmentName(deptName)
                .courseId(course.getId())
                .courseName(courseName)
                .studentCount(count)
                .detail(String.format("Assigned department \"%s\" (%d student%s) to course \"%s\"",
                        deptName, count, count == 1 ? "" : "s", courseName))
                .status(active > 0 ? "ACTIVE" : "DROPPED")
                .source(SOURCE_DEPARTMENT)
                .createdAt(latest)
                .build();

        Set<Long> studentIds = group.stream().map(e -> e.getUser().getId()).collect(Collectors.toSet());
        StringBuilder search = new StringBuilder(String.join(" ",
                deptName, courseName, nullToEmpty(actor[0]), nullToEmpty(actor[1]), row.getId(), row.getDetail()));
        for (CourseEnrollment e : group) {
            search.append(' ').append(displayName(e.getUser())).append(' ')
                    .append(nullToEmpty(e.getUser().getEmail()));
        }
        return new Entry(row, Set.of(department.getId()), studentIds, search.toString().toLowerCase());
    }

    // ------------------------------------------------------------------ filtering

    private List<Entry> filterEntries(AuditLogFilterDTO filter) {
        final AuditLogFilterDTO f = filter != null ? filter : new AuditLogFilterDTO();
        final String type = f.getType();
        final String status = f.getStatus();
        final String source = f.getSource();
        final String kw = f.getSearch() != null ? f.getSearch().trim().toLowerCase() : "";
        final LocalDate from = f.getFromDate();
        final LocalDate to = f.getToDate();

        return buildEntries().stream()
                .filter(en -> isSet(type) ? type.equalsIgnoreCase(en.row().getType()) : true)
                .filter(en -> isSet(status) ? status.equalsIgnoreCase(en.row().getStatus()) : true)
                .filter(en -> isSet(source) ? source.equalsIgnoreCase(en.row().getSource()) : true)
                .filter(en -> f.getDepartmentId() == null || en.departmentIds().contains(f.getDepartmentId()))
                .filter(en -> f.getCourseId() == null || f.getCourseId().equals(en.row().getCourseId()))
                .filter(en -> kw.isEmpty() || en.searchText().contains(kw))
                .filter(en -> from == null || (en.row().getCreatedAt() != null
                        && !en.row().getCreatedAt().toLocalDate().isBefore(from)))
                .filter(en -> to == null || (en.row().getCreatedAt() != null
                        && !en.row().getCreatedAt().toLocalDate().isAfter(to)))
                .collect(Collectors.toList());
    }

    // ------------------------------------------------------------------ helpers

    private Page<AuditLogRowDTO> paginate(List<AuditLogRowDTO> all, Pageable pageable) {
        if (pageable == null || pageable.isUnpaged()) {
            return new PageImpl<>(all, pageable != null ? pageable : Pageable.unpaged(), all.size());
        }
        int total = all.size();
        int start = (int) pageable.getOffset();
        List<AuditLogRowDTO> content = start >= total
                ? Collections.emptyList()
                : all.subList(start, Math.min(start + pageable.getPageSize(), total));
        return new PageImpl<>(content, pageable, total);
    }

    private String[] resolveActor(Long createdBy, Map<Long, User> actorMap) {
        String actorName = "System";
        String actorEmail = null;
        if (createdBy != null) {
            User actor = actorMap.get(createdBy);
            if (actor != null) {
                actorName = displayName(actor);
                actorEmail = actor.getEmail();
            } else {
                actorName = "User #" + createdBy;
            }
        }
        return new String[]{actorName, actorEmail};
    }

    private String displayName(User user) {
        String fullName = user.getFullName();
        if (fullName != null && !fullName.isBlank()) {
            return fullName;
        }
        return user.getEmail() != null ? user.getEmail() : "User #" + user.getId();
    }

    private boolean isSet(String value) {
        return value != null && !value.isBlank() && !"ALL".equalsIgnoreCase(value);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private boolean containsIgnoreCase(String source, String keyword) {
        return source != null && source.toLowerCase().contains(keyword);
    }
}

package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnrollmentAuditService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final UserRepository userRepository;
    private final LessonRepository lessonRepository;
    private final LessonProgressRepository lessonProgressRepository;

    public Page<AuditLogRowDTO> getAuditLogs(AuditLogFilterDTO filter, Pageable pageable) {
        final AuditLogFilterDTO searchFilter = filter != null ? filter : new AuditLogFilterDTO();

        List<CourseEnrollment> enrollments = enrollmentRepository.findAll();

        // Tối ưu hóa: Lấy danh sách actor (người thực hiện) trong 1 query để tránh N+1
        Set<Long> actorIds = enrollments.stream()
                .map(CourseEnrollment::getCreatedBy)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<Long, User> actorMap = actorIds.isEmpty()
                ? Collections.emptyMap()
                : userRepository.findAllById(actorIds).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));

        List<AuditLogRowDTO> allLogs = new ArrayList<>(enrollments.size());

        for (CourseEnrollment e : enrollments) {
            User student = e.getUser();
            Course course = e.getCourse();
            Long createdBy = e.getCreatedBy();

            // 1. Tên phòng ban / khoa của sinh viên
            String deptName = "-";
            if (student != null && student.getDepartments() != null && !student.getDepartments().isEmpty()) {
                deptName = student.getDepartments().stream()
                        .map(Department::getName)
                        .filter(Objects::nonNull)
                        .collect(Collectors.joining(", "));
                if (deptName.isBlank()) {
                    deptName = "-";
                }
            }

            // 2. Thông tin người thực hiện thao tác (Actor)
            String actorName = "System";
            String actorEmail = null;
            if (createdBy != null) {
                User actor = actorMap.get(createdBy);
                if (actor != null) {
                    String fullName = actor.getFullName();
                    actorName = (fullName != null && !fullName.isBlank())
                            ? fullName
                            : (actor.getEmail() != null ? actor.getEmail() : "User #" + actor.getId());
                    actorEmail = actor.getEmail();
                } else {
                    actorName = "User #" + createdBy;
                }
            }

            // 3. Phân loại nguồn ghi danh (Source)
            String source;
            if (createdBy != null && student != null && createdBy.equals(student.getId())) {
                source = "SELF_ENROLLED";
            } else if (student != null && student.getDepartments() != null && !student.getDepartments().isEmpty()) {
                source = "BATCH_IMPORT";
            } else if (createdBy != null) {
                source = "MANUAL";
            } else {
                source = "API";
            }

            // 4. Phân loại ngữ cảnh Type (ENROLLMENT hoặc DEPARTMENT)
            String type = "BATCH_IMPORT".equalsIgnoreCase(source) ? "DEPARTMENT" : "ENROLLMENT";

            // 5. Đối tượng thụ hưởng (Target)
            String targetName = "Unknown Student";
            if (student != null) {
                String fullName = student.getFullName();
                targetName = (fullName != null && !fullName.isBlank())
                        ? fullName
                        : (student.getEmail() != null ? student.getEmail() : "User #" + student.getId());
            }
            String targetType = "STUDENT";

            // 6. Tên khóa học
            String courseName = (course != null && course.getName() != null) ? course.getName() : "-";

            // 7. Trạng thái bản ghi (Status)
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

            // 8. Mô tả chi tiết hành động (Detail)
            String detail;
            if ("DEPARTMENT".equals(type)) {
                detail = String.format("Assigned %s to course \"%s\" via department (%s)",
                        targetName, courseName, deptName);
            } else if ("SELF_ENROLLED".equals(source)) {
                detail = String.format("Student %s self-enrolled into course \"%s\"",
                        targetName, courseName);
            } else {
                detail = String.format("Enrolled %s into course \"%s\" by %s",
                        targetName, courseName, actorName);
            }

            allLogs.add(AuditLogRowDTO.builder()
                    .id("ENR-" + e.getId())
                    .type(type)
                    .actorName(actorName)
                    .actorEmail(actorEmail)
                    .targetName(targetName)
                    .targetType(targetType)
                    .courseName(courseName)
                    .departmentName(deptName)
                    .detail(detail)
                    .status(status)
                    .source(source)
                    .progressPercentage(progressPercentage)
                    .cancellationReason(cancellationReason)
                    .createdAt("DROPPED".equals(status) ? e.getUpdatedAt() : e.getCreatedAt())
                    .build());
        }

        // 1. Lọc theo Type (ENROLLMENT / DEPARTMENT)
        String filterType = searchFilter.getType();
        if (filterType != null && !filterType.isBlank() && !"ALL".equalsIgnoreCase(filterType)) {
            allLogs = allLogs.stream()
                    .filter(l -> filterType.equalsIgnoreCase(l.getType()))
                    .collect(Collectors.toList());
        }

        // 2. Lọc theo Search keyword
        String search = searchFilter.getSearch();
        if (search != null && !search.isBlank()) {
            String kw = search.trim().toLowerCase();
            allLogs = allLogs.stream()
                    .filter(l -> containsIgnoreCase(l.getTargetName(), kw)
                            || containsIgnoreCase(l.getCourseName(), kw)
                            || containsIgnoreCase(l.getDepartmentName(), kw)
                            || containsIgnoreCase(l.getActorName(), kw)
                            || containsIgnoreCase(l.getActorEmail(), kw)
                            || containsIgnoreCase(l.getId(), kw)
                            || containsIgnoreCase(l.getDetail(), kw))
                    .collect(Collectors.toList());
        }

        // 3. Lọc theo Status
        String filterStatus = searchFilter.getStatus();
        if (filterStatus != null && !filterStatus.isBlank() && !"ALL".equalsIgnoreCase(filterStatus)) {
            allLogs = allLogs.stream()
                    .filter(l -> filterStatus.equalsIgnoreCase(l.getStatus()))
                    .collect(Collectors.toList());
        }

        // 4. Lọc theo Source
        String filterSource = searchFilter.getSource();
        if (filterSource != null && !filterSource.isBlank() && !"ALL".equalsIgnoreCase(filterSource)) {
            allLogs = allLogs.stream()
                    .filter(l -> filterSource.equalsIgnoreCase(l.getSource()))
                    .collect(Collectors.toList());
        }

        // 5. Lọc theo From Date
        LocalDate fromDate = searchFilter.getFromDate();
        if (fromDate != null) {
            allLogs = allLogs.stream()
                    .filter(l -> l.getCreatedAt() != null && !l.getCreatedAt().toLocalDate().isBefore(fromDate))
                    .collect(Collectors.toList());
        }

        // 6. Lọc theo To Date
        LocalDate toDate = searchFilter.getToDate();
        if (toDate != null) {
            allLogs = allLogs.stream()
                    .filter(l -> l.getCreatedAt() != null && !l.getCreatedAt().toLocalDate().isAfter(toDate))
                    .collect(Collectors.toList());
        }

        // 7. Sắp xếp thời gian mới nhất lên đầu (nulls last)
        allLogs.sort(Comparator.comparing(
                AuditLogRowDTO::getCreatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));

        // 8. Phân trang
        if (pageable == null || pageable.isUnpaged()) {
            return new PageImpl<>(allLogs, pageable != null ? pageable : Pageable.unpaged(), allLogs.size());
        }

        int totalElements = allLogs.size();
        int start = (int) pageable.getOffset();
        List<AuditLogRowDTO> pageContent;

        if (start >= totalElements) {
            pageContent = Collections.emptyList();
        } else {
            int end = Math.min(start + pageable.getPageSize(), totalElements);
            pageContent = allLogs.subList(start, end);
        }

        return new PageImpl<>(pageContent, pageable, totalElements);
    }

    private boolean containsIgnoreCase(String source, String keyword) {
        return source != null && source.toLowerCase().contains(keyword);
    }
}

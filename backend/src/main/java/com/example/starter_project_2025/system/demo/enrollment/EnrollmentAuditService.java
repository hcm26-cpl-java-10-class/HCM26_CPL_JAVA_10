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

        // Tá»‘i Æ°u hÃ³a: Láº¥y danh sÃ¡ch actor (ngÆ°á»i thá»±c hiá»‡n) trong 1 query Ä‘á»ƒ trÃ¡nh N+1
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

            // 1. TÃªn phÃ²ng ban / khoa cá»§a sinh viÃªn
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

            // 2. ThÃ´ng tin ngÆ°á»i thá»±c hiá»‡n thao tÃ¡c (Actor)
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

            // 3. PhÃ¢n loáº¡i nguá»“n ghi danh (Source)
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

            // 4. PhÃ¢n loáº¡i ngá»¯ cáº£nh Type (ENROLLMENT hoáº·c DEPARTMENT)
            String type = "BATCH_IMPORT".equalsIgnoreCase(source) ? "DEPARTMENT" : "ENROLLMENT";

            // 5. Äá»‘i tÆ°á»£ng thá»¥ hÆ°á»Ÿng (Target)
            String targetName = "Unknown Student";
            if (student != null) {
                String fullName = student.getFullName();
                targetName = (fullName != null && !fullName.isBlank())
                        ? fullName
                        : (student.getEmail() != null ? student.getEmail() : "User #" + student.getId());
            }
            String targetType = "STUDENT";

            // 6. TÃªn khÃ³a há»c
            String courseName = (course != null && course.getName() != null) ? course.getName() : "-";

            // 7. Tráº¡ng thÃ¡i báº£n ghi (Status)
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

            // 8. MÃ´ táº£ chi tiáº¿t hÃ nh Ä‘á»™ng (Detail)
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

        // 1. Lá»c theo Type (ENROLLMENT / DEPARTMENT)
        String filterType = searchFilter.getType();
        if (filterType != null && !filterType.isBlank() && !"ALL".equalsIgnoreCase(filterType)) {
            allLogs = allLogs.stream()
                    .filter(l -> filterType.equalsIgnoreCase(l.getType()))
                    .collect(Collectors.toList());
        }

        // 2. Lá»c theo Search keyword
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

        // 3. Lá»c theo Status
        String filterStatus = searchFilter.getStatus();
        if (filterStatus != null && !filterStatus.isBlank() && !"ALL".equalsIgnoreCase(filterStatus)) {
            allLogs = allLogs.stream()
                    .filter(l -> filterStatus.equalsIgnoreCase(l.getStatus()))
                    .collect(Collectors.toList());
        }

        // 4. Lá»c theo Source
        String filterSource = searchFilter.getSource();
        if (filterSource != null && !filterSource.isBlank() && !"ALL".equalsIgnoreCase(filterSource)) {
            allLogs = allLogs.stream()
                    .filter(l -> filterSource.equalsIgnoreCase(l.getSource()))
                    .collect(Collectors.toList());
        }

        // 5. Lá»c theo From Date
        LocalDate fromDate = searchFilter.getFromDate();
        if (fromDate != null) {
            allLogs = allLogs.stream()
                    .filter(l -> l.getCreatedAt() != null && !l.getCreatedAt().toLocalDate().isBefore(fromDate))
                    .collect(Collectors.toList());
        }

        // 6. Lá»c theo To Date
        LocalDate toDate = searchFilter.getToDate();
        if (toDate != null) {
            allLogs = allLogs.stream()
                    .filter(l -> l.getCreatedAt() != null && !l.getCreatedAt().toLocalDate().isAfter(toDate))
                    .collect(Collectors.toList());
        }

        // 7. Sáº¯p xáº¿p thá»i gian má»›i nháº¥t lÃªn Ä‘áº§u (nulls last)
        allLogs.sort(Comparator.comparing(
                AuditLogRowDTO::getCreatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));

        // 8. PhÃ¢n trang
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

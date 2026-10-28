package com.example.starter_project_2025.system.learning;

import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LearningRecordsService {
    private final CourseEnrollmentService enrollments;
    private final UserRepository users;

    // No completion, certificate or activity ledger exists yet. Null means unavailable.
    public record Records(List<CourseEnrollmentDTO> enrolledCourses, Integer inProgressCourses,
            Integer completedCourses, Double overallProgress, List<String> certificates,
            List<String> learningActivity) {}

    @Transactional(readOnly = true)
    public Records forUser(Long userId) {
        if (userId == null || userId <= 0 || !users.existsById(userId)) {
            throw new ResourceNotFoundException("User not found");
        }
        var courses = enrollments.getMyCourses(userId).stream().map(e -> CourseEnrollmentDTO.builder()
                .id(e.getId()).courseId(e.getCourse().getId()).courseName(e.getCourse().getName())
                .thumbnailUrl(e.getCourse().getThumbnailUrl()).instructor(e.getCourse().getInstructor())
                .enrolledAt(e.getCreatedAt()).build()).toList();
        return new Records(courses, null, null, null, null, null);
    }
}

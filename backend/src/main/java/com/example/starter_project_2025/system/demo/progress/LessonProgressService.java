package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LessonProgressService {

    private final LessonProgressRepository progressRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    @Transactional(readOnly = true)
    public List<LessonProgressDTO> getProgress(Long userId, Long enrollmentId) {
        requireOwnedEnrollment(userId, enrollmentId);

        return progressRepository.findAllByEnrollment_IdOrderByLessonIdAsc(enrollmentId)
                .stream()
                .map(LessonProgressDTO::from)
                .toList();
    }

    @Transactional
    public LessonProgressDTO setCompleted(
            Long userId,
            Long enrollmentId,
            Long lessonId,
            boolean completed
    ) {
        CourseEnrollment enrollment = requireOwnedEnrollment(userId, enrollmentId);
        LocalDateTime now = LocalDateTime.now();

        LessonProgress progress = progressRepository
                .findByEnrollment_IdAndLessonId(enrollmentId, lessonId)
                .orElseGet(() -> LessonProgress.builder()
                        .enrollment(enrollment)
                        .lessonId(lessonId)
                        .build());

        progress.setCompleted(completed);
        progress.setCompletedAt(completed ? now : null);
        progress.setLastAccessedAt(now);

        return LessonProgressDTO.from(progressRepository.save(progress));
    }

    private CourseEnrollment requireOwnedEnrollment(Long userId, Long enrollmentId) {
        return enrollmentRepository.findByIdAndUser_Id(enrollmentId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found"));
    }
}

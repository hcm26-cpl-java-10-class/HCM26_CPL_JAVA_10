package com.example.starter_project_2025.system.exam.result.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.result.dto.ExamResultPublicationDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.exam.result.service.ExamResultEmailDispatcher;

import java.time.LocalDateTime;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.result.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.result.domain.ExamResultPublicationRepository;
import com.example.starter_project_2025.system.exam.result.domain.ScoreReleasePolicy;

@Service
@RequiredArgsConstructor
public class ExamResultPublicationService {

    private final ExamRepository examRepository;
    private final ExamResultPublicationRepository publicationRepository;
    private final ExamResultEmailDispatcher emailDispatcher;
    private final ExamResultReadinessService readinessService;
    private final com.example.starter_project_2025.system.demo.course.CourseAssessmentCompletionService completion;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.starter_project_2025.system.notification.NotificationService notificationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository attemptRepository;

    @Transactional(readOnly = true)
    public ExamResultPublicationDTO getStatus(Long examId) {
        requireExam(examId);

        return publicationRepository.findByExam_Id(examId)
                .map(this::toDTO)
                .orElseGet(() -> createDefaultDTO(examId));
    }

    @Transactional
    public ExamResultPublicationDTO publish(
            Long examId,
            ScoreReleasePolicy policy
    ) {
        if (policy == null) {
            throw new BadRequestException("Release policy is required");
        }

        Exam exam = requireExam(examId);
        Long userId = requireAuthorizedUser();
        readinessService.assertReadyToPublish(examId);

        ExamResultPublication publication = publicationRepository
                .findByExam_Id(examId)
                .orElseGet(() -> {
                    ExamResultPublication created =
                            new ExamResultPublication();
                    created.setExam(exam);
                    created.setReleasePolicy(policy);
                    created.setPublished(false);
                    return created;
                });

        boolean wasPublished = publication.isPublished();

        publication.setReleasePolicy(policy);

        if (!wasPublished) {
            publication.setPublished(true);
            publication.setPublishedAt(LocalDateTime.now());
            publication.setPublishedBy(userId);
        }

        publicationRepository.save(publication);

        if (!wasPublished
                && policy == ScoreReleasePolicy.MY_SCORES_AND_EMAIL) {
            emailDispatcher.dispatch(exam);
        }

        if (!wasPublished && policy != ScoreReleasePolicy.HIDDEN
                && notificationService != null && attemptRepository != null) {
            attemptRepository.findAllByExam_Id(exam.getId()).stream()
                    .map(com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt::getStudent)
                    .filter(student -> student != null && student.getId() != null)
                    .map(com.example.starter_project_2025.system.rbac.user.User::getId)
                    .distinct()
                    .forEach(studentId -> notificationService.createOnce(
                            studentId,
                            "exam.result.published." + exam.getId() + ".u" + studentId,
                            "Exam results published",
                            "Results for \"" + exam.getTitle() + "\" have been published.",
                            "/student/exams/" + exam.getId()
                    ));
        }

        if (exam.getCourse()!=null) completion.refreshCourse(exam.getCourse().getId());
        return toDTO(publication);
    }

    @Transactional
    public ExamResultPublicationDTO unpublish(Long examId) {
        requireExam(examId);
        Long userId = requireAuthorizedUser();

        ExamResultPublication publication = publicationRepository
                .findByExam_Id(examId)
                .orElseThrow(() ->
                        new BadRequestException(
                                "Exam results have not been published"
                        )
                );

        if (publication.isPublished()) {
            publication.setPublished(false);
            publication.setUnpublishedAt(LocalDateTime.now());
            publication.setUnpublishedBy(userId);
        }

        publicationRepository.save(publication);

        return toDTO(publication);
    }

    private Exam requireExam(Long examId) {
        return examRepository.findById(examId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Exam not found")
                );
    }

    private Long requireAuthorizedUser() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal()
                instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Unauthorized");
        }

        boolean allowed = authentication.getAuthorities()
                .stream()
                .anyMatch(authority ->
                        authority.getAuthority().equals("EXAM_UPDATE"));

        if (!allowed) {
            throw new AccessDeniedException(
                    "You do not have permission to publish exam results"
            );
        }

        return principal.getUser().getId();
    }

    private ExamResultPublicationDTO createDefaultDTO(Long examId) {
        ExamResultPublicationDTO dto =
                new ExamResultPublicationDTO();

        dto.setExamId(examId);
        dto.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_ONLY);
        dto.setPublished(false);

        return dto;
    }

    private ExamResultPublicationDTO toDTO(
            ExamResultPublication publication
    ) {
        ExamResultPublicationDTO dto =
                new ExamResultPublicationDTO();

        dto.setExamId(publication.getExam().getId());
        dto.setReleasePolicy(publication.getReleasePolicy());
        dto.setPublished(publication.isPublished());
        dto.setPublishedAt(publication.getPublishedAt());
        dto.setPublishedBy(publication.getPublishedBy());
        dto.setUnpublishedAt(publication.getUnpublishedAt());
        dto.setUnpublishedBy(publication.getUnpublishedBy());

        return dto;
    }
}

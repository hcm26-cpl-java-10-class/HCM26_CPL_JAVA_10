package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.ExamResultPublicationDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.exam.service.ExamResultEmailDispatcher;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ExamResultPublicationService {

    private final ExamRepository examRepository;
    private final ExamResultPublicationRepository publicationRepository;
    private final ExamResultEmailDispatcher emailDispatcher;
    private final ExamResultReadinessService readinessService;

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

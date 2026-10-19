package com.example.starter_project_2025.system.invitation.mapper;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class InvitationMapper implements BaseCrudMapper<Invitation, InvitationDTO> {

    private final ExamRepository examRepository;
    private final UserRepository userRepository;

    @Override
    public Invitation toEntity(InvitationDTO dto) {
        Invitation invitation = new Invitation();
        invitation.setIsActive(dto.getIsActive() == null ? Boolean.TRUE : dto.getIsActive());

        if (dto.getExamId() != null) {
            examRepository.findById(dto.getExamId()).ifPresent(invitation::setExam);
        }
        if (dto.getUserId() != null) {
            userRepository.findById(dto.getUserId()).ifPresent(invitation::setUser);
        }

        invitation.setStatus(dto.getStatus() != null ? dto.getStatus() : InvitationStatus.PENDING);
        invitation.setSentAt(dto.getSentAt() != null ? dto.getSentAt() : LocalDateTime.now());
        invitation.setResendCount(dto.getResendCount() != null ? dto.getResendCount() : 0);
        invitation.setRevokedAt(dto.getRevokedAt());
        invitation.setRevokedReason(dto.getRevokedReason());
        invitation.setExpiresAt(dto.getExpiresAt());
        invitation.setNote(dto.getNote());

        return invitation;
    }

    @Override
    public InvitationDTO toResponse(Invitation entity) {
        InvitationDTO dto = new InvitationDTO();
        dto.setId(entity.getId());
        dto.setIsActive(entity.getIsActive());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        dto.setCreatedBy(entity.getCreatedBy());
        dto.setUpdatedBy(entity.getUpdatedBy());

        if (entity.getExam() != null) {
            dto.setExamId(entity.getExam().getId());
            dto.setExamTitle(entity.getExam().getTitle());
            dto.setDurationMinutes(entity.getExam().getDurationMinutes());
            dto.setStartTime(entity.getExam().getStartTime());
            dto.setEndTime(entity.getExam().getEndTime());
            dto.setMaxAttempts(entity.getExam().getMaxAttempts());
            dto.setTotalPoints(entity.getExam().getQuestions().stream()
                    .filter(question -> Boolean.TRUE.equals(question.getIsActive()))
                    .mapToInt(question -> question.getPoints())
                    .sum());
            dto.setHasPassword(entity.getExam().getAccessCode() != null && !entity.getExam().getAccessCode().trim().isEmpty());
        }

        if (entity.getUser() != null) {
            dto.setUserId(entity.getUser().getId());
            dto.setUserEmail(entity.getUser().getEmail());
            dto.setUserFullName(entity.getUser().getFullName());
        }

        dto.setStatus(entity.getStatus());
        dto.setSentAt(entity.getSentAt());
        dto.setResendCount(entity.getResendCount());
        dto.setRevokedAt(entity.getRevokedAt());
        dto.setRevokedReason(entity.getRevokedReason());
        dto.setExpiresAt(entity.getExpiresAt());
        dto.setNote(entity.getNote());

        return dto;
    }

    @Override
    public void update(Invitation entity, InvitationDTO dto) {
        if (dto.getIsActive() != null) {
            entity.setIsActive(dto.getIsActive());
        }
        if (dto.getNote() != null) {
            entity.setNote(dto.getNote());
        }
        if (dto.getExpiresAt() != null) {
            entity.setExpiresAt(dto.getExpiresAt());
        }
    }
}

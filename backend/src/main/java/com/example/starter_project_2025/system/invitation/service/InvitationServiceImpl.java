package com.example.starter_project_2025.system.invitation.service;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditService;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.invitation.dto.InvitationFilter;
import com.example.starter_project_2025.system.invitation.mapper.InvitationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional
public class InvitationServiceImpl
        extends BaseCrudServiceImpl<Invitation, Long, InvitationDTO, InvitationFilter>
        implements InvitationService {

    private final InvitationRepository repository;
    private final InvitationMapper mapper;
    private final InvitationValidator validator;
    private final InvitationAuditService auditService;

    @Override
    protected BaseCrudRepository<Invitation, Long> getRepository() {
        return repository;
    }

    @Override
    protected BaseCrudMapper<Invitation, InvitationDTO> getMapper() {
        return mapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"note", "revokedReason"};
    }

    @Override
    protected void beforeCreate(Invitation entity, InvitationDTO request, ValidationContext ctx) {
        validator.validateForCreate(request, ctx);
        entity.setStatus(InvitationStatus.PENDING);
        entity.setSentAt(LocalDateTime.now());
        entity.setResendCount(0);
    }

    @Override
    protected void afterCreate(Invitation entity, InvitationDTO request) {
        Long examId = entity.getExam() != null ? entity.getExam().getId() : null;
        Long userId = entity.getUser() != null ? entity.getUser().getId() : null;
        auditService.log(entity.getId(), examId, userId, "CREATE", "Tạo lời mời đơn lẻ");
    }

    @Override
    protected void beforeUpdate(Invitation entity, InvitationDTO request, ValidationContext ctx) {
        validator.validateForUpdate(entity, request, ctx);
    }

    @Override
    protected void afterUpdate(Invitation entity, InvitationDTO request) {
        Long examId = entity.getExam() != null ? entity.getExam().getId() : null;
        Long userId = entity.getUser() != null ? entity.getUser().getId() : null;
        auditService.log(entity.getId(), examId, userId, "UPDATE", "Cập nhật lời mời");
    }

    @Override
    protected void afterDelete(Invitation entity) {
        Long examId = entity.getExam() != null ? entity.getExam().getId() : null;
        Long userId = entity.getUser() != null ? entity.getUser().getId() : null;
        auditService.log(entity.getId(), examId, userId, "DELETE", "Xóa vật lý lời mời ID " + entity.getId());
    }
}

package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.notification.NotificationCategory;
import com.example.starter_project_2025.system.notification.audit.NotificationAuditService;
import com.example.starter_project_2025.system.notification.policy.TenantNotificationPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EmailTemplateService {

    private final EmailTemplateRepository templateRepository;
    private final EmailTemplateVersionRepository versionRepository;

    @Autowired(required = false)
    private NotificationAuditService auditService;

    @Transactional(readOnly = true)
    public Page<EmailTemplateDTO> search(
            Long tenantId,
            String keyword,
            NotificationCategory category,
            Boolean active,
            int page,
            int size
    ) {
        List<Long> visibleTenants = visibleTenantIds(tenantId);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                safeSize,
                Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by(Sort.Direction.ASC, "code"))
        );
        String cleanKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        return templateRepository.search(visibleTenants, category, active, cleanKeyword, pageable)
                .map(EmailTemplateDTO::from);
    }

    @Transactional(readOnly = true)
    public EmailTemplate getVisibleEntity(Long tenantId, Long id) {
        EmailTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Email template not found"));
        if (!visibleTenantIds(tenantId).contains(template.getTenantId())) {
            throw new ResourceNotFoundException("Email template not found");
        }
        return template;
    }

    @Transactional(readOnly = true)
    public EmailTemplateDTO getById(Long tenantId, Long id) {
        return EmailTemplateDTO.from(getVisibleEntity(tenantId, id));
    }

    @Transactional(readOnly = true)
    public List<EmailTemplateVersionDTO> listVersions(Long tenantId, Long templateId) {
        EmailTemplate template = getVisibleEntity(tenantId, templateId);
        return versionRepository.findByTemplateIdOrderByVersionDesc(template.getId()).stream()
                .map(EmailTemplateVersionDTO::from)
                .toList();
    }

    @Transactional
    public EmailTemplateDTO create(Long tenantId, Long actorId, String actorEmail, EmailTemplateUpsertRequest request) {
        validateRequest(request, true);
        long ownerTenant = normalizeTenantId(tenantId);
        String normalizedCode = request.code().trim().toUpperCase(Locale.ROOT);
        if (templateRepository.existsByTenantIdAndCodeIgnoreCase(ownerTenant, normalizedCode)) {
            throw new BadRequestException("Template code already exists: " + normalizedCode);
        }

        String sanitizedBody = EmailHtmlSanitizer.sanitizeHtml(request.bodyHtml());
        EmailTemplate saved = templateRepository.save(EmailTemplate.builder()
                .tenantId(ownerTenant)
                .code(normalizedCode)
                .name(request.name().trim())
                .category(request.category() == null ? NotificationCategory.SYSTEM : request.category())
                .description(trimOrNull(request.description()))
                .active(true)
                .currentVersion(1)
                .subjectTemplate(request.subjectTemplate().trim())
                .bodyHtml(sanitizedBody)
                .sampleVariablesJson(trimOrNull(request.sampleVariablesJson()))
                .systemSeeded(false)
                .updatedByUserId(actorId)
                .build());

        versionRepository.save(EmailTemplateVersion.builder()
                .templateId(saved.getId())
                .version(1)
                .subjectTemplate(saved.getSubjectTemplate())
                .bodyHtml(saved.getBodyHtml())
                .changeNote(trimOrNull(request.changeNote()) != null ? request.changeNote().trim() : "Initial version")
                .createdByUserId(actorId)
                .build());

        if (auditService != null) {
            auditService.record(ownerTenant, actorId, actorEmail, "EMAIL_TEMPLATE_CREATED",
                    "EmailTemplate", String.valueOf(saved.getId()), null,
                    "code=" + saved.getCode() + ",v=1");
        }
        return EmailTemplateDTO.from(saved);
    }

    @Transactional
    public EmailTemplateDTO update(
            Long tenantId,
            Long actorId,
            String actorEmail,
            Long id,
            EmailTemplateUpsertRequest request
    ) {
        validateRequest(request, false);
        EmailTemplate template = getVisibleEntity(tenantId, id);
        int previousVersion = template.getCurrentVersion();
        int nextVersion = previousVersion + 1;
        String sanitizedBody = EmailHtmlSanitizer.sanitizeHtml(request.bodyHtml());

        template.setName(request.name().trim());
        if (request.category() != null) {
            template.setCategory(request.category());
        }
        template.setDescription(trimOrNull(request.description()));
        template.setSubjectTemplate(request.subjectTemplate().trim());
        template.setBodyHtml(sanitizedBody);
        template.setSampleVariablesJson(trimOrNull(request.sampleVariablesJson()));
        template.setCurrentVersion(nextVersion);
        template.setUpdatedByUserId(actorId);
        EmailTemplate saved = templateRepository.save(template);

        versionRepository.save(EmailTemplateVersion.builder()
                .templateId(saved.getId())
                .version(nextVersion)
                .subjectTemplate(saved.getSubjectTemplate())
                .bodyHtml(saved.getBodyHtml())
                .changeNote(trimOrNull(request.changeNote()) != null ? request.changeNote().trim() : "Updated template")
                .createdByUserId(actorId)
                .build());

        if (auditService != null) {
            auditService.record(saved.getTenantId(), actorId, actorEmail, "EMAIL_TEMPLATE_UPDATED",
                    "EmailTemplate", String.valueOf(saved.getId()),
                    "v=" + previousVersion, "v=" + nextVersion);
        }
        return EmailTemplateDTO.from(saved);
    }

    @Transactional
    public EmailTemplateDTO updateStatus(Long tenantId, Long actorId, String actorEmail, Long id, boolean active) {
        EmailTemplate template = getVisibleEntity(tenantId, id);
        boolean previous = template.isActive();
        template.setActive(active);
        template.setUpdatedByUserId(actorId);
        EmailTemplate saved = templateRepository.save(template);

        if (auditService != null) {
            auditService.record(saved.getTenantId(), actorId, actorEmail, "EMAIL_TEMPLATE_STATUS_CHANGED",
                    "EmailTemplate", String.valueOf(saved.getId()),
                    "active=" + previous, "active=" + active);
        }
        return EmailTemplateDTO.from(saved);
    }

    @Transactional(readOnly = true)
    public EmailTemplateUpsertRequest.PreviewResponse preview(
            Long tenantId,
            EmailTemplateUpsertRequest.PreviewRequest request
    ) {
        if (request == null) {
            throw new BadRequestException("Preview request is required");
        }
        String subjectSource = request.subjectTemplate();
        String bodySource = request.bodyHtml();
        if (request.templateId() != null) {
            EmailTemplate template = getVisibleEntity(tenantId, request.templateId());
            if (subjectSource == null || subjectSource.isBlank()) {
                subjectSource = template.getSubjectTemplate();
            }
            if (bodySource == null || bodySource.isBlank()) {
                bodySource = template.getBodyHtml();
            }
        }
        String renderedSubject = EmailHtmlSanitizer.interpolatePlain(subjectSource, request.variables());
        String renderedBody = EmailHtmlSanitizer.interpolateAndSanitizeHtml(bodySource, request.variables());
        return new EmailTemplateUpsertRequest.PreviewResponse(renderedSubject, renderedBody);
    }

    private void validateRequest(EmailTemplateUpsertRequest request, boolean requireCode) {
        if (request == null) {
            throw new BadRequestException("Template request is required");
        }
        if (requireCode && (request.code() == null || request.code().isBlank() || !request.code().trim().matches("^[A-Za-z0-9_-]{2,80}$"))) {
            throw new BadRequestException("Template code must be 2-80 characters (letters, digits, underscore, hyphen)");
        }
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("Template name is required");
        }
        if (request.subjectTemplate() == null || request.subjectTemplate().isBlank()) {
            throw new BadRequestException("Subject template is required");
        }
        if (request.bodyHtml() == null || request.bodyHtml().isBlank()) {
            throw new BadRequestException("HTML body is required");
        }
    }

    private long normalizeTenantId(Long tenantId) {
        return tenantId == null ? TenantNotificationPolicy.DEFAULT_TENANT_ID : tenantId;
    }

    private List<Long> visibleTenantIds(Long tenantId) {
        long normalized = normalizeTenantId(tenantId);
        return normalized == TenantNotificationPolicy.DEFAULT_TENANT_ID
                ? List.of(TenantNotificationPolicy.DEFAULT_TENANT_ID)
                : List.of(TenantNotificationPolicy.DEFAULT_TENANT_ID, normalized);
    }

    private String trimOrNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}

package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.base.crud.CrudAction;
import org.springframework.security.access.prepost.PreAuthorize;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectServiceImpl
        extends BaseCrudServiceImpl<Subject, Long, SubjectDTO, SubjectFilter>
        implements SubjectService {

    SubjectMapper subjectMapper;
    SubjectRepository subjectRepository;
    SubjectUsageService usageService;

    @Override
    protected BaseCrudRepository<Subject, Long> getRepository() {
        return subjectRepository;
    }

    @Override
    protected BaseCrudMapper<Subject, SubjectDTO> getMapper() {
        return subjectMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name", "technicalGroup"};
    }

    @Override
    @Transactional(readOnly = true)
    public Page<SubjectDTO> getAll(Pageable pageable, String search, SubjectFilter filter) {
        checkPermission(CrudAction.READ);
        if (filter != null && filter.getMinHours() != null && filter.getMaxHours() != null
                && filter.getMinHours().compareTo(filter.getMaxHours()) > 0) {
            ValidationContext ctx = new ValidationContext();
            ctx.add("durationHours", "Minimum hours must not exceed maximum hours");
            ctx.throwIfErrors();
        }
        return super.getAll(pageable, search, filter);
    }

    @Override
    protected void beforeCreate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        String code = SubjectIdentity.normalizeCode(request.getCode());
        String version = SubjectIdentity.normalizeVersion(request.getVersion());
        request.setCode(code);
        request.setVersion(version);
        subject.setCode(code);
        subject.setVersion(version);
        validateIdentity(code, version, null, ctx);
        validateContent(request, null, ctx);
        synchronizeStatus(request, null, ctx);
        subject.setStatus(request.getStatus());
        subject.setIsActive(request.getIsActive());
        subject.setName(request.getName());

        if (request.getDurationHours() != null && request.getDurationHours().signum() <= 0) {
            ctx.add("durationHours", "Hours must be greater than 0");
        }
    }

    @Override
    protected void beforeUpdate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        String checkCode = SubjectIdentity.normalizeCode(
                request.getCode() != null ? request.getCode() : subject.getCode());
        String checkVersion = SubjectIdentity.normalizeVersion(
                request.getVersion() != null ? request.getVersion() : subject.getVersion());
        validateIdentity(checkCode, checkVersion, subject.getId(), ctx);
        request.setCode(checkCode);
        request.setVersion(checkVersion);
        validateContent(request, subject, ctx);
        synchronizeStatus(request, subject, ctx);
        if (contentChanged(subject, request) && usageService.getUsage(subject.getId()).isReferenced()) {
            ctx.add("version", "This version is already in use. Clone it to a new version to change its content.");
        }

        if (request.getDurationHours() != null && request.getDurationHours().signum() <= 0) {
            ctx.add("durationHours", "Hours must be greater than 0");
        }
    }

    private void validateContent(SubjectDTO request, Subject existing, ValidationContext ctx) {
        String name = request.getName() != null ? request.getName().trim() : existing != null ? existing.getName() : null;
        if (name == null || name.isBlank()) ctx.add("name", "Subject name is required");
        if (request.getName() != null) request.setName(name);
        validateLength("name", name, 255, ctx);
        validateLength("code", request.getCode(), 50, ctx);
        validateLength("version", request.getVersion(), 20, ctx);
        validateLength("technicalGroup", request.getTechnicalGroup(), 100, ctx);
        validateLength("objectives", request.getObjectives(), 4000, ctx);
        validateLength("skills", request.getSkills(), 4000, ctx);
        validateLength("outline", request.getOutline(), 12000, ctx);
        if (SubjectDescription.countWords(request.getDescription()) > SubjectDescription.MAX_WORDS) {
            ctx.add("description", "Description must not exceed 500 words");
        }
        if (existing == null && request.getDurationHours() == null) ctx.add("durationHours", "Hours is required");
    }

    private void validateLength(String field, String value, int max, ValidationContext ctx) {
        if (value != null && value.length() > max) ctx.add(field, field + " must not exceed " + max + " characters");
    }

    private void synchronizeStatus(SubjectDTO request, Subject existing, ValidationContext ctx) {
        if (request.getStatus() == SubjectStatus.DRAFT) ctx.add("status", "Choose ACTIVE or INACTIVE");
        boolean active = request.getIsActive() != null ? request.getIsActive()
                : request.getStatus() != null ? request.getStatus() == SubjectStatus.ACTIVE
                : existing == null || Boolean.TRUE.equals(existing.getIsActive());
        request.setIsActive(active);
        request.setStatus(active ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
    }

    private boolean contentChanged(Subject existing, SubjectDTO request) {
        return changed(SubjectIdentity.normalizeCode(existing.getCode()), request.getCode())
                || changed(SubjectIdentity.normalizeVersion(existing.getVersion()), request.getVersion())
                || changed(existing.getName(), request.getName())
                || changed(existing.getTechnicalGroup(), request.getTechnicalGroup())
                || changed(existing.getDurationHours(), request.getDurationHours())
                || changed(existing.getDescription(), request.getDescription())
                || changed(existing.getObjectives(), request.getObjectives())
                || changed(existing.getSkills(), request.getSkills())
                || changed(existing.getDeliveryMode(), request.getDeliveryMode())
                || changed(existing.getOutline(), request.getOutline());
    }

    private boolean changed(Object existing, Object requested) {
        if (existing instanceof java.math.BigDecimal previous && requested instanceof java.math.BigDecimal next)
            return previous.compareTo(next) != 0;
        return requested != null && !Objects.equals(existing, requested);
    }

    @Override
    @Transactional(readOnly = true)
    public SubjectDTO validateForCreate(SubjectDTO request) {
        checkPermission(CrudAction.CREATE);
        ValidationContext ctx = new ValidationContext();
        beforeCreate(subjectMapper.toEntity(request), request, ctx);
        ctx.throwIfErrors();
        return request;
    }

    @Override
    @PreAuthorize("hasAuthority('SUBJECT_CREATE') and hasAuthority('SUBJECT_READ')")
    public SubjectDTO cloneVersion(Long id, SubjectCloneRequest request) {
        Subject original = subjectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found"));
        SubjectDTO copy = subjectMapper.toResponse(original);
        copy.setId(null);
        copy.setVersion(request.version());
        // A new version is explicitly activated after its content has been reviewed.
        copy.setIsActive(false);
        copy.setStatus(SubjectStatus.INACTIVE);
        return create(copy);
    }

    private void validateIdentity(String code, String version, Long excludedId, ValidationContext ctx) {
        if (code == null || code.isBlank()) ctx.add("code", "Subject code is required");
        if (version == null || version.isBlank()) ctx.add("version", "Version is required");
        if (code == null || code.isBlank() || version == null || version.isBlank()) return;
        if (subjectRepository.existsByNormalizedIdentity(code, SubjectIdentity.versionAliases(version), excludedId)) {
            ctx.add("code", "Subject with code '" + code + "' and version '" + version
                    + "' already exists (codes are case-insensitive; v1.0 and 1.0 are the same version)");
        }
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public List<SubjectDTO> getActiveSubjects() {
        return subjectRepository.findByIsActiveTrue()
                .stream()
                .filter(subject -> subject.getStatus() == SubjectStatus.ACTIVE)
                .map(subjectMapper::toResponse)
                .toList();
    }

    @Override
    @PreAuthorize("hasAuthority('SUBJECT_UPDATE')")
    public SubjectDTO changeStatus(Long id, Boolean isActive) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found with ID: " + id));

        subject.setIsActive(Boolean.TRUE.equals(isActive));
        subject.setStatus(Boolean.TRUE.equals(isActive) ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
        Subject saved = subjectRepository.save(subject);
        return subjectMapper.toResponse(saved);
    }

    @Override
    protected void beforeDelete(Subject subject) {
        if (isSubjectReferenced(subject.getId())) {
            throw new BadRequestException(String.format(
                    "Không thể xóa môn học [%s - v%s] vì đã được tham chiếu trong hệ thống. " +
                    "Vui lòng chuyển trạng thái sang 'Ngừng hoạt động' (Inactive) để bảo toàn lịch sử đào tạo.",
                    subject.getCode(), subject.getVersion()
            ));
        }
    }

    @Override
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public boolean isSubjectReferenced(Long id) {
        return id != null && usageService.getUsage(id).isReferenced();
    }
}

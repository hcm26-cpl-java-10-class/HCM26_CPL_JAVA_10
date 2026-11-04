package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectServiceImpl
        extends BaseCrudServiceImpl<Subject, Long, SubjectDTO, SubjectFilter>
        implements SubjectService {

    SubjectMapper subjectMapper;
    SubjectRepository subjectRepository;
    SessionRepository sessionRepository;
    ProgramSubjectRepository programSubjectRepository;
    TeachingAssignmentRepository teachingAssignmentRepository;
    JdbcOperations jdbcTemplate;

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
    protected void beforeCreate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        String code = SubjectIdentity.normalizeCode(request.getCode());
        String version = SubjectIdentity.normalizeVersion(request.getVersion());
        request.setCode(code);
        request.setVersion(version);
        subject.setCode(code);
        subject.setVersion(version);
        validateIdentity(code, version, null, ctx);

        if (request.getIsActive() == null) {
            request.setIsActive(request.getStatus() != SubjectStatus.INACTIVE);
        }
        if (request.getStatus() == null) {
            request.setStatus(Boolean.FALSE.equals(request.getIsActive()) ? SubjectStatus.INACTIVE : SubjectStatus.ACTIVE);
        }
        subject.setIsActive(request.getIsActive());
        subject.setStatus(request.getStatus());

        if (request.getDurationHours() != null && request.getDurationHours() <= 0) {
            ctx.add("durationHours", "Subject duration must be greater than 0");
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

        if (request.getStatus() != null && request.getIsActive() == null) {
            request.setIsActive(request.getStatus() == SubjectStatus.ACTIVE);
        } else if (request.getIsActive() != null && request.getStatus() == null) {
            request.setStatus(request.getIsActive() ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
        }
        if (request.getStatus() != null) subject.setStatus(request.getStatus());
        if (request.getIsActive() != null) subject.setIsActive(request.getIsActive());

        if (request.getDurationHours() != null && request.getDurationHours() <= 0) {
            ctx.add("durationHours", "Subject duration must be greater than 0");
        }
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
    public List<SubjectDTO> getActiveSubjects() {
        return subjectRepository.findByIsActiveTrue()
                .stream()
                .map(subjectMapper::toResponse)
                .toList();
    }

    @Override
    public SubjectDTO changeStatus(Long id, Boolean isActive) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found with ID: " + id));

        boolean active = Boolean.TRUE.equals(isActive);
        subject.setIsActive(active);
        subject.setStatus(active ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
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
    public boolean isSubjectReferenced(Long id) {
        if (id == null) {
            return false;
        }

        // 1. Kiểm tra trong bảng sessions (Topic ID)
        if (sessionRepository != null && sessionRepository.existsByTopicId(id)) {
            return true;
        }

        // 2. Kiểm tra trong chương trình đào tạo (program_subjects)
        if (programSubjectRepository != null && programSubjectRepository.existsBySubject_Id(id)) {
            return true;
        }

        // 3. Kiểm tra phân công giảng dạy (teaching_assignments)
        if (teachingAssignmentRepository != null && teachingAssignmentRepository.existsByProgramSubject_Subject_Id(id)) {
            return true;
        }

        // 4. Kiểm tra các module khác như study_sessions nếu bảng có tồn tại
        if (jdbcTemplate != null) {
            try {
                Integer count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM study_sessions WHERE subject_id = ? OR topic_id = ?",
                        Integer.class, id, id);
                if (count != null && count > 0) {
                    return true;
                }
            } catch (BadSqlGrammarException ignored) {
                // Bảng study_sessions chưa được tạo ở giai đoạn này
            }
        }

        return false;
    }
}

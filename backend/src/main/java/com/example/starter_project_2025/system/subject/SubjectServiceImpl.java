package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
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

        subject.setIsActive(Boolean.TRUE.equals(isActive));
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

        // 2. Kiểm tra động các bảng liên kết từ các module khác (program_subjects, study_sessions, teaching_assignments)
        String[] checkQueries = {
                "SELECT COUNT(*) FROM program_subjects WHERE subject_id = ?",
                "SELECT COUNT(*) FROM teaching_assignments WHERE subject_id = ?",
                "SELECT COUNT(*) FROM study_sessions WHERE subject_id = ? OR topic_id = ?"
        };

        if (jdbcTemplate != null) {
            for (String sql : checkQueries) {
                try {
                    Object[] params = sql.contains("OR") ? new Object[]{id, id} : new Object[]{id};
                    Integer count = jdbcTemplate.queryForObject(sql, Integer.class, params);
                    if (count != null && count > 0) {
                        return true;
                    }
                } catch (Exception ignored) {
                    // Bảng chưa tồn tại trong schema ở giai đoạn phát triển độc lập
                }
            }
        }

        return false;
    }
}

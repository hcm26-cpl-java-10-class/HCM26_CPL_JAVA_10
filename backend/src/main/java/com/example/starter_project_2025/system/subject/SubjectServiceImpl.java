package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectServiceImpl
        extends BaseCrudServiceImpl<Subject, Long, SubjectDTO, SubjectFilter>
        implements SubjectService {

    SubjectMapper subjectMapper;
    SubjectRepository subjectRepository;
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
        if (subjectRepository.existsByCodeAndVersion(request.getCode(), request.getVersion())) {
            ctx.add("code", "Subject with code '" + request.getCode() + "' and version '" + request.getVersion() + "' already exists");
        }

        if (request.getDurationHours() != null && request.getDurationHours() <= 0) {
            ctx.add("durationHours", "Subject duration must be greater than 0");
        }

        // Đồng bộ status và isActive khi tạo mới
        boolean active = request.getIsActive() == null || Boolean.TRUE.equals(request.getIsActive());
        if (request.getStatus() != null) {
            active = request.getStatus() == SubjectStatus.ACTIVE;
        }
        subject.setIsActive(active);
        subject.setStatus(active ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
    }

    @Override
    protected void beforeUpdate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        String checkCode = request.getCode() != null ? request.getCode() : subject.getCode();
        String checkVersion = request.getVersion() != null ? request.getVersion() : subject.getVersion();

        if (subjectRepository.existsByCodeAndVersionAndIdNot(checkCode, checkVersion, subject.getId())) {
            ctx.add("code", "Subject with code '" + checkCode + "' and version '" + checkVersion + "' already exists");
        }

        if (request.getDurationHours() != null && request.getDurationHours() <= 0) {
            ctx.add("durationHours", "Subject duration must be greater than 0");
        }

        // Đồng bộ status và isActive khi cập nhật
        if (request.getIsActive() != null) {
            boolean active = Boolean.TRUE.equals(request.getIsActive());
            subject.setIsActive(active);
            subject.setStatus(active ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
        } else if (request.getStatus() != null) {
            boolean active = request.getStatus() == SubjectStatus.ACTIVE;
            subject.setStatus(request.getStatus());
            subject.setIsActive(active);
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

        // Kiểm tra động các bảng liên kết từ các module khác (program_subjects, teaching_assignments, study_sessions, sessions)
        String[] checkQueries = {
                "SELECT COUNT(*) FROM program_subjects WHERE subject_id = ?",
                "SELECT COUNT(*) FROM teaching_assignments WHERE subject_id = ?",
                "SELECT COUNT(*) FROM study_sessions WHERE subject_id = ? OR topic_id = ?",
                "SELECT COUNT(*) FROM sessions WHERE topic_id = ?"
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

    @Override
    @Transactional(readOnly = true)
    public boolean isCodeAvailable(String code, String version, Long excludeId) {
        if (code == null || code.isBlank()) {
            return false;
        }
        String ver = (version == null || version.isBlank()) ? "1.0" : version.trim();
        if (excludeId != null) {
            return !subjectRepository.existsByCodeAndVersionAndIdNot(code.trim(), ver, excludeId);
        }
        return !subjectRepository.existsByCodeAndVersion(code.trim(), ver);
    }

    @Override
    @Transactional(readOnly = true)
    public SubjectSummaryDTO getSummary() {
        List<Subject> allSubjects = subjectRepository.findAll();
        long activeCount = allSubjects.stream().filter(s -> Boolean.TRUE.equals(s.getIsActive())).count();
        long inactiveCount = allSubjects.size() - activeCount;

        Map<String, Long> countByGroup = allSubjects.stream()
                .filter(s -> s.getTechnicalGroup() != null && !s.getTechnicalGroup().isBlank())
                .collect(Collectors.groupingBy(
                        Subject::getTechnicalGroup,
                        Collectors.counting()
                ));

        return SubjectSummaryDTO.builder()
                .totalSubjects(allSubjects.size())
                .activeSubjects(activeCount)
                .inactiveSubjects(inactiveCount)
                .countByTechnicalGroup(countByGroup)
                .build();
    }
}

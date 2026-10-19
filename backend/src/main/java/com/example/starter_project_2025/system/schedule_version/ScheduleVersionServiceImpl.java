package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Triển khai nghiệp vụ ScheduleVersion.
 * Chủ sở hữu: Phát
 *
 * Tuần 2 – Luồng cơ bản:
 *   ✅ createDraft: tạo bản nháp rỗng
 *   ✅ cloneVersion: clone phiên bản sang bản nháp mới
 *   ✅ getVersionsByClass, getActiveVersion, getEditableStatus, getHistory
 *
 * Tuần 3 – Bổ sung:
 *   ⬜ validateVersion: gọi ScheduleConflictService của Thắng
 *   ⬜ activateVersion: kích hoạt nguyên tử @Transactional (archive bản cũ + activate bản mới)
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScheduleVersionServiceImpl
        extends BaseCrudServiceImpl<ScheduleVersion, Long, ScheduleVersionDTO, ScheduleVersionFilter>
        implements ScheduleVersionService {

    ScheduleVersionRepository scheduleVersionRepository;
    ScheduleVersionMapper scheduleVersionMapper;

    // ─────────────────────────── Base CRUD hooks ───────────────────────────

    @Override
    protected BaseCrudRepository<ScheduleVersion, Long> getRepository() {
        return scheduleVersionRepository;
    }

    @Override
    protected BaseCrudMapper<ScheduleVersion, ScheduleVersionDTO> getMapper() {
        return scheduleVersionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"classId", "note"};
    }

    @Override
    protected void beforeCreate(ScheduleVersion entity, ScheduleVersionDTO request, ValidationContext ctx) {
        if (request.getClassId() == null || request.getClassId().isBlank()) {
            ctx.add("classId", "Class ID is required");
        }
    }

    // ─────────────────────── Tạo nháp rỗng ────────────────────────────────

    /**
     * Tạo phiên bản lịch nháp rỗng cho lớp.
     *
     * Quy tắc:
     * - Chặn 409 nếu lớp đã có bản DRAFT đang mở (tránh tạo nhiều bản nháp cùng lúc).
     * - versionNumber = max(versionNumber của lớp) + 1 (nếu chưa có thì = 1).
     */
    @Override
    @Transactional
    public ScheduleVersionDTO createDraft(String classId, String note) {
        // Chặn trùng DRAFT
        if (scheduleVersionRepository.existsByClassIdAndStatus(classId, ScheduleVersionStatus.DRAFT)) {
            throw new BadRequestException(
                    "Class " + classId + " already has an open DRAFT version. " +
                    "Please activate or delete it before creating a new draft."
            );
        }

        // Tính versionNumber mới
        int nextVersion = scheduleVersionRepository
                .findTopByClassIdOrderByVersionNumberDesc(classId)
                .map(v -> v.getVersionNumber() + 1)
                .orElse(1);

        ScheduleVersion draft = ScheduleVersion.builder()
                .classId(classId)
                .versionNumber(nextVersion)
                .status(ScheduleVersionStatus.DRAFT)
                .note(note)
                .build();

        ScheduleVersion saved = scheduleVersionRepository.save(draft);
        return toResponseDTO(saved, 0, null, null);
    }

    // ─────────────────────── Clone phiên bản ──────────────────────────────

    /**
     * Clone một phiên bản (thường là ACTIVE) sang một bản nháp mới.
     *
     * Quy tắc:
     * - Chặn 409 nếu lớp đã có bản DRAFT đang mở.
     * - Ghi nhớ clonedFromVersionId để truy vết nguồn gốc.
     * - Các StudySession sẽ được Danh copy trong luồng tích hợp tuần 4.
     *   (Tại đây chỉ clone metadata phiên bản, không clone buổi học.)
     */
    @Override
    @Transactional
    public ScheduleVersionDTO cloneVersion(Long sourceVersionId, String note) {
        ScheduleVersion source = scheduleVersionRepository.findById(sourceVersionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ScheduleVersion not found with ID: " + sourceVersionId));

        // Chặn trùng DRAFT cho cùng lớp
        if (scheduleVersionRepository.existsByClassIdAndStatus(source.getClassId(), ScheduleVersionStatus.DRAFT)) {
            throw new BadRequestException(
                    "Class " + source.getClassId() + " already has an open DRAFT version. " +
                    "Please activate or delete it before cloning."
            );
        }

        // Tính versionNumber mới
        int nextVersion = scheduleVersionRepository
                .findTopByClassIdOrderByVersionNumberDesc(source.getClassId())
                .map(v -> v.getVersionNumber() + 1)
                .orElse(1);

        ScheduleVersion cloned = ScheduleVersion.builder()
                .classId(source.getClassId())
                .versionNumber(nextVersion)
                .status(ScheduleVersionStatus.DRAFT)
                .note(note)
                .clonedFromVersionId(String.valueOf(sourceVersionId))
                .build();

        ScheduleVersion saved = scheduleVersionRepository.save(cloned);
        return toResponseDTO(saved, 0, String.valueOf(sourceVersionId), null);
    }

    // ─────────────────────── Các API đọc ──────────────────────────────────

    @Override
    public List<ScheduleVersionDTO> getVersionsByClass(String classId) {
        return scheduleVersionRepository
                .findByClassIdOrderByVersionNumberAsc(classId)
                .stream()
                .map(v -> toResponseDTO(v, 0, v.getClonedFromVersionId(), null))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<ScheduleVersionDTO> getActiveVersion(String classId) {
        return scheduleVersionRepository
                .findByClassIdAndStatus(classId, ScheduleVersionStatus.ACTIVE)
                .map(v -> toResponseDTO(v, 0, v.getClonedFromVersionId(), null));
    }

    /**
     * Guard kiểm tra phiên bản có cho phép sửa buổi học không.
     * isEditable = true CHỈ KHI status == DRAFT.
     * Danh gọi endpoint này trước khi thêm/sửa/hủy StudySession.
     */
    @Override
    public ScheduleVersionDTO getEditableStatus(Long versionId) {
        ScheduleVersion version = scheduleVersionRepository.findById(versionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ScheduleVersion not found with ID: " + versionId));

        boolean editable = ScheduleVersionStatus.DRAFT.equals(version.getStatus());
        String message = editable
                ? "Version is in DRAFT status. Modification allowed."
                : "Cannot modify sessions in a " + version.getStatus() +
                  " version. Clone to a new DRAFT first.";

        ScheduleVersionDTO dto = toResponseDTO(version, 0, version.getClonedFromVersionId(), null);
        dto.setIsEditable(editable);
        dto.setEditableMessage(message);
        return dto;
    }

    @Override
    public List<ScheduleVersionDTO> getHistory(String classId) {
        return scheduleVersionRepository
                .findByClassIdOrderByVersionNumberDesc(classId)
                .stream()
                .map(v -> toResponseDTO(v, 0, v.getClonedFromVersionId(), null))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteDraft(Long id) {
        ScheduleVersion version = scheduleVersionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ScheduleVersion", "id", id));

        if (version.getStatus() != ScheduleVersionStatus.DRAFT) {
            throw new BadRequestException(
                    "Cannot delete schedule version in status: " + version.getStatus() +
                    ". Only DRAFT versions can be deleted.");
        }

        scheduleVersionRepository.delete(version);
    }

    // ─────────────────── Helper: build response DTO ────────────────────────

    private ScheduleVersionDTO toResponseDTO(ScheduleVersion entity,
                                              int totalSessions,
                                              String clonedFromVersionId,
                                              String previousActiveVersionId) {
        ScheduleVersionDTO dto = scheduleVersionMapper.toResponse(entity);
        dto.setTotalSessions(totalSessions);
        dto.setClonedFromVersionId(clonedFromVersionId);
        dto.setPreviousActiveVersionId(previousActiveVersionId);
        return dto;
    }
}

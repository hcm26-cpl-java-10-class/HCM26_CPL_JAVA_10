package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller REST cho ScheduleVersion.
 * Base URL: /api/schedule-versions
 * Chủ sở hữu: Phát
 *
 * Tuần 2 – Đã triển khai:
 *   GET  /api/schedule-versions/classes/{classId}          → danh sách phiên bản của lớp
 *   GET  /api/schedule-versions/classes/{classId}/active   → bản ACTIVE của lớp (Tân dùng)
 *   GET  /api/schedule-versions/{id}                       → chi tiết một phiên bản
 *   GET  /api/schedule-versions/{id}/editable              → guard kiểm tra quyền sửa (Danh dùng)
 *   POST /api/schedule-versions/classes/{classId}/draft    → tạo bản nháp rỗng
 *   POST /api/schedule-versions/{id}/clone                 → clone sang bản nháp mới
 *   GET  /api/schedule-versions/classes/{classId}/history  → lịch sử phiên bản
 *
 * Tuần 3 – Sẽ bổ sung:
 *   POST /api/schedule-versions/{id}/validate              → kiểm tra xung đột (gọi Thắng)
 *   POST /api/schedule-versions/{id}/activate              → kích hoạt nguyên tử
 *   DELETE /api/schedule-versions/{id}                     → xóa bản DRAFT
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/schedule-versions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Schedule Version Management", description = "APIs quản lý phiên bản và lịch sử lịch học")
public class ScheduleVersionController
        extends BaseCrudDataIoController<ScheduleVersion, Long, ScheduleVersionDTO, ScheduleVersionFilter> {

    ScheduleVersionService scheduleVersionService;
    ScheduleVersionRepository scheduleVersionRepository;

    @Override
    protected BaseCrudService<Long, ScheduleVersionDTO, ScheduleVersionFilter> getService() {
        return scheduleVersionService;
    }

    @Override
    protected BaseCrudRepository<ScheduleVersion, Long> getRepository() {
        return scheduleVersionRepository;
    }

    @Override
    protected Class<ScheduleVersion> getEntityClass() {
        return ScheduleVersion.class;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ✅ TUẦN 2: LUỒNG CƠ BẢN
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Lấy danh sách tất cả phiên bản lịch học của một lớp.
     * Tân dùng để hiển thị dropdown chọn phiên bản.
     * Admin dùng để xem tổng quan lịch sử.
     */
    @GetMapping("/classes/{classId}")
    @Operation(
            summary = "Lấy danh sách phiên bản của lớp",
            description = "Trả về tất cả phiên bản lịch học (DRAFT/ACTIVE/ARCHIVED) của một lớp, sắp theo versionNumber tăng dần."
    )
    public ResponseEntity<List<ScheduleVersionDTO>> getVersionsByClass(
            @PathVariable String classId) {
        return ResponseEntity.ok(scheduleVersionService.getVersionsByClass(classId));
    }

    /**
     * Lấy phiên bản lịch đang ACTIVE của lớp.
     * Tân dùng để truy vấn StudySession cho thời khóa biểu.
     * Trả 404 nếu chưa có bản ACTIVE.
     */
    @GetMapping("/classes/{classId}/active")
    @Operation(
            summary = "Lấy phiên bản ACTIVE của lớp",
            description = "Học viên và giảng viên chỉ xem lịch từ bản ACTIVE này. Trả 404 nếu chưa có."
    )
    public ResponseEntity<ScheduleVersionDTO> getActiveVersion(
            @PathVariable String classId) {
        return scheduleVersionService.getActiveVersion(classId)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No active schedule version found for class: " + classId));
    }

    /**
     * Guard kiểm tra phiên bản có cho phép chỉnh sửa buổi học không.
     * Danh gọi trước khi thêm/sửa/hủy StudySession.
     * isEditable = true CHỈ KHI status == DRAFT.
     */
    @GetMapping("/{id}/editable")
    @Operation(
            summary = "Kiểm tra quyền sửa nội dung lịch (guard cho Danh)",
            description = "Trả isEditable=true nếu phiên bản đang DRAFT. Danh gọi trước khi ghi StudySession."
    )
    public ResponseEntity<ScheduleVersionDTO> getEditableStatus(
            @PathVariable Long id) {
        return ResponseEntity.ok(scheduleVersionService.getEditableStatus(id));
    }

    /**
     * Tạo một phiên bản lịch nháp rỗng cho lớp.
     * Chặn 409 nếu lớp đã có bản DRAFT đang mở.
     */
    @PostMapping("/classes/{classId}/draft")
    @Operation(
            summary = "Tạo phiên bản lịch nháp rỗng",
            description = "Tạo bản DRAFT mới cho lớp. Chặn 409 nếu đã có DRAFT. " +
                          "Sau khi tạo, Danh có thể bắt đầu thêm StudySession vào bản nháp này."
    )
    public ResponseEntity<ScheduleVersionDTO> createDraft(
            @PathVariable String classId,
            @RequestBody(required = false) Map<String, String> body) {
        String note = (body != null) ? body.get("note") : null;
        ScheduleVersionDTO created = scheduleVersionService.createDraft(classId, note);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * Clone một phiên bản (thường là ACTIVE) sang bản nháp mới.
     * Chặn 409 nếu lớp đã có bản DRAFT đang mở.
     * Buổi học (StudySession) sẽ được Danh copy trong luồng tích hợp (tuần 4).
     */
    @PostMapping("/{id}/clone")
    @Operation(
            summary = "Clone phiên bản sang DRAFT mới",
            description = "Sao chép metadata phiên bản nguồn sang bản nháp mới. " +
                          "Ghi nhớ clonedFromVersionId để truy vết. " +
                          "StudySession sẽ được clone trong luồng tích hợp tuần 4 với Danh."
    )
    public ResponseEntity<ScheduleVersionDTO> cloneVersion(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        String note = (body != null) ? body.get("note") : null;
        ScheduleVersionDTO cloned = scheduleVersionService.cloneVersion(id, note);
        return ResponseEntity.status(HttpStatus.CREATED).body(cloned);
    }

    /**
     * Lấy lịch sử phiên bản của lớp (sắp theo versionNumber giảm dần, mới nhất trước).
     * Admin/Giáo vụ dùng để xem ai kích hoạt lúc nào.
     */
    @GetMapping("/classes/{classId}/history")
    @Operation(
            summary = "Lấy lịch sử phiên bản của lớp",
            description = "Trả danh sách phiên bản, mới nhất trước. " +
                          "Người dùng cần quyền SCHEDULE_HISTORY để xem bản ARCHIVED."
    )
    public ResponseEntity<List<ScheduleVersionDTO>> getHistory(
            @PathVariable String classId) {
        return ResponseEntity.ok(scheduleVersionService.getHistory(classId));
    }

    // ════════════════════════════════════════════════════════════════════════
    // ⬜ TUẦN 3: SẼ BỔ SUNG (validate + activate + delete)
    // ════════════════════════════════════════════════════════════════════════
    // TODO Tuần 3: POST /{id}/validate  → gọi ScheduleConflictService của Thắng
    // TODO Tuần 3: POST /{id}/activate  → kích hoạt nguyên tử @Transactional
    // TODO Tuần 3: DELETE /{id}         → xóa bản DRAFT
}

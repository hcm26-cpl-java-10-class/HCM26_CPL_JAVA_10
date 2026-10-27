package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewResponseDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkSaveSessionsRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkSaveSessionsResponseDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.ScheduleGenerationContextResponse;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/classes/{classId}/schedule-generation")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Kế hoạch lịch và tạo lịch theo tuần", description = "APIs sinh nhiều buổi học tự động từ chương trình của lớp (Chức năng Phát)")
@ResourcePermission("SESSION")
@ResourceMenu(
        title = "Weekly Schedule Generation",
        group = "Schedule Management",
        icon = "calendar",
        url = "/schedule-generation",
        order = 1,
        permission = "SESSION_READ"
)
public class BulkSessionGenerationController {

    BulkSessionGenerationService generationService;

    @GetMapping("/context")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_READ')")
    @Operation(summary = "Lấy kế hoạch môn học và phân công giảng viên của lớp",
            description = "Trả về danh sách các môn theo thứ tự chương trình và phân công trainer để chuẩn bị sinh lịch")
    public ResponseEntity<ScheduleGenerationContextResponse> getGenerationContext(
            @PathVariable Long classId) {
        return ResponseEntity.ok(generationService.getGenerationContext(classId));
    }

    @PostMapping("/preview")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_READ') and hasAuthority('SESSION_CREATE')")
    @Operation(summary = "Sinh danh sách các buổi học dự kiến trên RAM",
            description = "Tính toán phân bổ các buổi học theo thứ trong tuần, ca/slot, né ngày nghỉ lễ; chưa lưu xuống DB")
    public ResponseEntity<BulkPreviewResponseDTO> generatePreview(
            @PathVariable Long classId,
            @Valid @RequestBody BulkPreviewRequestDTO request) {
        return ResponseEntity.ok(generationService.generatePreview(classId, request));
    }

    @PostMapping("/save")
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('SESSION_READ') and hasAuthority('SESSION_CREATE')")
    @Operation(summary = "Lưu lô toàn bộ các buổi học vào hệ thống (All-or-Nothing)",
            description = "Lưu danh sách buổi học đã được người dùng chỉnh sửa trên preview; hỗ trợ Idempotency-Key chống click đúp")
    public ResponseEntity<BulkSaveSessionsResponseDTO> saveBulkSessions(
            @PathVariable Long classId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody BulkSaveSessionsRequestDTO request) {
        BulkSaveSessionsResponseDTO response = generationService.saveBulkSessions(classId, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

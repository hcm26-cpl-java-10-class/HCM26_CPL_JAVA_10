package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/subjects")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Subject Management", description = "APIs for managing subjects and topics")
public class SubjectController
        extends BaseCrudDataIoController<Subject, Long, SubjectDTO, SubjectFilter> {

    SubjectService subjectService;
    SubjectRepository subjectRepository;

    @Override
    protected BaseCrudService<Long, SubjectDTO, SubjectFilter> getService() {
        return subjectService;
    }

    @Override
    protected BaseCrudRepository<Subject, Long> getRepository() {
        return subjectRepository;
    }

    @Override
    protected Class<Subject> getEntityClass() {
        return Subject.class;
    }

    @GetMapping("/active")
    @Operation(summary = "Lấy danh sách môn học đang hoạt động", description = "Lấy danh mục môn học đang hoạt động")
    public ResponseEntity<List<SubjectDTO>> getActiveSubjects() {
        return ResponseEntity.ok(subjectService.getActiveSubjects());
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Đổi trạng thái môn học (kích hoạt / ngừng sử dụng)")
    public ResponseEntity<SubjectDTO> changeStatus(
            @PathVariable Long id,
            @RequestParam Boolean active
    ) {
        return ResponseEntity.ok(subjectService.changeStatus(id, active));
    }

    @GetMapping("/{id}/is-referenced")
    @Operation(summary = "Kiểm tra môn học đã được tham chiếu hay chưa", description = "Kiểm tra xem môn học đã được sử dụng trong lịch học hoặc chương trình đào tạo hay chưa")
    public ResponseEntity<Boolean> isSubjectReferenced(@PathVariable Long id) {
        return ResponseEntity.ok(subjectService.isSubjectReferenced(id));
    }

    @GetMapping("/check-code")
    @Operation(summary = "Kiểm tra mã môn học và phiên bản có khả dụng không", description = "Kiểm tra xem mã môn và phiên bản đã tồn tại trong hệ thống hay chưa để phục vụ validate form realtime")
    public ResponseEntity<Map<String, Object>> checkCodeAvailable(
            @RequestParam String code,
            @RequestParam(defaultValue = "1.0") String version,
            @RequestParam(required = false) Long excludeId
    ) {
        boolean available = subjectService.isCodeAvailable(code, version, excludeId);
        return ResponseEntity.ok(Map.of(
                "code", code,
                "version", version,
                "available", available
        ));
    }

    @GetMapping("/summary")
    @Operation(summary = "Thống kê tổng quan môn học", description = "Lấy số lượng tổng môn học, số môn hoạt động/ngừng hoạt động và phân nhóm kỹ thuật")
    public ResponseEntity<SubjectSummaryDTO> getSummary() {
        return ResponseEntity.ok(subjectService.getSummary());
    }
}

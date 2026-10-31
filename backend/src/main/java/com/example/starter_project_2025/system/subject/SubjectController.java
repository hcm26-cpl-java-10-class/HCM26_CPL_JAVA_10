package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/subjects")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Subject Management", description = "APIs for managing subjects and topics")
public class SubjectController
        extends BaseCrudDataIoController<Subject, Long, SubjectDTO, SubjectFilter> {

    SubjectService subjectService;
    SubjectRepository subjectRepository;
    SubjectImportService subjectImportService;

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return subjectImportService.importFile(file);
    }

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
}

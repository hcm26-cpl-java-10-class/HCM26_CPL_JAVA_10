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
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;

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
    SubjectUsageService subjectUsageService;
    SubjectExportService subjectExportService;

    @PostMapping("/{id}/clone")
    public ResponseEntity<SubjectDTO> cloneVersion(@PathVariable Long id, @Valid @RequestBody SubjectCloneRequest request) {
        return ResponseEntity.status(201).body(subjectService.cloneVersion(id, request));
    }

    @GetMapping("/{id}/usage")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public SubjectUsageService.Usage usage(@PathVariable Long id) {
        subjectService.getById(id);
        return subjectUsageService.getUsage(id);
    }

    @PostMapping(value = "/import/preview", consumes = "multipart/form-data")
    public SubjectImportPreview previewImport(@RequestParam("file") MultipartFile file) {
        return subjectImportService.preview(file);
    }

    @PostMapping("/import/preview-rows")
    public SubjectImportPreview previewEditedRows(@Valid @RequestBody SubjectImportRowsRequest request) {
        return subjectImportService.previewRows(request);
    }

    @PostMapping("/import/rows")
    public ImportResult importEditedRows(@Valid @RequestBody SubjectImportRowsRequest request) {
        return subjectImportService.importRows(request);
    }

    @GetMapping("/import-template")
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ResponseEntity<byte[]> importTemplate() {
        String header = "\uFEFFCode,Name,Version,Technical Group,Hours,Description,Status,Objectives,Skills,Delivery Mode,Outline\r\n";
        return ResponseEntity.ok().header("Content-Type", "text/csv;charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=\"subjects_template.csv\"")
                .body(header.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    @GetMapping("/export")
    public void exportFile(@RequestParam(defaultValue = "EXCEL") FileFormat format,
                           HttpServletResponse response) throws IOException {
        subjectExportService.export(format, null, null, Sort.by("code", "version"), response);
    }

    @GetMapping("/export/filtered")
    public void exportFiltered(@RequestParam(defaultValue = "EXCEL") FileFormat format,
                               @RequestParam(required = false) String search,
                               @ModelAttribute SubjectFilter filter, Pageable pageable,
                               HttpServletResponse response) throws IOException {
        subjectExportService.export(format, search, filter,
                pageable.getSort().isSorted() ? pageable.getSort() : Sort.by("code", "version"), response);
    }

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
        subjectService.getById(id);
        return ResponseEntity.ok(subjectService.isSubjectReferenced(id));
    }
}

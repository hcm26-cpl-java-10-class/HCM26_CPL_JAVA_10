package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.subject.dto.TopicImportPreviewResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/subjects", "/api/topics"})
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Subject Management", description = "APIs for managing subjects and topics")
public class SubjectController
        extends BaseCrudDataIoController<Subject, Long, SubjectDTO, SubjectFilter> {

    SubjectService subjectService;
    SubjectRepository subjectRepository;
    SubjectImportService subjectImportService;

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public ResponseEntity<Page<SubjectDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute SubjectFilter filter
    ) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public ResponseEntity<SubjectDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ResponseEntity<SubjectDTO> create(
            @Validated(OnCreate.class) @RequestBody SubjectDTO request
    ) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SUBJECT_UPDATE')")
    public ResponseEntity<SubjectDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody SubjectDTO request
    ) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SUBJECT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }

    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws java.io.IOException {
        super.exportFile(format, response);
    }

    @PostMapping(value = "/import/preview", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    @Operation(summary = "Preview topic import file")
    public TopicImportPreviewResponse previewImport(@RequestParam("file") MultipartFile file) {
        return subjectImportService.preview(file);
    }

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return subjectImportService.importFile(file);
    }

    @PostMapping("/import/commit")
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    @Operation(summary = "Import validated topic rows with strict rollback")
    public ImportResult commitImport(@RequestBody List<SubjectDTO> items) {
        return subjectImportService.commitRows(items);
    }

    @GetMapping("/import/template")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    @Operation(summary = "Download topic import Excel template")
    public ResponseEntity<byte[]> importTemplate() throws java.io.IOException {
        try (
                org.apache.poi.xssf.usermodel.XSSFWorkbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
                java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream()
        ) {
            org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet("Subjects");
            org.apache.poi.ss.usermodel.Row headerRow = sheet.createRow(0);

            org.apache.poi.ss.usermodel.CellStyle headerStyle = workbook.createCellStyle();
            org.apache.poi.ss.usermodel.Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(org.apache.poi.ss.usermodel.IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(org.apache.poi.ss.usermodel.IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);

            String[] headers = {
                    "Code",
                    "Name",
                    "Version",
                    "Technical Group",
                    "Duration (Hours)",
                    "Description",
                    "Status"
            };

            for (int i = 0; i < headers.length; i++) {
                org.apache.poi.ss.usermodel.Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            Object[][] sampleData = {
                    {"L1_AL_CCGM", "Clean Code and Git Multi-platform", "1.0", "Java", 20, "Clean code guidelines and Git branching workflows", "ACTIVE"},
                    {"L2_JA_ORM", "Hibernate and JPA Persistence", "1.0", "Java", 40, "ORM mapping, queries, caching and criteria", "ACTIVE"}
            };

            for (int r = 0; r < sampleData.length; r++) {
                org.apache.poi.ss.usermodel.Row row = sheet.createRow(r + 1);
                for (int c = 0; c < sampleData[r].length; c++) {
                    org.apache.poi.ss.usermodel.Cell cell = row.createCell(c);
                    Object val = sampleData[r][c];
                    if (val instanceof Number n) {
                        cell.setCellValue(n.doubleValue());
                    } else if (val != null) {
                        cell.setCellValue(val.toString());
                    }
                }
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(output);

            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=topic-import-template.xlsx")
                    .contentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM)
                    .body(output.toByteArray());
        }
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
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    @Operation(summary = "Get active topics", description = "Get list of active topics")
    public ResponseEntity<List<SubjectDTO>> getActiveSubjects() {
        return ResponseEntity.ok(subjectService.getActiveSubjects());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('SUBJECT_UPDATE')")
    @Operation(summary = "Change topic status (Active / Inactive)")
    public ResponseEntity<SubjectDTO> changeStatus(
            @PathVariable Long id,
            @RequestParam Boolean active
    ) {
        return ResponseEntity.ok(subjectService.changeStatus(id, active));
    }

    @GetMapping("/{id}/is-referenced")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    @Operation(summary = "Check if topic is referenced", description = "Check if topic is used in training programs or schedules")
    public ResponseEntity<Boolean> isSubjectReferenced(@PathVariable Long id) {
        return ResponseEntity.ok(subjectService.isSubjectReferenced(id));
    }
}

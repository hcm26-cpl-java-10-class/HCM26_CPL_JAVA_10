package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/teaching-assignments")
@RequiredArgsConstructor
public class TeachingAssignmentFileController {
    private final TeachingAssignmentFileService files;
    private final ExportService exporter;

    @GetMapping("/import-template")
    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE')")
    public ResponseEntity<byte[]> template() throws IOException {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"teaching-assignments-template.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(files.template());
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return files.importFile(file);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('ASSIGNMENT_READ')")
    public void exportFile(@RequestParam(defaultValue = "EXCEL") FileFormat format,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) Long programSubjectId,
            @RequestParam(required = false) Long trainerId,
            @RequestParam(required = false) AssignmentRole role,
            @RequestParam(required = false) LocalDate effectiveOn,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long subjectId,
            @PageableDefault(sort = "effectiveFrom") Pageable pageable,
            HttpServletResponse response) throws IOException {
        var rows = files.exportRows(classId, programSubjectId, trainerId, role, effectiveOn, search, subjectId, pageable.getSort());
        exporter.export(format, rows, TeachingAssignmentFileRow.class, response);
    }
}

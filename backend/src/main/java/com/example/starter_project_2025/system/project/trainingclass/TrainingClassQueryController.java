package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.service.ImportService;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/classes")
public class TrainingClassQueryController {

    private final TrainingClassQueryService queryService;
    private final TrainingClassRepository trainingClassRepository;
    private final ImportService importService;
    private final ExportService exportService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    public Page<TrainingClassListItem> getManageableClasses(
            @PageableDefault(size = 10) Pageable pageable,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) TrainingClassStatus status,
            @RequestParam(required = false) Long programId,
            @RequestParam(required = false) Long cohortId,
            @RequestParam(required = false) String programName,
            @RequestParam(required = false) String cohortName,
            Authentication authentication
    ) {
        return queryService.getManageableClasses(
                authentication, pageable, search, status,
                programId, cohortId, programName, cohortName);
    }

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public void exportManageableClasses(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {
        exportService.export(
                format,
                queryService.getAllManageableClasses(authentication),
                TrainingClass.class,
                response
        );
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('TRAINING_CLASS_CREATE')")
    public ImportResult importClasses(@RequestParam("file") MultipartFile file) {
        return importService.importFile(
                file, TrainingClass.class, trainingClassRepository);
    }
}

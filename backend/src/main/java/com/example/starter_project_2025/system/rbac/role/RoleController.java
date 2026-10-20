package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.base.dataio.importer.service.ImportService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/roles")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Role", description = "APIs for managing roles")
public class RoleController
        extends BaseCrudController<Long, RoleDTO, RoleFilter> {

    RoleService roleService;
    RoleRepository roleRepository;
    ExportService exportService;
    ImportService importService;

    @Override
    protected BaseCrudService<Long, RoleDTO, RoleFilter> getService() {
        return roleService;
    }

    @GetMapping("/search")
    public ResponseEntity<Page<RoleDTO>> searchRoles(
            @RequestParam(required = false) String keyword,
            @PageableDefault Pageable pageable
    ) {
        return ResponseEntity.ok(roleService.searchRoles(keyword, pageable));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<RoleDTO> updateRoleStatus(
            @PathVariable Long id,
            @RequestParam boolean isActive
    ) {
        return ResponseEntity.ok(roleService.updateRoleStatus(id, isActive));
    }

    @GetMapping("/export")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws IOException {
        exportService.export(format, roleRepository.findAll(), Role.class, response);
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<RoleImportResult> importFile(
            @RequestParam("file") MultipartFile file
    ) {
        ImportResult result = importService.importFile(file, Role.class, roleRepository);
        List<RoleImportError> errors = result.getErrors().stream()
                .map(RoleController::toImportError)
                .toList();
        return ResponseEntity.ok(new RoleImportResult(
                result.getSuccessCount(), result.getFailureCount(), errors));
    }

    private static RoleImportError toImportError(RowError error) {
        String message = error.getMessage();
        String field = message != null && message.toLowerCase(Locale.ROOT).contains("lookup failed")
                ? "permissions"
                : "role";
        return new RoleImportError(error.getRowNumber(), field, message);
    }

    public record RoleImportResult(
            int successCount,
            int failedCount,
            List<RoleImportError> errors
    ) {}

    public record RoleImportError(int row, String field, String message) {}
}

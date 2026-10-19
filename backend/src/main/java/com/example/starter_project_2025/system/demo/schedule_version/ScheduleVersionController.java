package com.example.starter_project_2025.system.demo.schedule_version;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/schedule-versions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Schedule Version", description = "APIs for managing schedule versions")
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

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_READ')")
    public ResponseEntity<Page<ScheduleVersionDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute ScheduleVersionFilter filter) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_READ')")
    public ResponseEntity<ScheduleVersionDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_CREATE')")
    public ResponseEntity<ScheduleVersionDTO> create(
            @Validated(OnCreate.class) @RequestBody ScheduleVersionDTO request) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_UPDATE')")
    public ResponseEntity<ScheduleVersionDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody ScheduleVersionDTO request) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }

    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") com.example.starter_project_2025.base.dataio.common.FileFormat format,
            jakarta.servlet.http.HttpServletResponse response
    ) throws java.io.IOException {
        super.exportFile(format, response);
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_CREATE')")
    @Operation(summary = "Clone schedule version into a new DRAFT")
    public ResponseEntity<ScheduleVersionDTO> cloneVersion(
            @PathVariable Long id,
            @RequestParam(required = false) String note) {
        return ResponseEntity.ok(scheduleVersionService.cloneVersion(id, note));
    }

    @PutMapping("/{id}/activate")
    @PreAuthorize("hasAuthority('SCHEDULE_VERSION_UPDATE')")
    @Operation(summary = "Activate schedule version and archive the existing active version")
    public ResponseEntity<ScheduleVersionDTO> activateVersion(@PathVariable Long id) {
        return ResponseEntity.ok(scheduleVersionService.activateVersion(id));
    }
}

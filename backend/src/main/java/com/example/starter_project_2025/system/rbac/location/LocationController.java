package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/locations")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Location", description = "APIs for managing locations")
public class LocationController
        extends BaseCrudDataIoController<Location, Long, LocationDTO, LocationFilter> {

    LocationService locationService;
    LocationRepository locationRepository;
    LocationAiService locationAiService;
    LocationStaffService locationStaffService;
    LocationImportService locationImportService;

    @Override
    protected BaseCrudService<Long, LocationDTO, LocationFilter> getService() {
        return locationService;
    }

    @Override
    protected BaseCrudRepository<Location, Long> getRepository() {
        return locationRepository;
    }

    @Override
    protected Class<Location> getEntityClass() {
        return Location.class;
    }

    @GetMapping("/tree")
    public ResponseEntity<List<LocationTreeDTO>> getTree() {
        return ResponseEntity.ok(locationService.getTree());
    }

    @GetMapping("/ai/status")
    @PreAuthorize("hasAuthority('LOCATION_READ')")
    public ResponseEntity<LocationAiService.Status> getAiStatus() {
        return ResponseEntity.ok(locationAiService.getStatus());
    }

    @PostMapping("/ai/analyze")
    @PreAuthorize("hasAuthority('LOCATION_READ')")
    public ResponseEntity<LocationAiService.Analysis> analyzeWithAi() {
        return ResponseEntity.ok(locationAiService.analyze());
    }

    @GetMapping("/{locationId}/assignable-users")
    @PreAuthorize("hasAuthority('LOCATION_UPDATE')")
    public ResponseEntity<List<LocationStaffService.StaffCandidate>> findAssignableUsers(
            @PathVariable Long locationId,
            @RequestParam(required = false, defaultValue = "") String search
    ) {
        return ResponseEntity.ok(locationStaffService.findAssignableUsers(locationId, search));
    }

    @PostMapping("/{locationId}/users")
    @PreAuthorize("hasAuthority('LOCATION_UPDATE')")
    public ResponseEntity<Void> assignUser(
            @PathVariable Long locationId,
            @RequestBody LocationStaffService.AssignRequest request
    ) {
        locationStaffService.assignUsers(locationId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{locationId}/users/{userId}")
    @PreAuthorize("hasAuthority('LOCATION_UPDATE')")
    public ResponseEntity<Void> unassignUser(
            @PathVariable Long locationId,
            @PathVariable Long userId
    ) {
        locationStaffService.unassignUser(locationId, userId);
        return ResponseEntity.noContent().build();
    }

    @Override
    @GetMapping("/export")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws IOException {
        ByteArrayInputStream in = locationService.exportLocationsToExcel();

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=locations.xlsx");

        OutputStream out = response.getOutputStream();
        byte[] buffer = new byte[1024];
        int bytesRead;
        while ((bytesRead = in.read(buffer)) != -1) {
            out.write(buffer, 0, bytesRead);
        }
        out.flush();
    }

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        ImportResult result = importService.importFileAtomic(file, getEntityClass(), getRepository());

        if (result.getFailureCount() > 0) {
            return result;
        }

        List<Location> allLocations = locationRepository.findAll();
        locationService.processImportedLocations(allLocations);

        return result;
    }

    @PostMapping(value = "/import/preview", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('LOCATION_CREATE') or hasAuthority('LOCATION_UPDATE')")
    public ResponseEntity<LocationImportService.ImportPreview> previewImport(
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(locationImportService.preview(file));
    }
}
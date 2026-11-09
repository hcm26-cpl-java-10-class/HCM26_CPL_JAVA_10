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
        ImportResult result = importService.importFile(file, getEntityClass(), getRepository());

        List<Location> allLocations = locationRepository.findAll();
        locationService.processImportedLocations(allLocations);

        return result;
    }
}
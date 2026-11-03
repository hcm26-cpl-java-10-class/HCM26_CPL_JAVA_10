package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/external")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "External API", description = "APIs for fetching and managing data from the external system (hệ thống tổng)")
public class ExternalApiController {

    private static final String ALL_STATUSES = "all";

    ExternalApiService externalApiService;

    @GetMapping("/classes")
    @Operation(summary = "Fetch classes from external system",
            description = "status defaults to 'active'; pass status=all to list classes of every status")
    public ResponseEntity<List<ExternalClassDTO>> getClasses(
            @RequestParam(required = false, defaultValue = "active") String status) {
        return ResponseEntity.ok(externalApiService.fetchClasses(toUpstreamStatus(status)));
    }

    @GetMapping("/classes/{id}")
    @Operation(summary = "Fetch a single class by ID from external system")
    public ResponseEntity<ExternalClassDTO> getClassById(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassById(id));
    }

    @PostMapping("/classes")
    @Operation(summary = "Create a new class in the external system")
    public ResponseEntity<ExternalClassDTO> createClass(@RequestBody ExternalClassDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(externalApiService.createClass(dto));
    }

    @PutMapping("/classes/{id}")
    @Operation(summary = "Update an existing class in the external system")
    public ResponseEntity<ExternalClassDTO> updateClass(@PathVariable Long id, @RequestBody ExternalClassDTO dto) {
        return ResponseEntity.ok(externalApiService.updateClass(id, dto));
    }

    @DeleteMapping("/classes/{id}")
    @Operation(summary = "Delete a class in the external system")
    public ResponseEntity<Void> deleteClass(@PathVariable Long id) {
        externalApiService.deleteClass(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/classes/batch")
    @Operation(summary = "Batch import classes into the external system")
    public ResponseEntity<Map<String, Object>> batchImportClasses(@RequestBody List<ExternalClassDTO> dtoList) {
        return ResponseEntity.ok(externalApiService.batchImportClasses(dtoList));
    }

    @GetMapping("/trainers")
    @Operation(summary = "Fetch trainers from external system",
            description = "status defaults to 'active'; pass status=all to list trainers of every status")
    public ResponseEntity<List<ExternalTrainerDTO>> getTrainers(
            @RequestParam(required = false, defaultValue = "active") String status) {
        return ResponseEntity.ok(externalApiService.fetchTrainers(toUpstreamStatus(status)));
    }

    @GetMapping("/rooms")
    @Operation(summary = "Fetch rooms from external system")
    public ResponseEntity<List<ExternalRoomDTO>> getRooms() {
        return ResponseEntity.ok(externalApiService.fetchRooms());
    }

    /** "all" is our own marker for "no status filter"; the upstream system is simply not given a status. */
    private static String toUpstreamStatus(String status) {
        return status == null || ALL_STATUSES.equalsIgnoreCase(status.trim()) ? null : status;
    }
}

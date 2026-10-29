package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/external")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "External API", description = "APIs for fetching data from the external system (hệ thống tổng)")
public class ExternalApiController {

    ExternalApiService externalApiService;

    @GetMapping("/classes")
    @Operation(summary = "Fetch classes from external system")
    public ResponseEntity<List<ExternalClassDTO>> getClasses(
            @RequestParam(required = false, defaultValue = "active") String status) {
        return ResponseEntity.ok(externalApiService.fetchClasses(status));
    }

    @GetMapping("/classes/{id}")
    @Operation(summary = "Fetch a single class by ID from external system")
    public ResponseEntity<ExternalClassDTO> getClassById(@PathVariable Long id) {
        return ResponseEntity.ok(externalApiService.fetchClassById(id));
    }

    @GetMapping("/trainers")
    @Operation(summary = "Fetch trainers from external system")
    public ResponseEntity<List<ExternalTrainerDTO>> getTrainers(
            @RequestParam(required = false, defaultValue = "active") String status) {
        return ResponseEntity.ok(externalApiService.fetchTrainers(status));
    }

    @GetMapping("/rooms")
    @Operation(summary = "Fetch rooms from external system")
    public ResponseEntity<List<ExternalRoomDTO>> getRooms() {
        return ResponseEntity.ok(externalApiService.fetchRooms());
    }
}

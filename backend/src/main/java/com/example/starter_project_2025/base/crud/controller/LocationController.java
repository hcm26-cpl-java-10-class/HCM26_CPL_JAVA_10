package com.example.starter_project_2025.base.crud.controller;

import com.example.starter_project_2025.base.crud.domain.Location;
import com.example.starter_project_2025.base.crud.dto.LocationDTO;
import com.example.starter_project_2025.base.crud.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/locations")
@RequiredArgsConstructor
public class LocationController {
    private final LocationService locationService;

    @GetMapping
    public ResponseEntity<List<Location>> getAll() {
        return ResponseEntity.ok(locationService.getAllLocations());
    }

    @GetMapping("/tree")
    public ResponseEntity<List<LocationDTO>> getTree() {
        return ResponseEntity.ok(locationService.getLocationTree());
    }

    @PostMapping
    public ResponseEntity<Location> create(@RequestBody Location location) {
        return ResponseEntity.ok(locationService.createLocation(location));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        locationService.deleteLocation(id);
        return ResponseEntity.noContent().build();
    }
}
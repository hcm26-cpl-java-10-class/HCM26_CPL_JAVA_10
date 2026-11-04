package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
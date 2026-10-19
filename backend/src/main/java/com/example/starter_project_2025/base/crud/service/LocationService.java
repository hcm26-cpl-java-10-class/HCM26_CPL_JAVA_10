package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Location;
import com.example.starter_project_2025.base.crud.domain.LocationRepository;
import com.example.starter_project_2025.base.crud.dto.LocationDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    @Transactional(readOnly = true)
    public List<Location> getAllLocations() {
        return locationRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<LocationDTO> getLocationTree() {
        List<Location> allLocations = locationRepository.findAll();

        Map<Long, LocationDTO> dtoMap = allLocations.stream()
                .map(this::toDTO)
                .collect(Collectors.toMap(LocationDTO::getId, Function.identity()));

        List<LocationDTO> rootNodes = new ArrayList<>();

        for (LocationDTO dto : dtoMap.values()) {
            if (dto.getParentId() == null) {
                rootNodes.add(dto);
            } else {
                LocationDTO parent = dtoMap.get(dto.getParentId());
                if (parent != null) {
                    parent.getChildren().add(dto);
                }
            }
        }

        return rootNodes;
    }

    private LocationDTO toDTO(Location location) {
        LocationDTO dto = new LocationDTO();
        dto.setId(location.getId());
        dto.setCode(location.getCode());
        dto.setName(location.getName());
        dto.setParentId(location.getParentId());
        dto.setStatus(location.getStatus());
        dto.setIsActive(true);
        return dto;
    }

    @Transactional
    public Location createLocation(Location location) {
        if (locationRepository.existsByCode(location.getCode())) {
            throw new IllegalArgumentException("Location code already exists!");
        }
        return locationRepository.save(location);
    }

    @Transactional
    public void deleteLocation(Long id) {
        if (!locationRepository.existsById(id)) {
            throw new IllegalArgumentException("Location not found with id: " + id);
        }
        locationRepository.deleteById(id);
    }
}
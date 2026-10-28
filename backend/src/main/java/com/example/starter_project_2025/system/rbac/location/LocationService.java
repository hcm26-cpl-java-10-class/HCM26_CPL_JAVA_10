package com.example.starter_project_2025.system.rbac.location;

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

    public List<Location> getAllLocations() {
        return locationRepository.findAll();
    }

    public List<LocationDTO> getLocationTree() {
        List<Location> allLocations = locationRepository.findAll();

        Map<Long, LocationDTO> dtoMap = allLocations.stream()
                .map(this::toDTO)
                .collect(Collectors.toMap(
                        LocationDTO::getId,
                        Function.identity(),
                        (k1, k2) -> k1
                ));

        List<LocationDTO> rootNodes = new ArrayList<>();

        for (LocationDTO dto : dtoMap.values()) {
            if (dto.getParentId() == null) {
                rootNodes.add(dto);
            } else {
                LocationDTO parent = dtoMap.get(dto.getParentId());
                if (parent != null) {
                    parent.getChildren().add(dto);
                } else {
                    rootNodes.add(dto);
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
        dto.setChildren(new ArrayList<>());
        return dto;
    }

    @Transactional
    public Location createLocation(Location location) {
        if (location.getCode() == null || location.getCode().trim().isEmpty()) {
            throw new IllegalArgumentException("Location code cannot be empty!");
        }
        if (locationRepository.existsByCode(location.getCode())) {
            throw new IllegalArgumentException("Location code already exists!");
        }

        if (location.getStatus() == null) {
            location.setStatus("ACTIVE");
        }
        return locationRepository.save(location);
    }

    @Transactional
    public void deleteLocation(Long id) {

        List<Location> children = locationRepository.findByParentId(id);
        if (!children.isEmpty()) {
            throw new IllegalStateException("Cannot delete location with children! Please delete or move child locations first.");
        }
        locationRepository.deleteById(id);
    }
}
package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.Location;
import com.example.starter_project_2025.base.crud.domain.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    public List<Location> getAllLocations() {
        return locationRepository.findAll();
    }

    public Location createLocation(Location location) {
        if (locationRepository.existsByCode(location.getCode())) {
            throw new IllegalArgumentException("Location code already exists!");
        }
        return locationRepository.save(location);
    }

    public void deleteLocation(UUID id) {
        locationRepository.deleteById(id);
    }
}

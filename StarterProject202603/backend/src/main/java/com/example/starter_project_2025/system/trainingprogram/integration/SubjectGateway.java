package com.example.trainingprogram.integration;

import java.util.Optional;

/**
 * Adapter to Minh Hoang's Subject module.
 * Expected API fields: id, code, name, durationHours, isActive.
 */
public interface SubjectGateway {
    Optional<SubjectInfo> findById(Long id);
    record SubjectInfo(Long id, String code, String name, Integer durationHours, boolean active) {}
}

package com.example.starter_project_2025.system.external_api;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ManagedTeachingClassRepository extends JpaRepository<ManagedTeachingClass, Long> {
    Optional<ManagedTeachingClass> findByReferenceId(Long referenceId);
    boolean existsByNormalizedName(String normalizedName);
}

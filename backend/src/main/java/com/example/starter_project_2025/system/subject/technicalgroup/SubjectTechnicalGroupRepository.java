package com.example.starter_project_2025.system.subject.technicalgroup;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SubjectTechnicalGroupRepository extends JpaRepository<SubjectTechnicalGroup, Long> {
    boolean existsByNormalizedName(String normalizedName);
}

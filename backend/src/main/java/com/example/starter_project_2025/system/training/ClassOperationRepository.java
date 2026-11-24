package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassOperationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ClassOperationRepository extends JpaRepository<ClassOperationEntity, Long> {
    Optional<ClassOperationEntity> findByClassId(Long classId);
}


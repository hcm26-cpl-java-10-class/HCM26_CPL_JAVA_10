package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassActivityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassActivityEntityRepository extends JpaRepository<ClassActivityEntity, Long> {
    List<ClassActivityEntity> findByClassIdOrderByIdDesc(Long classId);
}


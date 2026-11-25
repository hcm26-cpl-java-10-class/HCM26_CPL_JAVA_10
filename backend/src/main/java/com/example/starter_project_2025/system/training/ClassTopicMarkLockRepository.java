package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassTopicMarkLockEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassTopicMarkLockRepository extends JpaRepository<ClassTopicMarkLockEntity, Long> {
    List<ClassTopicMarkLockEntity> findByClassId(Long classId);
    Optional<ClassTopicMarkLockEntity> findByClassIdAndTopicCode(Long classId, String topicCode);
}

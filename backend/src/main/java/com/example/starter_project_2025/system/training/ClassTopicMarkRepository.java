package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassTopicMarkEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClassTopicMarkRepository extends JpaRepository<ClassTopicMarkEntity, Long> {
    List<ClassTopicMarkEntity> findByClassIdOrderByTopicCodeAscTraineeIdAsc(Long classId);
    List<ClassTopicMarkEntity> findByClassIdAndTopicCodeOrderByTraineeIdAsc(Long classId, String topicCode);
}

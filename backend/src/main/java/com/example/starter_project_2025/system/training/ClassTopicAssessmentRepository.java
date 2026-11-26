package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassTopicAssessmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassTopicAssessmentRepository extends JpaRepository<ClassTopicAssessmentEntity, Long> {
    List<ClassTopicAssessmentEntity> findByTrainingClass_IdOrderByTopicIndexAsc(Long classId);
    void deleteByTrainingClass_Id(Long classId);
}


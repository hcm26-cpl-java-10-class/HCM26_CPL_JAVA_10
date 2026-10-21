package com.example.starter_project_2025.system.schedule.trainingclass;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TrainingClassRevisionRepository extends JpaRepository<TrainingClassRevision, Long> {
    List<TrainingClassRevision> findByTrainingClass_IdOrderByRevisionNoDesc(Long classId);
}

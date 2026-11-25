package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.ClassAttendanceEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClassAttendanceRepository extends JpaRepository<ClassAttendanceEntity, Long> {
    List<ClassAttendanceEntity> findByClassIdOrderByTraineeIdAsc(Long classId);

    Optional<ClassAttendanceEntity> findByClassIdAndTraineeId(Long classId, Long traineeId);
}

package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingCalendar;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TrainingCalendarRepository extends JpaRepository<TrainingCalendar, Long> {
    List<TrainingCalendar> findByClassIdOrderByRevisionDesc(Long classId);
}

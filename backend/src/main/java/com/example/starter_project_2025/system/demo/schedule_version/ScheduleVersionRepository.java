package com.example.starter_project_2025.system.demo.schedule_version;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduleVersionRepository extends BaseCrudRepository<ScheduleVersion, Long> {

    List<ScheduleVersion> findByClassId(Long classId);

    Optional<ScheduleVersion> findByClassIdAndStatus(Long classId, String status);

    Optional<ScheduleVersion> findTopByClassIdOrderByVersionNumberDesc(Long classId);
}

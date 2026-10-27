package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.FinalProjectGrade;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface FinalProjectGradeRepository extends JpaRepository<FinalProjectGrade, UUID> {
    Optional<FinalProjectGrade> findByTenantIdAndProjectIdAndTeamId(Long tenantId, Long projectId, Long teamId);
}

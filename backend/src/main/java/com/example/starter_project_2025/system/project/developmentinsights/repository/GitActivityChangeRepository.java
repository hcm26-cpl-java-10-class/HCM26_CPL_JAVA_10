package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitActivityChange;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GitActivityChangeRepository extends JpaRepository<GitActivityChange, Long> {
    @Query("select c from GitActivityChange c where c.processedAt is null and c.nextAttemptAt <= :now order by c.id")
    List<GitActivityChange> due(Instant now, Pageable page);
    List<GitActivityChange> findByRepository_IdAndProcessedAtIsNullAndIdLessThanEqual(Long repositoryId, Long id);
}

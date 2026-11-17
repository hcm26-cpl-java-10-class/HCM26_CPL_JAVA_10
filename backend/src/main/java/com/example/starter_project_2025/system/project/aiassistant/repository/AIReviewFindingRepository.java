package com.example.starter_project_2025.system.project.aiassistant.repository;

import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AIReviewFindingRepository
        extends JpaRepository<AIReviewFinding, Long> {

    List<AIReviewFinding> findAllByReport_IdOrderByCreatedAtAsc(Long reportId);

    Optional<AIReviewFinding> findByIdAndReport_Id(
            Long findingId,
            Long reportId
    );

}

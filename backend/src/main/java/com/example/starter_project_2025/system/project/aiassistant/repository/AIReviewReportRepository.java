package com.example.starter_project_2025.system.project.aiassistant.repository;

import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AIReviewReportRepository
        extends JpaRepository<AIReviewReport, Long> {

    List<AIReviewReport> findAllByProjectTemplate_IdOrderByCreatedAtDesc(
            Long templateId
    );

    Optional<AIReviewReport> findByIdAndProjectTemplate_Id(
            Long reportId,
            Long templateId
    );
}
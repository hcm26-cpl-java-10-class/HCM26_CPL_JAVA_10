package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubmissionVersionRepository extends JpaRepository<SubmissionVersion, UUID> {
    Optional<SubmissionVersion> findBySubmissionIdAndVersionNumber(UUID submissionId, int versionNumber);
    List<SubmissionVersion> findAllBySubmissionIdOrderByVersionNumberDesc(UUID submissionId);
}

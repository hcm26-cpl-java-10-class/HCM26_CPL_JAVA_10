package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionOutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SubmissionOutboxRepository extends JpaRepository<SubmissionOutboxEvent, UUID> {
}

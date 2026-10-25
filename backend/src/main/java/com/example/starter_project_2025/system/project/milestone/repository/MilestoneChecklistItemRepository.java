package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MilestoneChecklistItemRepository extends JpaRepository<MilestoneChecklistItem, UUID> {
}

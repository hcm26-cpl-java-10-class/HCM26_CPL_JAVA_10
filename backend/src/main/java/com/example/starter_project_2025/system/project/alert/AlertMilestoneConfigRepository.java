package com.example.starter_project_2025.system.project.alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface AlertMilestoneConfigRepository extends JpaRepository<ProjectAlertData.MilestoneConfig,UUID> { }

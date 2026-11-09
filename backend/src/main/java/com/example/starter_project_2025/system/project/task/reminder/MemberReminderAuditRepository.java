package com.example.starter_project_2025.system.project.task.reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface MemberReminderAuditRepository extends JpaRepository<MemberReminderData.Audit,UUID>{}

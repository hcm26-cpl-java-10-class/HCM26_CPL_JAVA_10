package com.example.starter_project_2025.system.project.task.alert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface TaskAlertMemberLinkRepository extends JpaRepository<TaskAlertData.MemberLink, UUID> {
    List<TaskAlertData.MemberLink> findByProjectId(UUID projectId);
}

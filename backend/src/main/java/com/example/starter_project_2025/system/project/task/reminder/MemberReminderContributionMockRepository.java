package com.example.starter_project_2025.system.project.task.reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MemberReminderContributionMockRepository extends JpaRepository<MemberReminderData.ContributionMock,UUID>{
    List<MemberReminderData.ContributionMock> findByProjectId(UUID projectId);
}

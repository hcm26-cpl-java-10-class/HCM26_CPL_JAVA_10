package com.example.starter_project_2025.system.project.task.reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface MemberReminderBatchRepository extends JpaRepository<MemberReminderData.Batch,UUID>{
    Optional<MemberReminderData.Batch> findByActorIdAndRequestId(Long actorId,UUID requestId);
}

package com.example.starter_project_2025.system.project.task.reminder;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface MemberReminderItemRepository extends JpaRepository<MemberReminderData.Item,UUID>{
    interface LastReminder {Long getUserId();Instant getCreatedAt();}
    @Query("select i.recipientUserId as userId,max(i.batch.createdAt) as createdAt from MemberReminderItem i where i.batch.projectId=:projectId and i.batch.tenantId=:tenantId group by i.recipientUserId")
    List<LastReminder> lastReminders(@Param("projectId") UUID projectId,@Param("tenantId") Long tenantId);
    @Query("select i from MemberReminderItem i where i.batch.projectId=:projectId and i.batch.tenantId=:tenantId and i.recipientUserId=:userId order by i.batch.createdAt desc")
    List<MemberReminderData.Item> history(@Param("projectId") UUID projectId,@Param("tenantId") Long tenantId,@Param("userId") Long userId);
}

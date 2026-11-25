package com.example.starter_project_2025.system.project.alert;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface ProjectAlertRecipientRepository extends JpaRepository<ProjectAlertData.Recipient,UUID> {
    interface LastReminder { Long getUserId(); Instant getCreatedAt(); }
    @Query("select r.userId as userId, max(r.batch.createdAt) as createdAt from ProjectAlertRecipient r " +
            "where r.batch.teamId=:teamId and r.batch.tenantId=:tenantId and r.batch.kind=:kind group by r.userId")
    List<LastReminder> lastReminders(@Param("teamId") Long teamId,@Param("tenantId") Long tenantId,
                                   @Param("kind") ProjectAlertDtos.Kind kind);
}

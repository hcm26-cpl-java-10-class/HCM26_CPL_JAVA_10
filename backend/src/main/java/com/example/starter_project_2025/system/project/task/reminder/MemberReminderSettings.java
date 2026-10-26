package com.example.starter_project_2025.system.project.task.reminder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.time.*;
@Component
public class MemberReminderSettings {
    private final Duration inactiveWindow;
    private final Duration cooldown;
    private final ZoneId auditZone;
    public MemberReminderSettings(@Value("${app.member-reminder.inactive-days:7}") int inactiveDays,
            @Value("${app.member-reminder.cooldown-seconds:86400}") long cooldownSeconds,
            @Value("${app.member-reminder.audit-time-zone:}") String zone) {
        if(inactiveDays<1 || cooldownSeconds<1)throw new IllegalArgumentException("Reminder thresholds must be positive");
        inactiveWindow=Duration.ofDays(inactiveDays);cooldown=Duration.ofSeconds(cooldownSeconds);
        auditZone=zone.isBlank()?ZoneId.systemDefault():ZoneId.of(zone);
    }
    public Duration inactiveWindow(){return inactiveWindow;}
    public Duration cooldown(){return cooldown;}
    public ZoneId auditZone(){return auditZone;}
}

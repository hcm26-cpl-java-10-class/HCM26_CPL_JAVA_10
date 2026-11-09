package com.example.starter_project_2025.system.project.task.reminder;
/** UFR-COM: private in-app/email delivery per recipient; deduplicate event_id/user_id/channel.
 * No delivery worker or no-op success adapter is installed. */
public interface MemberReminderNotificationPort {
    void deliver(MemberReminderDtos.Event event);
}

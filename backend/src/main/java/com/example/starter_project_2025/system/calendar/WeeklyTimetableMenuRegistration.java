package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/**
 * Marker class for AutoMenuInitializer to register the unified "Calendar" sidebar entry.
 */
@ResourceMenu(
        title = "Calendar",
        group = "Training Management",
        icon = "calendar",
        url = "/calendar",
        order = 2,
        permission = "SESSION_READ"
)
public class WeeklyTimetableMenuRegistration {
}


package com.example.starter_project_2025.system.calendar;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/**
 * Marker class for AutoMenuInitializer to register the "Weekly Timetable" sidebar entry.
 */
@ResourceMenu(
        title = "Weekly Timetable",
        group = "Training Management",
        icon = "calendar",
        url = "/calendar/preview",
        order = 2,
        permission = "SESSION_READ"
)
public class WeeklyTimetableMenuRegistration {
}


package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/**
 * Marker class for AutoMenuInitializer to register the "Training Calendar" sidebar entry.
 * Created for Nguyen Ngoc Tan's Training Calendar module.
 */
@ResourceMenu(
        title = "Training Calendar",
        group = "Training Management",
        icon = "calendar",
        url = "/calendar/adjust",
        order = 1,
        permission = "SESSION_READ"
)
public class CalendarAdjustMenuRegistration {
}

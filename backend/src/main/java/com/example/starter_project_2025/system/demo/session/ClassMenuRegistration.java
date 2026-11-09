package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/**
 * Marker class so AutoMenuInitializer can register the "Class List" sidebar entry.
 * Classes are not stored locally: the page reads them from the master training system through
 * /api/external/classes, and the class schedule is managed through /api/sessions.
 */
@ResourceMenu(
        title = "Class List",
        group = "Training Management",
        icon = "graduation-cap",
        url = "/classes",
        order = 3,
        permission = "SESSION_READ"
)
public class ClassMenuRegistration {
}

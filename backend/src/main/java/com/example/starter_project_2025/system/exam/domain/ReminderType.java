package com.example.starter_project_2025.system.exam.domain;

public enum ReminderType {
    ONE_HOUR("1 hour before exam"),
    ONE_DAY("1 day before exam"),
    CUSTOM("Custom scheduled reminder");

    private final String description;

    ReminderType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}

package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;

/** The project is not ready to be finalized (mandatory milestones or child projects are still pending). */
public class ProjectNotReadyException extends MilestoneConflictException {
    public static final String CODE = "PROJECT_NOT_READY";

    public ProjectNotReadyException(String message) {
        super(message);
    }
}

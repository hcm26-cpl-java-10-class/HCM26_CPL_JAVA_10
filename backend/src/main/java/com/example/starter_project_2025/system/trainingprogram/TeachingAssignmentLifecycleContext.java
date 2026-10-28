package com.example.starter_project_2025.system.trainingprogram;

/** Local lifecycle actions remain available even when shared profiles are unavailable. */
public record TeachingAssignmentLifecycleContext(TeachingAssignmentResponse assignment, long linkedSessionCount, boolean canDelete, boolean previouslyUsed) {}

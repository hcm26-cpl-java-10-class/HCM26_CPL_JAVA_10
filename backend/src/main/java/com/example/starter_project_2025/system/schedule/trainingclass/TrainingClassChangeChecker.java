package com.example.starter_project_2025.system.schedule.trainingclass;

/** Integration boundary: validate proposed schedule, enrollment and resource changes before publication. */
public interface TrainingClassChangeChecker {
    void validateForApproval(TrainingClass publishedClass, TrainingClassRevision proposedRevision);
}

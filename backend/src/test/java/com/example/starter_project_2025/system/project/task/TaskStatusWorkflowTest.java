package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TaskStatusWorkflowTest {

    private final TaskStatusWorkflow workflow = new TaskStatusWorkflow();

    @Test
    void allowsAdjacentForwardAndBackwardTransitions() {
        // Forward transitions
        assertTrue(workflow.allows(TaskStatus.TODO, TaskStatus.IN_PROGRESS));
        assertTrue(workflow.allows(TaskStatus.IN_PROGRESS, TaskStatus.REVIEW));
        assertTrue(workflow.allows(TaskStatus.REVIEW, TaskStatus.DONE));
        
        // Backward / exceptional transitions
        assertTrue(workflow.allows(TaskStatus.IN_PROGRESS, TaskStatus.TODO));      // Pause
        assertTrue(workflow.allows(TaskStatus.REVIEW, TaskStatus.IN_PROGRESS));   // Reject/return
        assertTrue(workflow.allows(TaskStatus.DONE, TaskStatus.REVIEW));          // Adjacent backward step
    }

    @Test
    void rejectsInvalidTransitions() {
        // Skip transitions
        assertFalse(workflow.allows(TaskStatus.TODO, TaskStatus.REVIEW));
        assertFalse(workflow.allows(TaskStatus.TODO, TaskStatus.DONE));
        assertFalse(workflow.allows(TaskStatus.IN_PROGRESS, TaskStatus.DONE));
        
        // Invalid backward
        assertFalse(workflow.allows(TaskStatus.REVIEW, TaskStatus.TODO));
        assertFalse(workflow.allows(TaskStatus.DONE, TaskStatus.TODO));
        assertFalse(workflow.allows(TaskStatus.DONE, TaskStatus.IN_PROGRESS));
        
    }
}

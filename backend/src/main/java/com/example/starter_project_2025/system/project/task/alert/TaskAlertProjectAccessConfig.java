package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.system.project.task.TaskProjectAccess;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;

@Configuration
public class TaskAlertProjectAccessConfig {
    @Bean @ConditionalOnMissingBean(TaskProjectAccess.class)
    public TaskProjectAccess taskProjectAccess(TaskAlertAccess access) {
        return access.directory();
    }
}

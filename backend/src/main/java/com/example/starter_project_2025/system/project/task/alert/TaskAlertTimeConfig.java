package com.example.starter_project_2025.system.project.task.alert;
import org.springframework.context.annotation.*;
import java.time.Clock;
@Configuration
public class TaskAlertTimeConfig {
    @Bean("taskAlertClock") public Clock taskAlertClock() { return Clock.systemUTC(); }
}

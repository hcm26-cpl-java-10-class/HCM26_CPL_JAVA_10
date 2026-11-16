package com.example.starter_project_2025.config.startup;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Keeps job/service beans available while allowing automatic database writers to pause. */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(prefix = "app.scheduling", name = "enabled",
        havingValue = "true", matchIfMissing = true)
public class SchedulingConfiguration {
}

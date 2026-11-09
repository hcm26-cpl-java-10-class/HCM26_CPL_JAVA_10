package com.example.starter_project_2025.system.project.alert;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
import java.util.Map;
@Configuration
public class ProjectAlertIntegrationConfig {
    @Bean @ConditionalOnMissingBean(AlertExternalContributions.class)
    AlertExternalContributions alertExternalContributions() {return (team,project,actors,now)->Map.of();}
}

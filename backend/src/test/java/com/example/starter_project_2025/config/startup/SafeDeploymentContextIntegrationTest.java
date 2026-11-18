package com.example.starter_project_2025.config.startup;

import com.example.starter_project_2025.system.trainer.TrainerController;
import com.example.starter_project_2025.system.trainer.TrainerService;
import com.example.starter_project_2025.system.training.ClassOperationDatabaseService;
import com.example.starter_project_2025.system.training.TrainingClassService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.config.TaskManagementConfigUtils;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:safe_startup_context;DB_CLOSE_DELAY=-1",
    "app.startup.mutations-enabled=false", "app.scheduling.enabled=false", "spring.sql.init.mode=never"
})
@ActiveProfiles("test")
class SafeDeploymentContextIntegrationTest {
    @Autowired ApplicationContext context;
    @Autowired JdbcTemplate jdbc;

    @Test
    void preservationStartupKeepsApplicationAndSecurityButCreatesNoBusinessOrAccessData() {
        assertThat(context.getBeansWithAnnotation(StartupMutation.class)).isEmpty();
        assertThat(context.containsBean(TaskManagementConfigUtils.SCHEDULED_ANNOTATION_PROCESSOR_BEAN_NAME)).isFalse();
        assertThat(context.getBean(TrainerController.class)).isNotNull();
        assertThat(context.getBean(TrainerService.class)).isNotNull();
        assertThat(context.getBean(TrainingClassService.class)).isNotNull();
        assertThat(context.getBean(ClassOperationDatabaseService.class)).isNotNull();
        assertThat(context.getBeansOfType(SecurityFilterChain.class)).isNotEmpty();
        for (String table : new String[]{"TRAINERS", "TRAINING_OPERATION_CLASSES", "TRAINING_PROGRAMS",
                "CLASS_OPERATIONS", "USERS", "ROLES", "PERMISSIONS", "ROLE_PERMISSIONS"}) {
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class)).as(table).isZero();
        }
    }
}

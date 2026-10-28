
package com.example.starter_project_2025;

import com.example.trainingprogram.controller.TrainingProgramController;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@EnableAsync(proxyTargetClass = true)
@SpringBootApplication(
    scanBasePackages = {
        "com.example.starter_project_2025",
        "com.example.trainingprogram"
    },
    excludeFilters = @ComponentScan.Filter(
        type = FilterType.ASSIGNABLE_TYPE,
        classes = TrainingProgramController.class
    )
)
@EntityScan(basePackages = {
    "com.example.starter_project_2025",
    "com.example.trainingprogram"
})
@EnableJpaRepositories(basePackages = {
    "com.example.starter_project_2025",
    "com.example.trainingprogram"
})
public class StarterProject2025Application {

    public static void main(String[] args) {
        SpringApplication.run(
            StarterProject2025Application.class, args
        );
    }
}

package com.example.starter_project_2025.system.git_integration.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.jdbctemplate.JdbcTemplateLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

/**
 * SY-01: ShedLock for scheduled jobs that must run on one instance at a time (the periodic
 * commit reconcile). Locks live in the {@code shedlock} table ({@link ShedLockSchemaInitializer})
 * and use the database clock, so instances with drifting clocks still agree.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class GitSyncSchedulingConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(JdbcTemplateLockProvider.Configuration.builder()
                .withJdbcTemplate(new JdbcTemplate(dataSource))
                .usingDbTime()
                .build());
    }
}

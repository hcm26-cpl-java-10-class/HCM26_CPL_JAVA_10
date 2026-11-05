package com.example.starter_project_2025.system.project.milestone.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class MilestoneTimeConfig {
    @Bean
    public Clock milestoneClock() {
        return Clock.systemUTC();
    }
}

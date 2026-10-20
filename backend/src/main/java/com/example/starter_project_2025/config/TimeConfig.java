package com.example.starter_project_2025.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class TimeConfig {

    @Bean
    public Clock applicationClock() {
        return Clock.systemDefaultZone();
    }
}

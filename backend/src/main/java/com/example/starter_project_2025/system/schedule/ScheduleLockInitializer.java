package com.example.starter_project_2025.system.schedule;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;

@Component @Order(-100)
@RequiredArgsConstructor
public class ScheduleLockInitializer implements ApplicationRunner {
    private final ScheduleWriteLockRepository repository;
    @Override
    public void run(ApplicationArguments args) {
        if (repository.existsById(1L)) return;
        try {
            repository.saveAndFlush(new ScheduleWriteLock(1L));
        } catch (DataIntegrityViolationException ex) {
            // Another application instance can seed the singleton concurrently.
            if (!repository.existsById(1L)) throw ex;
        }
    }
}

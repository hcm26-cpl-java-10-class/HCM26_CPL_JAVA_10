package com.example.starter_project_2025.system.subject.technicalgroup;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Arrays;

@Component
@Order(30)
public class SubjectTechnicalGroupInitializer implements CommandLineRunner {
    private final SubjectTechnicalGroupService service;
    private final String initialNames;

    public SubjectTechnicalGroupInitializer(SubjectTechnicalGroupService service,
            @Value("${subject.technical-groups.initial:}") String initialNames) {
        this.service = service;
        this.initialNames = initialNames;
    }

    @Override public void run(String... args) { service.initialize(Arrays.asList(initialNames.split(","))); }
}

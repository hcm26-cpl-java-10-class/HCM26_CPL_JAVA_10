package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.exception.BadRequestException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("dev1-demo")
public class MockProgramVersionChecker implements ProgramVersionChecker {

    @Override
    public void validateForClass(Long programVersionId) {
        if (!Long.valueOf(1L).equals(programVersionId)) {
            throw new BadRequestException(
                    "Dữ liệu mẫu chỉ cho phép programVersionId = 1"
            );
        }
    }
}
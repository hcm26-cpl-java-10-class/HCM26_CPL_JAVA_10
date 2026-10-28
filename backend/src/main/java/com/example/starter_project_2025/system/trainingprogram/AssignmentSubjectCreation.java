package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.subject.*;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssignmentSubjectCreation {
    private final SubjectService subjects;

    public record Request(@NotBlank @Size(max = 200) String name, @NotNull @Positive Integer durationHours) {}

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    @Transactional(propagation = Propagation.MANDATORY)
    public Long create(Request request) {
        var subject = SubjectDTO.builder().code("SUB_" + UUID.randomUUID().toString().replace("-", ""))
                .name(request.name().strip()).version("1.0").status(SubjectStatus.ACTIVE).durationHours(request.durationHours()).build();
        subject.setIsActive(true);
        return subjects.create(subject).getId();
    }
}

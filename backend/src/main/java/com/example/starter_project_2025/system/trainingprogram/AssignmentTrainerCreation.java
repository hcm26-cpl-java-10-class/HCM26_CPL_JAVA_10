package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.external_api.*;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AssignmentTrainerCreation {
    private final ManagedTeachingTrainerRepository trainers;
    private final ManagedTrainerDirectory directory;
    private final ExternalApiService external;
    private final TeachingAssignmentSessionGuard guard;

    public record Request(@NotBlank @Size(max = 200) String name, @NotBlank @Email @Size(max = 200) String email) {}

    @Transactional
    public ExternalTrainerDTO create(Request request) {
        guard.lockForWrite();
        String name = request.name().strip().replaceAll("\\s+", " ");
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        var existing = external.fetchTrainers(null);
        var matches = existing.stream().filter(t -> email.equalsIgnoreCase(Objects.toString(t.getEmail(), "").strip())).toList();
        if (!matches.isEmpty()) {
            var trainer = matches.get(0);
            if (matches.size() != 1 || !name.equalsIgnoreCase(Objects.toString(trainer.getName(), "").strip().replaceAll("\\s+", " "))
                    || !"active".equalsIgnoreCase(trainer.getStatus())) {
                throw new ConflictException("This email already belongs to another or inactive trainer. Check the name and email.");
            }
            return trainer;
        }
        var ids = new HashSet<Long>(); existing.forEach(t -> ids.add(t.getId()));
        long reference;
        do { reference = UUID.randomUUID().getMostSignificantBits() >>> 12; } while (reference == 0 || ids.contains(reference));
        var trainer = new ManagedTeachingTrainer(); trainer.setReferenceId(reference); trainer.setName(name); trainer.setEmail(email);
        trainers.saveAndFlush(trainer);
        return directory.profile(trainer);
    }

    @RestController
    @RequiredArgsConstructor
    @RequestMapping("/api/teaching-assignments/trainers")
    @PreAuthorize("hasAnyAuthority('ASSIGNMENT_CREATE', 'ASSIGNMENT_UPDATE') and hasAuthority('TRAINER_CREATE')")
    public static class Controller {
        private final AssignmentTrainerCreation creation;
        @PostMapping
        public ExternalTrainerDTO create(@Valid @RequestBody Request request) { return creation.create(request); }
    }
}

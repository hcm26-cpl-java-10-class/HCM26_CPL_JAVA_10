package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@Profile("dev1-demo")
@RequiredArgsConstructor
public class MockOpenClassRequestChecker
        implements OpenClassRequestChecker {

    private final ObjectProvider<ProgramVersionChecker> checkerProvider;

    private record RequestData(
            String status,
            Long programVersionId,
            String label,
            String programLabel) {
    }

    private static final Map<Long, RequestData> REQUESTS = Map.of(
            101L, new RequestData(
                    "APPROVED",
                    1L,
                    "OCR-101 — Java training request",
                    "Java Fundamentals — Demo version 1"
            ),
            102L, new RequestData(
                    "UNDER_REVIEW",
                    1L,
                    "OCR-102 — Pending review",
                    "Java Fundamentals — Demo version 1"
            ),
            103L, new RequestData(
                    "REJECTED",
                    1L,
                    "OCR-103 — Rejected request",
                    "Java Fundamentals — Demo version 1"
            ),
            104L, new RequestData(
                    "APPROVED",
                    2L,
                    "OCR-104 — Alternative program request",
                    "Alternative Program — Demo version 2"
            )
    );

    @Override
    public void validateForCreate(
            Long requestId,
            Long programVersionId) {

        RequestData request = requestId == null
                ? null
                : REQUESTS.get(requestId);

        if (request == null) {
            throw new ResourceNotFoundException(
                    "Open class request not found"
            );
        }

        if (!"APPROVED".equals(request.status())) {
            throw new ConflictException(
                    "Open class request must be approved before creating a class"
            );
        }

        if (!Objects.equals(
                request.programVersionId(),
                programVersionId)) {
            throw new ConflictException(
                    "Training program version does not match the approved request"
            );
        }
    }

    @Override
    public List<CreateOption> getCreateOptions() {
        ProgramVersionChecker checker = checkerProvider.getIfAvailable();

        if (checker == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Program version validation is unavailable"
            );
        }

        return REQUESTS.entrySet().stream()
                .filter(entry ->
                        "APPROVED".equals(entry.getValue().status()))
                .filter(entry -> {
                    try {
                        checker.validateForClass(
                                entry.getValue().programVersionId()
                        );
                        return true;
                    } catch (BadRequestException exception) {
                        return false;
                    }
                })
                .map(entry -> new CreateOption(
                        entry.getKey(),
                        entry.getValue().label(),
                        entry.getValue().programVersionId(),
                        entry.getValue().programLabel()
                ))
                .sorted(Comparator.comparing(CreateOption::id))
                .toList();
    }
}
package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.subject.*;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.UUID;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import com.example.starter_project_2025.exception.BusinessValidationException;

@Service
@RequiredArgsConstructor
public class AssignmentSubjectCreation {
    private final SubjectService subjects;

    public record Request(@NotBlank @Size(max = 200) String name,
                          @Positive @DecimalMax("2147483647") @Digits(integer = 10, fraction = 9) BigDecimal durationHours) {}

    public Request resolveDuration(Request request, List<AssignmentTeachingSlot> slots) {
        if (slots != null && !slots.isEmpty()) {
            if (slots.size() > 200) throw new BusinessValidationException(Map.of("teachingSlots", List.of("Add between 1 and 200 teaching slots.")));
            long minutes = 0;
            for (int i = 0; i < slots.size(); i++) minutes += AssignmentTeachingSlotPolicy.durationMinutes(slots.get(i), "teachingSlots[" + i + "]");
            // The dated intervals retain exact minutes. Fractional catalogue hours preserve
            // them to nine decimal places, instead of rounding up to whole hours.
            return new Request(request.name(), BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 9, RoundingMode.HALF_UP).stripTrailingZeros());
        }
        if (request.durationHours() == null) throw new BusinessValidationException(Map.of("teachingSlots",
                List.of("Add teaching slots to calculate the subject duration.")));
        return request; // Legacy imports without slots still supply their catalogue duration.
    }

    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    @Transactional(propagation = Propagation.MANDATORY)
    public Long create(Request request) {
        var subject = SubjectDTO.builder().code("SUB_" + UUID.randomUUID().toString().replace("-", ""))
                .name(request.name().strip()).version("1.0").status(SubjectStatus.ACTIVE).durationHours(request.durationHours()).build();
        subject.setIsActive(true);
        return subjects.create(subject).getId();
    }
}

package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional
public class SyllabusCloService {

    private final SyllabusRepository syllabuses;
    private final SyllabusCloRepository clos;

    public record CloInput(String details) {}

    public record CloView(
            Long id,
            String code,
            String details,
            Integer orderIndex
    ) {}

    private static void fail(String field, String message) {
        throw new BusinessValidationException(
                Map.of(field, List.of(message))
        );
    }

    private Syllabus requireSyllabus(Long id) {
        if (id == null || id <= 0) {
            fail("syllabusId", "Invalid Syllabus ID");
        }

        return syllabuses.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Syllabus not found"
                        )
                );
    }

    private SyllabusClo requireClo(
            Long syllabusId,
            Long cloId
    ) {
        SyllabusClo clo = clos.findById(cloId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "CLO not found"
                        )
                );

        if (!Objects.equals(
                clo.getSyllabus().getId(),
                syllabusId
        )) {
            throw new ResourceNotFoundException(
                    "CLO does not belong to this Syllabus"
            );
        }

        return clo;
    }

    private static String validateDetails(String raw) {
        String value = raw == null
                ? ""
                : raw.strip().replaceAll("(?U)\\s+", " ");

        if (value.length() < 10 || value.length() > 2000) {
            fail(
                    "details",
                    "CLO Details must be 10-2000 characters"
            );
        }

        if (value.codePoints().noneMatch(Character::isLetter)) {
            fail("details", "CLO Details must contain letters");
        }

        return value;
    }

    private static CloView view(SyllabusClo clo) {
        return new CloView(
                clo.getId(),
                clo.getCode(),
                clo.getDetails(),
                clo.getOrderIndex()
        );
    }

    @Transactional(readOnly = true)
    public List<CloView> list(Long syllabusId) {
        requireSyllabus(syllabusId);

        return clos
                .findBySyllabus_IdOrderByOrderIndexAsc(syllabusId)
                .stream()
                .map(SyllabusCloService::view)
                .toList();
    }

    public CloView create(Long syllabusId, CloInput input) {
        Syllabus syllabus = requireSyllabus(syllabusId);

        if (input == null) {
            fail("details", "Request body is required");
        }

        String details = validateDetails(input.details());

        List<SyllabusClo> existing =
                clos.findBySyllabus_IdOrderByOrderIndexAsc(
                        syllabusId
                );

        if (existing.stream().anyMatch(c ->
                c.getDetails().equalsIgnoreCase(details))) {
            fail("details", "This CLO already exists");
        }

        int highestNumber = 0;
        int highestOrder = 0;

        for (SyllabusClo clo : existing) {
            highestOrder = Math.max(
                    highestOrder,
                    clo.getOrderIndex()
            );

            String code = clo.getCode();

            if (code != null &&
                    code.toUpperCase(Locale.ROOT)
                            .matches("CLO[0-9]+")) {
                try {
                    highestNumber = Math.max(
                            highestNumber,
                            Integer.parseInt(code.substring(3))
                    );
                } catch (NumberFormatException ignored) {
                    // Ignore invalid legacy numbering.
                }
            }
        }

        if (highestNumber == Integer.MAX_VALUE ||
                highestOrder == Integer.MAX_VALUE) {
            fail("code", "CLO numbering limit exceeded");
        }

        SyllabusClo clo = new SyllabusClo();
        clo.setSyllabus(syllabus);
        clo.setCode("CLO" + (highestNumber + 1));
        clo.setOrderIndex(highestOrder + 1);
        clo.setDetails(details);

        return view(clos.saveAndFlush(clo));
    }

    public CloView update(
            Long syllabusId,
            Long cloId,
            CloInput input
    ) {
        SyllabusClo clo = requireClo(syllabusId, cloId);

        if (input == null) {
            fail("details", "Request body is required");
        }

        String details = validateDetails(input.details());

        boolean duplicate = clos
                .findBySyllabus_IdOrderByOrderIndexAsc(syllabusId)
                .stream()
                .anyMatch(other ->
                        !Objects.equals(other.getId(), cloId)
                                && other.getDetails().equalsIgnoreCase(details)
                );

        if (duplicate) {
            fail("details", "This CLO already exists");
        }

        clo.setDetails(details);

        return view(clos.saveAndFlush(clo));
    }

    public void delete(Long syllabusId, Long cloId) {
        SyllabusClo clo = requireClo(syllabusId, cloId);
        clos.delete(clo);
    }
}
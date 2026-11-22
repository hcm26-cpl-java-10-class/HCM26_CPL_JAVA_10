package com.example.starter_project_2025.system.demo.syllabus.validation;

import org.junit.jupiter.api.Test;
import com.example.starter_project_2025.exception.BusinessValidationException;
import static org.junit.jupiter.api.Assertions.*;

class SyllabusInputValidatorTest {
    @Test void normalizesWhitespaceWithoutChangingSemantics() {
        assertEquals("My Topic", SyllabusInputValidator.clean("  My  Topic  "));
        assertEquals("my topic", SyllabusInputValidator.key("  My  Topic  "));
    }
    @Test void rejectsDuplicateInvalidTitleAndNegativeOrder() {
        assertThrows(BusinessValidationException.class,
                () -> SyllabusInputValidator.requiredTitle("12", 150, "title"));
        assertThrows(BusinessValidationException.class,
                () -> SyllabusInputValidator.requiredOrder(-1));
    }
    @Test void keepsMissionAndInformationLimits() {
        assertEquals("Mission", SyllabusInputValidator.validMission(" Mission "));
        assertThrows(BusinessValidationException.class,
                () -> SyllabusInputValidator.validMission("m".repeat(2001)));
        assertThrows(BusinessValidationException.class,
                () -> SyllabusInputValidator.informationText("x".repeat(501), 500, "teachingMethods"));
    }
}

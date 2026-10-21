package com.example.starter_project_2025.system.subject;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;

class SubjectExceptionHandlerTest {
    private final SubjectExceptionHandler handler = new SubjectExceptionHandler();

    @Test
    void duplicateConstraintProducesAFieldConflictWithoutSqlDetails() {
        var error = new DataIntegrityViolationException("insert into subjects: private SQL details",
                new ConstraintViolationException("duplicate key", new SQLException("private SQL details"),
                        "PUBLIC.UK_SUBJECT_CODE_VERSION_INDEX_1"));
        var response = handler.handleIntegrityViolation(error);
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getErrors().containsKey("code"));
        assertTrue(response.getBody().getMessage().contains("already exists"));
        assertFalse(response.getBody().getMessage().contains("SQL"));
    }

    @Test
    void unrelatedDatabaseConstraintIsNotMisreportedAsADuplicate() {
        var error = new DataIntegrityViolationException("column length: private SQL details");
        var response = handler.handleIntegrityViolation(error);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().getErrors().isEmpty());
        assertFalse(response.getBody().getMessage().contains("already exists"));
        assertFalse(response.getBody().getMessage().contains("SQL"));
    }
}

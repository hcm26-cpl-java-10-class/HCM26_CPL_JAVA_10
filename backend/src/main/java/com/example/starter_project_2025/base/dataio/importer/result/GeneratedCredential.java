package com.example.starter_project_2025.base.dataio.importer.result;

/**
 * A secret the system generated for a row of the import (for users: the temporary password). It is
 * returned once to the person who ran the import so it can be handed out; it is not stored anywhere
 * in readable form.
 */
public record GeneratedCredential(int rowNumber, String email, String temporaryPassword) {
}

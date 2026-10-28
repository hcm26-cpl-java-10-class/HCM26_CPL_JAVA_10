package com.example.starter_project_2025.base.dataio.importer.result;

import jakarta.persistence.PersistenceException;
import org.springframework.dao.DataAccessException;

public class ImportRolledBackException extends RuntimeException {

    private final transient ImportResult result;

    public ImportRolledBackException(ImportResult result) {
        super("Import rolled back: " + result.getFailureCount() + " row(s) failed, nothing was imported");
        result.setSuccessCount(0);
        result.setRolledBack(true);
        this.result = result;
    }

    public ImportResult getResult() {
        return result;
    }

    public static String describe(Throwable error) {
        if (!isPersistenceFailure(error)) {
            return error.getMessage();
        }
        Throwable root = error;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = root.getMessage() != null ? root.getMessage() : error.getMessage();
        if (message == null) {
            message = error.getClass().getSimpleName();
        }
        int sql = message.indexOf("; SQL statement");
        if (sql > 0) {
            message = message.substring(0, sql);
        }
        message = message.replaceAll("\\s+", " ").trim();
        return message.length() > 240 ? message.substring(0, 237) + "..." : message;
    }


    public static boolean isPersistenceFailure(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof DataAccessException || current instanceof PersistenceException) {
                return true;
            }
            if (current.getCause() == current) {
                break;
            }
        }
        return false;
    }
}
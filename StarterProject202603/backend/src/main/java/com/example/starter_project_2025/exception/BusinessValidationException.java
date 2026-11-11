package com.example.starter_project_2025.exception;

import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
public class BusinessValidationException extends RuntimeException {

    private final Map<String, List<String>> errors;

    public BusinessValidationException(Map<String, List<String>> errors) {
        super("Business validation failed");
        this.errors = errors;
    }
}

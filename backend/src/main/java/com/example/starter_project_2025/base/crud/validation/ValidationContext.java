package com.example.starter_project_2025.base.crud.validation;

import com.example.starter_project_2025.exception.BusinessValidationException;
import lombok.Getter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
public class ValidationContext {

    private final Map<String, List<String>> errors = new HashMap<>();

    public void add(String field, String message) {
        errors.computeIfAbsent(field, k -> new ArrayList<>())
                .add(message);
    }

    public boolean hasErrors() {
        return !errors.isEmpty();
    }

    public void throwIfErrors() {
        if (!errors.isEmpty()) {
            throw new BusinessValidationException(errors);
        }
    }

}

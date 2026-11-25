package com.example.starter_project_2025.system.git_integration.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/** SY-04: one page of a list, zero-based. */
public record GitPage<T>(List<T> items, int page, int size, long totalElements, int totalPages) {

    public static <E, T> GitPage<T> of(Page<E> page, Function<E, T> mapper) {
        return new GitPage<>(page.getContent().stream().map(mapper).toList(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }

    public static <T> GitPage<T> empty(int page, int size) {
        return new GitPage<>(List.of(), page, size, 0, 0);
    }
}

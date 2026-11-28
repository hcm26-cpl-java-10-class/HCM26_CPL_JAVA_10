package com.example.starter_project_2025.system.i18n.service;

/** Số chuỗi trong một request vượt quá giới hạn. */
public class TooManyTextsException extends RuntimeException {

    private final int limit;

    public TooManyTextsException(int limit) {
        super("Too many texts in one request, limit is " + limit);
        this.limit = limit;
    }

    public int getLimit() {
        return limit;
    }
}

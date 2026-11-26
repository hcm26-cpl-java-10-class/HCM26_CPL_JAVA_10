package com.example.starter_project_2025.system.i18n.service;

/** Ngôn ngữ đích không được hỗ trợ. */
public class UnsupportedLanguageException extends RuntimeException {

    private final String language;

    public UnsupportedLanguageException(String language) {
        super("Unsupported target language: " + language);
        this.language = language;
    }

    public String getLanguage() {
        return language;
    }
}

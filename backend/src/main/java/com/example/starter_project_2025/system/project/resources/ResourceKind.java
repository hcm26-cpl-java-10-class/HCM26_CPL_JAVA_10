package com.example.starter_project_2025.system.project.resources;

/**
 * Shape of a learning resource.
 * <p>
 * {@link #FILE} resources carry at least one stored file (see
 * {@code ProjectResourceFile} / {@code TemplateResourceFile}), {@link #LINK}
 * resources are described by an external {@code url} only.
 */
public enum ResourceKind {

    FILE,
    LINK
}

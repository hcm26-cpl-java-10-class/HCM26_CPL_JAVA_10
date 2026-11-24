package com.example.starter_project_2025.system.git_integration.ingestion.event;

/** Durable Activity work is enlisted in this source transaction, including enrichment and AUTO removals. */
public record GitSourceChangedEvent(Long repositoryId) { }

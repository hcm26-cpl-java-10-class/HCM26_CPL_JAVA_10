package com.example.starter_project_2025.system.git_integration.dto;

/** SY-05 re-check: references judged again, how many became links, and sources processed for the first time. */
public record TaskLinkRecheckResult(int checked, int nowLinked, int newlyProcessed) {
}

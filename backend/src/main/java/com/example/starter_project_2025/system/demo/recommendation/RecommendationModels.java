package com.example.starter_project_2025.system.demo.recommendation;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Set;

public final class RecommendationModels {
    private RecommendationModels() {}
    public record Preferences(@NotNull @Size(max=1000) String goals,
                              @NotNull @Size(max=20) Set<@NotBlank @Size(max=80) String> interests) {}
    public record Item(CatalogCourseDTO course, String reason) {}
    public record Result(List<Item> recommendations, Preferences preferences, String state) {}
    public record Turn(@NotNull @Pattern(regexp="user|assistant") String role,
                       @NotBlank @Size(max=2000) String content) {}
    public record ChatRequest(@NotBlank @Size(max=1000) String message,
                              @NotNull @Size(max=8) List<@NotNull @Valid Turn> history,
                              @NotNull @Pattern(regexp="en|vi") String language) {}
    public record ChatResponse(String reply, List<Item> recommendations, String aiStatus, String state) {}
}

package com.example.starter_project_2025.system.subject.technicalgroup;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/subjects/technical-groups")
@RequiredArgsConstructor
public class SubjectTechnicalGroupController {
    private final SubjectTechnicalGroupService service;
    public record CreateRequest(String name) {}
    public record GroupResponse(String name) {}

    @GetMapping
    public List<String> list() { return service.list(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupResponse create(@RequestBody CreateRequest request) {
        return new GroupResponse(service.create(request.name()));
    }
}

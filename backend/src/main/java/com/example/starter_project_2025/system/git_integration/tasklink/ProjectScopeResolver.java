package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.repository.GitProjectLookupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** SY-05: the projects whose tasks a repository may link to: its master project and every module below it. */
@Component
@RequiredArgsConstructor
public class ProjectScopeResolver {

    private static final int MAX_DEPTH = 10;

    private final GitProjectLookupRepository projects;

    public Set<Long> scope(Long masterId) {
        Set<Long> scope = new HashSet<>();
        if (masterId == null) return scope;
        scope.add(masterId);
        List<Long> level = List.of(masterId);
        for (int depth = 0; depth < MAX_DEPTH && !level.isEmpty(); depth++) {
            level = projects.findChildIds(level).stream().filter(scope::add).toList();
        }
        return scope;
    }
}

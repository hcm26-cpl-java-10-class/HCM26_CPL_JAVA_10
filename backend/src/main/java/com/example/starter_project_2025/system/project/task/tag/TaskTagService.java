package com.example.starter_project_2025.system.project.task.tag;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class TaskTagService {
    private final TagRepository tagRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public Set<Tag> resolve(UUID projectId, List<String> names) {
        Set<Tag> tags = new LinkedHashSet<>();
        for (String name : names) {
            String normalizedName = name.toLowerCase(Locale.ROOT);
            Tag tag = tagRepository.findByProjectIdAndNormalizedName(projectId, normalizedName)
                    .orElseGet(() -> tagRepository.saveAndFlush(Tag.builder()
                            .projectId(projectId).name(name).normalizedName(normalizedName).build()));
            tags.add(tag);
        }
        return tags;
    }

    @Transactional(readOnly = true)
    public List<String> findNames(UUID projectId, Long creatorId, String search) {
        String keyword = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        return tagRepository.findNames(projectId, creatorId).stream()
                .filter(name -> name.toLowerCase(Locale.ROOT).contains(keyword)).toList();
    }
}

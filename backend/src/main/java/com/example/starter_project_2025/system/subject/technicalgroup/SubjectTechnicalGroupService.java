package com.example.starter_project_2025.system.subject.technicalgroup;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.*;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional
public class SubjectTechnicalGroupService {
    private final SubjectTechnicalGroupRepository groups;
    private final SubjectRepository subjects;

    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyAuthority('SUBJECT_READ','SUBJECT_CREATE','SUBJECT_UPDATE')")
    public List<String> list() {
        return allNames();
    }

    @PreAuthorize("hasAnyAuthority('SUBJECT_CREATE','SUBJECT_UPDATE')")
    public String create(String input) {
        String name = validateName(input);
        String normalized = key(name);
        if (allNames().stream().anyMatch(existing -> key(existing).equals(normalized))) throw duplicate();
        try {
            return groups.saveAndFlush(new SubjectTechnicalGroup(name, normalized)).getName();
        } catch (DataIntegrityViolationException error) {
            // The unique key also protects concurrent requests with equivalent names.
            throw duplicate();
        }
    }

    /** One-time defaults and existing Subject strings become a persistent catalogue. */
    public void initialize(Collection<String> defaults) {
        Stream.concat(defaults.stream(), subjects.findDistinctTechnicalGroups().stream())
                .filter(Objects::nonNull).map(SubjectTechnicalGroupService::normalize).filter(name -> !name.isEmpty())
                .forEach(name -> {
                    var valid = validateName(name);
                    if (!groups.existsByNormalizedName(key(valid))) groups.saveAndFlush(new SubjectTechnicalGroup(valid, key(valid)));
                });
    }

    private List<String> allNames() {
        var names = new LinkedHashMap<String, String>();
        Stream.concat(groups.findAll().stream().map(SubjectTechnicalGroup::getName), subjects.findDistinctTechnicalGroups().stream())
                .filter(Objects::nonNull).map(SubjectTechnicalGroupService::normalize).filter(name -> !name.isEmpty())
                .forEach(name -> names.putIfAbsent(key(name), name));
        return names.values().stream().sorted(String.CASE_INSENSITIVE_ORDER.thenComparing(Comparator.naturalOrder())).toList();
    }

    private static String validateName(String input) {
        String name = normalize(input);
        if (name.isEmpty()) throw new BusinessValidationException(Map.of("name", List.of("Technical group name is required")));
        if (name.length() > 100) throw new BusinessValidationException(Map.of("name", List.of("Technical group name must not exceed 100 characters")));
        return name;
    }

    private static String normalize(String input) {
        return input == null ? "" : Normalizer.normalize(input, Normalizer.Form.NFC).replaceAll("[\\s\\p{Z}\\uFEFF]+", " ").trim();
    }

    private static String key(String name) { return name.toLowerCase(Locale.ROOT); }
    private static ConflictException duplicate() { return new ConflictException("This technical group already exists. Select it from the list."); }
}

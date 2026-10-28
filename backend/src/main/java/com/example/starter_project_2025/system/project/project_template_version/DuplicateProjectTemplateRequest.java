package com.example.starter_project_2025.system.project.project_template_version;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Payload of US-08 "Duplicate Project Template".
 * <p>
 * Only the identity of the copy is provided by the client: a new {@code name}
 * (the {@code code} is optional and no longer asked for). Everything else
 * (rules, milestones, rubric - stored in {@code contentJson}) is copied from
 * the source version by the server, the version is always {@code v1.0} and the
 * status always {@code DRAFT}.
 * <p>
 * Values are validated in {@link ProjectTemplateSnapshotServiceImpl} so the
 * error format (field -> messages, 422) matches the rest of the module.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DuplicateProjectTemplateRequest {

    /** New display name of the duplicated Project Template. */
    String name;
}

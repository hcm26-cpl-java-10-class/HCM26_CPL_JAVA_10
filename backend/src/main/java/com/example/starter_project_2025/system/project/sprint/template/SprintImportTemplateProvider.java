package com.example.starter_project_2025.system.project.sprint.template;

import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateBuilder;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateColumn;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateProvider;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import org.springframework.stereotype.Component;

/**
 * Downloadable import template of the {@code /sprints} module.
 * <p>
 * The columns are the {@code @ImportField} headers of
 * {@link com.example.starter_project_2025.system.project.sprint.Sprint} and the
 * rules are the ones {@code SprintServiceImpl} enforces on create, so a file
 * built from this template imports as-is:
 * <ul>
 *     <li>{@code Name}, {@code Sprint Goal}, {@code Start Date} and
 *     {@code End Date} are mandatory and the start must be before the end.</li>
 *     <li>{@code Name} is unique across all sprints.</li>
 *     <li>A new sprint always starts as {@link SprintStatus#PLANNED}; the
 *     status is therefore not part of the template (it is rejected/ignored on
 *     import and can only be advanced through an update).</li>
 *     <li>{@code Project ID} / {@code Team ID} are optional and only scope the
 *     sprint to a project or team.</li>
 * </ul>
 */
@Component
public class SprintImportTemplateProvider implements ImportTemplateProvider {

    /** Key of {@code Sprint} in the import entity registry. */
    static final String ENTITY = "sprint";

    @Override
    public String entity() {
        return ENTITY;
    }

    @Override
    public byte[] generate(Class<?> entityClass) {

        return ImportTemplateBuilder.forEntity(entityClass, "Sprint")
                .column(ImportTemplateColumn.integer(
                        "Project ID", false,
                        "ID dự án cần gắn Sprint (có thể để trống)", "1"))
                .column(ImportTemplateColumn.integer(
                        "Team ID", false,
                        "ID đội cần gắn Sprint (có thể để trống)", "1"))
                .column(ImportTemplateColumn.text(
                        "Name", true,
                        "Duy nhất, tối đa 255 ký tự", "Sprint 1 - Discovery"))
                .column(ImportTemplateColumn.text(
                        "Sprint Goal", true,
                        "Từ 1 đến 500 ký tự", "Hoàn thiện luồng đăng nhập"))
                .column(ImportTemplateColumn.dateTime(
                        "Start Date", true,
                        "Phải trước End Date", "2026-01-05T09:00:00"))
                .column(ImportTemplateColumn.dateTime(
                        "End Date", true,
                        "Phải sau Start Date", "2026-01-19T17:00:00"))
                .rule(
                        "Sprint Name không được trùng với Sprint đã có",
                        "Sprint Goal, Start Date và End Date là bắt buộc",
                        "Start Date phải trước End Date",
                        "Sprint mới luôn được tạo ở trạng thái " + SprintStatus.PLANNED
                                + ", không nhập Status trong file",
                        "Project ID / Team ID có thể để trống, dùng để gắn Sprint vào dự án hoặc đội")
                .build();
    }
}

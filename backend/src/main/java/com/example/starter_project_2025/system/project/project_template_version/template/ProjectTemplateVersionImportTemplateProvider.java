package com.example.starter_project_2025.system.project.project_template_version.template;

import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateBuilder;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateColumn;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateProvider;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * Downloadable import template of the {@code /project-template-versions}
 * module.
 * <p>
 * The columns are the {@code @ImportField} headers of
 * {@link com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot}
 * and the rules are the ones {@code ProjectTemplateSnapshotServiceImpl}
 * enforces on create: template and version are mandatory, the version label is
 * unique per template, the content must be valid JSON and a version without a
 * status starts as {@link ProjectTemplateVersionStatus#DRAFT}.
 * <p>
 * The owner columns come in pairs ({@code Template Id} / {@code Template Name}
 * and {@code Project Id} / {@code Project Name}): a row may use either form, the
 * readable name wins when both are filled.
 */
@Component
public class ProjectTemplateVersionImportTemplateProvider implements ImportTemplateProvider {

    /** Key of {@code ProjectTemplateSnapshot} in the import entity registry. */
    static final String ENTITY = "project_template_version";

    @Override
    public String entity() {
        return ENTITY;
    }

    @Override
    public byte[] generate(Class<?> entityClass) {

        List<String> statuses = Arrays.stream(ProjectTemplateVersionStatus.values())
                .map(Enum::name)
                .toList();

        return ImportTemplateBuilder.forEntity(entityClass, "Project Template Version")
                .column(ImportTemplateColumn.integer(
                        "Template Id", false,
                        "ID của Project Template sở hữu phiên bản này (bỏ trống nếu dùng Template Name)", "1"))
                .column(ImportTemplateColumn.lookup(
                        "Template Name", false, "Project Template",
                        "Tên Project Template sở hữu phiên bản này (thay thế cho Template Id)",
                        "Capstone Template"))
                .column(ImportTemplateColumn.integer(
                        "Project Id", false,
                        "ID dự án gắn với phiên bản (có thể để trống)", "1"))
                .column(ImportTemplateColumn.lookup(
                        "Project Name", false, "Project",
                        "Tên dự án gắn với phiên bản (thay thế cho Project Id)",
                        "Capstone Project"))
                .column(ImportTemplateColumn.text(
                        "Version", true,
                        "Tối đa 50 ký tự, duy nhất trong cùng Template Id / Template Name", "v1.0"))
                .column(ImportTemplateColumn.integer(
                        "Parent Template Id", false,
                        "ID phiên bản gốc (có thể để trống)", "1"))
                .column(ImportTemplateColumn.choice(
                        "Status", false, statuses,
                        "Mặc định " + ProjectTemplateVersionStatus.DRAFT,
                        ProjectTemplateVersionStatus.DRAFT.name()))
                .column(ImportTemplateColumn.text(
                        "Content JSON", true,
                        "JSON hợp lệ mô tả nội dung snapshot",
                        "{\"milestones\":[],\"backlog\":[]}"))
                .rule(
                        "Template Id hoặc Template Name là bắt buộc (Template Name được ưu tiên khi cả hai cùng có)",
                        "Version là bắt buộc, tối đa 50 ký tự và không được trùng trong cùng Template",
                        "Content JSON là bắt buộc và phải là JSON hợp lệ",
                        "Status mặc định " + ProjectTemplateVersionStatus.DRAFT
                                + " (" + String.join(" / ", statuses) + ")",
                        "Parent Template Id chỉ dùng để ghi nhận phiên bản gốc, có thể để trống",
                        "Project Id / Project Name có thể để trống (Project Name được ưu tiên khi cả hai cùng có)")
                .build();
    }
}

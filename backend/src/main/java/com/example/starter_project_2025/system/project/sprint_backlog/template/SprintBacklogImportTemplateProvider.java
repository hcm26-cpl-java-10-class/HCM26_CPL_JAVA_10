package com.example.starter_project_2025.system.project.sprint_backlog.template;

import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateBuilder;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateColumn;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateProvider;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * Downloadable import template of the {@code /sprint-backlogs} module.
 * <p>
 * The columns are the {@code @ImportField} headers of
 * {@link com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog}
 * and the rules are the ones {@code SprintBacklogServiceImpl} enforces on
 * create. Status, Work Type and Priority are dropdowns built from the module
 * enums, so the file can only contain values the backend understands.
 */
@Component
public class SprintBacklogImportTemplateProvider implements ImportTemplateProvider {

    /** Key of {@code SprintBacklog} in the import entity registry. */
    static final String ENTITY = "sprint-backlog";

    @Override
    public String entity() {
        return ENTITY;
    }

    @Override
    public byte[] generate(Class<?> entityClass) {

        List<String> statuses = names(SprintBacklogStatus.values());
        List<String> workTypes = names(SprintBacklogWorkType.values());
        List<String> priorities = names(SprintBacklogPriority.values());

        return ImportTemplateBuilder.forEntity(entityClass, "Sprint Backlog")
                .column(ImportTemplateColumn.lookup(
                        "Sprint", false, "Sprint",
                        "Phải khớp tên Sprint đã có; để trống nếu item thuộc Product Backlog",
                        "Sprint 1 - Discovery"))
                .column(ImportTemplateColumn.integer(
                        "Project ID", false,
                        "Để trống để tự động lấy theo Sprint", "1"))
                .column(ImportTemplateColumn.integer(
                        "Assignee", false,
                        "ID thành viên dự án (có thể để trống, phải là số dương)", "1"))
                .column(ImportTemplateColumn.text(
                        "Title", true,
                        "Từ 1 đến 200 ký tự", "Thiết kế màn hình đăng nhập"))
                .column(ImportTemplateColumn.text(
                        "Description", false,
                        "Tối đa 2000 ký tự", "Mô tả ngắn cho backlog item"))
                .column(ImportTemplateColumn.dateTime(
                        "Start Date", false,
                        "Phải nhập cùng End Date và trước End Date", "2026-01-05T09:00:00"))
                .column(ImportTemplateColumn.dateTime(
                        "End Date", false,
                        "Phải nhập cùng Start Date và sau Start Date", "2026-01-09T17:00:00"))
                .column(ImportTemplateColumn.choice(
                        "Status", false, statuses,
                        "Mặc định " + SprintBacklogStatus.TODO,
                        SprintBacklogStatus.TODO.name()))
                .column(ImportTemplateColumn.choice(
                        "Work Type", false, workTypes,
                        "Mặc định " + SprintBacklogWorkType.DEFAULT,
                        SprintBacklogWorkType.DEFAULT.name()))
                .column(ImportTemplateColumn.choice(
                        "Priority", false, priorities,
                        "Mặc định " + SprintBacklogPriority.MEDIUM,
                        SprintBacklogPriority.MEDIUM.name()))
                .column(ImportTemplateColumn.decimal(
                        "Estimated Hours", false,
                        "Số giờ ước tính, lớn hơn hoặc bằng 0", "8"))
                .rule(
                        "Title là bắt buộc, tối đa 200 ký tự",
                        "Description tối đa 2000 ký tự",
                        "Start Date và End Date phải nhập cùng nhau, Start Date trước End Date",
                        "Status mặc định " + SprintBacklogStatus.TODO
                                + ", Work Type mặc định " + SprintBacklogWorkType.DEFAULT
                                + ", Priority mặc định " + SprintBacklogPriority.MEDIUM,
                        "Sprint phải khớp tên Sprint đã tồn tại; để trống nếu item thuộc Product Backlog",
                        "Project ID tự động lấy từ Sprint khi để trống",
                        "Estimated Hours phải lớn hơn hoặc bằng 0")
                .build();
    }

    private List<String> names(Enum<?>[] constants) {
        return Arrays.stream(constants).map(Enum::name).toList();
    }
}

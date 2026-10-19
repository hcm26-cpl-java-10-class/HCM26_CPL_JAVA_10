package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.rbac.department.Department;
import com.example.starter_project_2025.system.rbac.department.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seed vài phòng ban mẫu để dev/test dropdown và cây phòng ban.
 * Chỉ chạy khi bảng departments còn trống, để không đụng vào dữ liệu đã có
 * (DB là file H2 nên dữ liệu được giữ lại giữa các lần chạy).
 */
@Slf4j
@Order(2)
@Component
@RequiredArgsConstructor
public class DepartmentDataInitializer implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (departmentRepository.count() > 0) {
            log.info("Departments already exist, skip seeding.");
            return;
        }

        Department company = ensure("COMPANY", "Công ty", null);
        ensure("IT", "Phòng IT", company);
        ensure("HR", "Phòng Nhân sự", company);
        ensure("FIN", "Phòng Kế toán", company);

        log.info("Ensured seed departments.");
    }

    private Department ensure(String code, String name, Department parent) {
        return departmentRepository.findByCode(code).orElseGet(() ->
                departmentRepository.save(Department.builder()
                        .code(code)
                        .name(name)
                        .parentDepartment(parent)
                        .build()));
    }
}

package com.example.starter_project_2025.init;


import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import com.example.starter_project_2025.base.crud.domain.Department;
import com.example.starter_project_2025.base.crud.domain.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(3)
@RequiredArgsConstructor
@Slf4j
public class DepartmentDataInitializer implements CommandLineRunner {

    private final DepartmentRepository departmentRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (departmentRepository.count() > 0) {
            log.info("Dữ liệu Department đã tồn tại. Bỏ qua seed data.");
            return;
        }

        log.info("Đang khởi tạo dữ liệu cây Department mẫu...");

        // Level 1: Root
        Department fptCorp = createDepartment("FPT-CORP", "Tập đoàn FPT", null);

        // Level 2: Sub-companies
        Department fptSoft = createDepartment("FPT-SOFT", "FPT Software", fptCorp);
        Department fptEdu  = createDepartment("FPT-EDU", "Tổ chức Giáo dục FPT", fptCorp);

        // Level 3: FPT Software Divisions
        createDepartment("FPT-FA", "FPT Software Academy", fptSoft);
        createDepartment("FPT-GSD", "Trung tâm Phát triển Phần mềm", fptSoft);
        createDepartment("FPT-HR", "Ban Nhân sự FPT Software", fptSoft);

        // Level 3: FPT Education Units
        createDepartment("FPT-U", "Trường Đại học FPT", fptEdu);

        log.info("Khởi tạo thành công {} phòng ban.", departmentRepository.count());
    }

    private Department createDepartment(String code, String name, Department parent) {
        Department dept = new Department();
        dept.setCode(code);
        dept.setName(name);
        dept.setParent(parent);
        dept.setStatus(DepartmentStatus.ACTIVE);
        dept.setLocationId(null);
        return departmentRepository.save(dept);
    }
}
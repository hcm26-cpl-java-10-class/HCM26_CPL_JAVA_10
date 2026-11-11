package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;

@ImportEntity("class-setup")
public class ClassImportTemplate {
    @ImportField(name = "Class Code", required = true)
    String code;

    @ImportField(name = "Class Name", required = true)
    String name;

    @ImportField(name = "Expected Start Date")
    String startDate;

    @ImportField(name = "Expected End Date")
    String endDate;

    @ImportField(name = "Status")
    String status;

    @ImportField(name = "Planned Trainee No.")
    Integer plannedSize;

    @ImportField(name = "Delivery Type")
    String deliveryType;

    @ImportField(name = "Trainee Type")
    String traineeType;

    @ImportField(name = "Format Type")
    String formatType;

    @ImportField(name = "Skills")
    String skills;

    @ImportField(name = "Site")
    String site;

    @ImportField(name = "Location")
    String location;

    @ImportField(name = "Subject Type")
    String subjectType;

    @ImportField(name = "Scope")
    String scope;

    @ImportField(name = "Supplier/Partner")
    String supplierPartner;

    @ImportField(name = "Key Program")
    String keyProgram;

    @ImportField(name = "Job Recommendation")
    Boolean jobRecommendation;

    @ImportField(name = "Training Program Code")
    String trainingProgramCode;

    @ImportField(name = "Training Program Version")
    String trainingProgramVersion;
}

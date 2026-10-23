package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.system.demo.syllabus.SyllabusCloService.CloInput;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusCloService.CloView;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusMaterialService.MaterialInput;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusMaterialService.MaterialView;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/syllabuses/{syllabusId}")
@RequiredArgsConstructor
public class SyllabusContentController {

    private final SyllabusCloService cloService;
    private final SyllabusMaterialService materialService;

    // CLO MANAGEMENT

    @GetMapping("/clos")
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public List<CloView> listClos(
            @PathVariable Long syllabusId
    ) {
        return cloService.list(syllabusId);
    }

    @PostMapping("/clos")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public ResponseEntity<CloView> createClo(
            @PathVariable Long syllabusId,
            @RequestBody CloInput input
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(cloService.create(syllabusId, input));
    }

    @PutMapping("/clos/{cloId}")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public CloView updateClo(
            @PathVariable Long syllabusId,
            @PathVariable Long cloId,
            @RequestBody CloInput input
    ) {
        return cloService.update(syllabusId, cloId, input);
    }

    @DeleteMapping("/clos/{cloId}")
    @PreAuthorize("hasAuthority('SYLLABUS_DELETE')")
    public ResponseEntity<Void> deleteClo(
            @PathVariable Long syllabusId,
            @PathVariable Long cloId
    ) {
        cloService.delete(syllabusId, cloId);
        return ResponseEntity.noContent().build();
    }

    // LEARNING MATERIALS MANAGEMENT

    @GetMapping("/materials")
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public List<MaterialView> listMaterials(
            @PathVariable Long syllabusId
    ) {
        return materialService.list(syllabusId);
    }

    @PostMapping("/materials")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public ResponseEntity<MaterialView> createMaterial(
            @PathVariable Long syllabusId,
            @RequestBody MaterialInput input
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(materialService.create(syllabusId, input));
    }

    @PutMapping("/materials/{materialId}")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public MaterialView updateMaterial(
            @PathVariable Long syllabusId,
            @PathVariable Long materialId,
            @RequestBody MaterialInput input
    ) {
        return materialService.update(
                syllabusId,
                materialId,
                input
        );
    }

    @DeleteMapping("/materials/{materialId}")
    @PreAuthorize("hasAuthority('SYLLABUS_DELETE')")
    public ResponseEntity<Void> deleteMaterial(
            @PathVariable Long syllabusId,
            @PathVariable Long materialId
    ) {
        materialService.delete(syllabusId, materialId);
        return ResponseEntity.noContent().build();
    }
}
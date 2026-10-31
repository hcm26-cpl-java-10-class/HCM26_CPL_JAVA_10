package com.example.starter_project_2025.system.training_program;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TrainingProgramService {
    private final TrainingProgramRepository repository;

    @Transactional(readOnly = true)
    public Page<TrainingProgramResponse> search(String keyword, ProgramStatus status, Pageable pageable) {
        Page<TrainingProgram> page = repository.findAll((root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("code")), pattern),
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("region")), pattern)));
            }
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        }, PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100),
                pageable.getSort().isSorted() ? pageable.getSort() : Sort.by("code").ascending()));
        return page.map(TrainingProgramResponse::from);
    }

    @Transactional(readOnly = true)
    public TrainingProgramResponse get(Long id) {
        return TrainingProgramResponse.from(find(id));
    }

    public TrainingProgramResponse create(TrainingProgramRequest req) {
        validateUnique(req, null);
        List<TrainingProgramRequest.ProgramSubjectRequest> subjects = validateSubjects(req.subjects(), false);
        TrainingProgram p = new TrainingProgram();
        apply(p, req, subjects);
        return TrainingProgramResponse.from(repository.save(p));
    }

    public TrainingProgramResponse update(Long id, TrainingProgramRequest req) {
        TrainingProgram p = find(id);
        if (p.getStatus() == ProgramStatus.ACTIVE) {
            throw new IllegalStateException("Không sửa trực tiếp chương trình ACTIVE; hãy clone thành phiên bản mới.");
        }
        validateUnique(req, id);
        apply(p, req, validateSubjects(req.subjects(), false));
        return TrainingProgramResponse.from(repository.save(p));
    }

    public TrainingProgramResponse cloneVersion(Long id) {
        TrainingProgram source = find(id);
        int nextVersion = repository.findFirstByCodeOrderByVersionDesc(source.getCode())
                .map(p -> p.getVersion() + 1).orElse(source.getVersion() + 1);
        TrainingProgram copy = new TrainingProgram();
        copy.setCode(source.getCode());
        copy.setName(source.getName());
        copy.setVersion(nextVersion);
        copy.setRegion(source.getRegion());
        copy.setStatus(ProgramStatus.DRAFT);
        copy.setIsActive(true);
        List<ProgramSubject> cloned = source.getSubjects().stream()
                .map(s -> ProgramSubject.builder().subjectId(s.getSubjectId()).orderIndex(s.getOrderIndex()).build())
                .toList();
        copy.replaceSubjects(cloned);
        return TrainingProgramResponse.from(repository.save(copy));
    }

    public TrainingProgramResponse changeStatus(Long id, ProgramStatus status) {
        TrainingProgram p = find(id);
        if (status == ProgramStatus.ACTIVE) {
            if (p.getSubjects().isEmpty()) {
                throw new IllegalArgumentException("Không thể kích hoạt chương trình chưa có môn học.");
            }
            Set<Integer> orders = p.getSubjects().stream().map(ProgramSubject::getOrderIndex).collect(Collectors.toSet());
            if (orders.size() != p.getSubjects().size() || orders.stream().anyMatch(i -> i == null || i < 1)) {
                throw new IllegalArgumentException("Thứ tự môn học không hợp lệ hoặc bị trùng.");
            }
            // Subject existence/status validation must be connected to Minh Hoang's API when its contract is available.
        }
        p.setStatus(Objects.requireNonNull(status));
        p.setIsActive(status != ProgramStatus.INACTIVE);
        return TrainingProgramResponse.from(repository.save(p));
    }

    public void deactivate(Long id) {
        changeStatus(id, ProgramStatus.INACTIVE);
    }

    private TrainingProgram find(Long id) {
        return repository.findById(id).orElseThrow(() -> new EntityNotFoundException("Không tìm thấy chương trình ID " + id));
    }

    private void validateUnique(TrainingProgramRequest req, Long currentId) {
        repository.findAll().stream()
                .filter(p -> p.getCode().equalsIgnoreCase(req.code()) && p.getVersion().equals(req.version()))
                .filter(p -> !Objects.equals(p.getId(), currentId))
                .findAny()
                .ifPresent(p -> { throw new IllegalArgumentException("Mã chương trình và phiên bản đã tồn tại."); });
    }

    private List<TrainingProgramRequest.ProgramSubjectRequest> validateSubjects(
            List<TrainingProgramRequest.ProgramSubjectRequest> input, boolean allowEmpty) {
        List<TrainingProgramRequest.ProgramSubjectRequest> items = input == null ? List.of() : input;
        Set<Long> ids = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        for (var item : items) {
            if (!ids.add(item.subjectId())) throw new IllegalArgumentException("Môn học bị thêm trùng.");
            if (!orders.add(item.orderIndex())) throw new IllegalArgumentException("Thứ tự môn học bị trùng.");
        }
        return items;
    }

    private void apply(TrainingProgram p, TrainingProgramRequest req,
                       List<TrainingProgramRequest.ProgramSubjectRequest> subjects) {
        p.setCode(req.code().trim());
        p.setName(req.name().trim());
        p.setVersion(req.version());
        p.setRegion(req.region());
        p.setStatus(req.status() == null ? ProgramStatus.DRAFT : req.status());
        p.setIsActive(p.getStatus() != ProgramStatus.INACTIVE);
        p.replaceSubjects(subjects.stream()
                .map(s -> ProgramSubject.builder().subjectId(s.subjectId()).orderIndex(s.orderIndex()).build())
                .toList());
    }
}

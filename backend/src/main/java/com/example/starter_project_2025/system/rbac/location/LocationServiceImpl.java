package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class LocationServiceImpl
        extends BaseCrudServiceImpl<Location, Long, LocationDTO, LocationFilter>
        implements LocationService {

    LocationMapper locationMapper;
    LocationRepository locationRepository;

    @Override
    protected BaseCrudRepository<Location, Long> getRepository() {
        return locationRepository;
    }

    @Override
    protected BaseCrudMapper<Location, LocationDTO> getMapper() {
        return locationMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name"};
    }

    @Override
    protected void beforeCreate(Location location, LocationDTO request, ValidationContext ctx) {
        normalize(request);

        if (locationRepository.existsByCode(request.getCode())) {
            ctx.add("code", "Location code is already in use");
        }

        Long parentId = resolveParentId(request.getParentLocationId(), null, ctx);

        location.setCode(request.getCode());
        location.setName(request.getName());
        location.setParentId(parentId);

        if (location.getIsActive() == null) {
            location.setIsActive(true);
        }

        if (location.getStatus() == null) {
            location.setStatus("ACTIVE");
        }
    }

    @Override
    protected void beforeUpdate(Location location, LocationDTO request, ValidationContext ctx) {
        normalize(request);

        if (request.getCode() != null && !request.getCode().equals(location.getCode())) {
            if (locationRepository.existsByCode(request.getCode())) {
                ctx.add("code", "Location code is already in use");
            }
        }

        Long parentId = resolveParentId(request.getParentLocationId(), location.getId(), ctx);

        if (!ctx.hasErrors()) {
            location.setParentId(parentId);
        }

        if (location.getIsActive() == null) {
            location.setIsActive(true);
        }
    }

    @Override
    protected void beforeDelete(Location location) {
        ValidationContext ctx = new ValidationContext();

        if (locationRepository.existsByParentId(location.getId())) {
            ctx.add("id", "Cannot delete a location that still has child locations");
        }

        ctx.throwIfErrors();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocationTreeDTO> getTree() {
        checkPermission(CrudAction.READ);

        List<Location> all = locationRepository.findAll();

        Map<Long, List<Location>> childrenByParent = new HashMap<>();
        List<Location> roots = new ArrayList<>();

        for (Location loc : all) {
            Long parentId = loc.getParentId();
            if (parentId == null) {
                roots.add(loc);
            } else {
                childrenByParent.computeIfAbsent(parentId, k -> new ArrayList<>()).add(loc);
            }
        }

        return roots.stream()
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .map(loc -> toNode(loc, childrenByParent))
                .toList();
    }

    private LocationTreeDTO toNode(Location loc, Map<Long, List<Location>> childrenByParent) {
        List<LocationTreeDTO> children = childrenByParent
                .getOrDefault(loc.getId(), List.of())
                .stream()
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .map(child -> toNode(child, childrenByParent))
                .toList();

        List<UserSummaryDTO> userSummaries = loc.getUsers() == null ? List.of() :
                loc.getUsers().stream()
                        .map(u -> {
                            String roleName = (u.getRoles() != null && !u.getRoles().isEmpty())
                                    ? u.getRoles().iterator().next().getName()
                                    : null;

                            return UserSummaryDTO.builder()
                                    .id(u.getId())
                                    .email(u.getEmail())
                                    .fullName(u.getFullName())
                                    .phone(u.getPhone())
                                    .roleName(roleName)
                                    .build();
                        })
                        .toList();

        return LocationTreeDTO.builder()
                .id(loc.getId())
                .code(loc.getCode())
                .name(loc.getName())
                .parentId(loc.getParentId())
                .status(loc.getStatus())
                .users(userSummaries)
                .totalUsers(userSummaries.size())
                .children(children)
                .build();
    }

    private void normalize(LocationDTO request) {
        if (request.getCode() != null) {
            request.setCode(request.getCode().trim());
        }
        if (request.getName() != null) {
            request.setName(request.getName().trim());
        }
    }

    private Long resolveParentId(Long parentId, Long currentId, ValidationContext ctx) {
        if (parentId == null) {
            return null;
        }

        if (parentId.equals(currentId)) {
            ctx.add("parentLocationId", "A location cannot be its own parent");
            return null;
        }

        Optional<Location> parent = locationRepository.findById(parentId);

        if (parent.isEmpty()) {
            ctx.add("parentLocationId", "Parent location does not exist");
            return null;
        }

        if (currentId != null) {
            Long cursorId = parent.get().getParentId();
            Set<Long> visited = new HashSet<>();

            while (cursorId != null && visited.add(cursorId)) {
                if (cursorId.equals(currentId)) {
                    ctx.add("parentLocationId", "Parent location cannot be a descendant of this location");
                    return null;
                }
                Optional<Location> cursorLoc = locationRepository.findById(cursorId);
                cursorId = cursorLoc.map(Location::getParentId).orElse(null);
            }
        }

        return parentId;
    }
}
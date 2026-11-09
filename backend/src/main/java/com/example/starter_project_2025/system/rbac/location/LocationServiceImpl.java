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
        return new String[]{"code", "name", "path"};
    }

    @Override
    protected void beforeCreate(Location location, LocationDTO request, ValidationContext ctx) {
        normalize(request);

        if (locationRepository.existsByCode(request.getCode())) {
            ctx.add("code", "Location code is already in use");
            return;
        }

        // Thiết lập Parent theo quan hệ đối tượng
        Location parent = resolveParent(request.getParentLocationId(), null, ctx);
        if (!ctx.hasErrors()) {
            location.setParentLocation(parent);
        }
    }

    @Override
    protected void beforeUpdate(Location location, LocationDTO request, ValidationContext ctx) {
        normalize(request);

        // Kiểm tra trùng code khi sửa
        if (request.getCode() != null && !request.getCode().equals(location.getCode())) {
            if (locationRepository.existsByCode(request.getCode())) {
                ctx.add("code", "Location code is already in use");
            }
        }

        // Cập nhật thông tin qua Domain Method (Encapsulation)
        location.updateInfo(request.getName(), request.getDescription());

        // Cập nhật quan hệ Parent
        Location newParent = resolveParent(request.getParentLocationId(), location.getId(), ctx);
        if (!ctx.hasErrors()) {
            location.setParentLocation(newParent);
        }
    }

    @Override
    protected void beforeDelete(Location location) {
        ValidationContext ctx = new ValidationContext();

        // Dùng quan hệ đối tượng Hibernate thay vì query parentId
        if (location.getChildren() != null && !location.getChildren().isEmpty()) {
            ctx.add("id", "Cannot delete a location that still has child locations");
        }

        ctx.throwIfErrors();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocationTreeDTO> getTree() {
        checkPermission(CrudAction.READ);

        // Lấy danh sách vị trí gốc (Root) từ Repository
        List<Location> roots = locationRepository.findByParentIsNull();

        return roots.stream()
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toNode)
                .toList();
    }

    /**
     * Chuyển đổi đệ quy từ Entity sang DTO dựa trên navigation properties (OOP)
     */
    private LocationTreeDTO toNode(Location loc) {
        List<LocationTreeDTO> children = (loc.getChildren() == null) ? List.of() :
                loc.getChildren().stream()
                        .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                        .map(this::toNode)
                        .toList();

        List<UserSummaryDTO> userSummaries = (loc.getUsers() == null) ? List.of() :
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

        Long parentId = (loc.getParent() != null) ? loc.getParent().getId() : null;

        return LocationTreeDTO.builder()
                .id(loc.getId())
                .code(loc.getCode())
                .name(loc.getName())
                .path(loc.getPath())
                .level(loc.getLevel())
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


    private Location resolveParent(Long parentId, Long currentId, ValidationContext ctx) {
        if (parentId == null) {
            return null;
        }

        if (parentId.equals(currentId)) {
            ctx.add("parentLocationId", "A location cannot be its own parent");
            return null;
        }

        Location parent = locationRepository.findById(parentId).orElse(null);
        if (parent == null) {
            ctx.add("parentLocationId", "Parent location does not exist");
            return null;
        }

        if (currentId != null) {
            Location cursor = parent;
            while (cursor != null) {
                if (Objects.equals(cursor.getId(), currentId)) {
                    ctx.add("parentLocationId", "Parent location cannot be a descendant of this location");
                    return null;
                }
                cursor = cursor.getParent();
            }
        }

        return parent;
    }
}
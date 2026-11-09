package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Collections;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

@Entity
@Table(name = "locations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
@ImportEntity("location")
@ExportEntity(fileName = "locations", sheetName = "Locations")
@ResourcePermission("LOCATION")
public class Location extends BaseEntity {

    @Column(nullable = false, unique = true)
    @ImportField(name = "Code", required = true)
    @ExportField(name = "Code")
    private String code;

    @Column(nullable = false)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    private String name;

    @Column(name = "description")
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    @ExportField(name = "Status")
    private LocationStatus status = LocationStatus.ACTIVE;

    // --- Bổ sung phục vụ Mô hình Cây (Tree Structure) ---

    @Column(name = "path", length = 500)
    @ExportField(name = "Path")
    private String path; // Lưu đường dẫn hiển thị: "VN / HN / Cơ sở 1"

    @Builder.Default
    @Column(name = "level")
    private Integer level = 0; // Độ sâu cây: 0 = VN, 1 = HN, 2 = Cơ sở 1

    // --- Quan hệ Cha - Con (Self-Referencing) ---

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Location parent;

    @Builder.Default
    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private Set<Location> children = new HashSet<>();

    // --- Many-To-Many Relationship ---

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "user_locations",
            joinColumns = @JoinColumn(name = "location_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    private Set<User> users = new HashSet<>();

    // =========================================================================
    // Domain Methods (Hành vi OOP cho mô hình Cây)
    // =========================================================================

    /**
     * Cập nhật thông tin cơ bản và tính toán lại Path nếu tên thay đổi
     */
    public void updateInfo(String name, String description) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Tên vị trí không được để trống");
        }
        this.name = name;
        this.description = description;
        this.recalculatePath();
    }

    /**
     * Đồng bộ quan hệ Cấp cha - Cấp con và tính toán lại Path, Level
     */
    public void setParentLocation(Location newParent) {
        // Chặn chọn chính nó làm nút cha
        if (newParent != null && Objects.equals(this.getId(), newParent.getId())) {
            throw new IllegalArgumentException("Không thể chọn chính vị trí này làm vị trí cha");
        }

        if (this.parent != null) {
            this.parent.children.remove(this);
        }

        this.parent = newParent;

        if (newParent != null) {
            newParent.children.add(this);
            this.level = newParent.getLevel() + 1;
        } else {
            this.level = 0;
        }

        this.recalculatePath();
    }

    /**
     * Phương thức đệ quy tính toán lại Path dạng: "VN / HN / Cơ sở 1"
     */
    public void recalculatePath() {
        if (this.parent == null) {
            this.path = this.name;
        } else {
            this.path = this.parent.getPath() + " / " + this.name;
        }
        // Tự động cập nhật Path cho tất cả các nút con bên dưới
        if (this.children != null) {
            for (Location child : this.children) {
                child.recalculatePath();
            }
        }
    }

    public Set<Location> getChildren() {
        return Collections.unmodifiableSet(this.children);
    }

    public Set<User> getUsers() {
        return Collections.unmodifiableSet(this.users);
    }

    public void addUser(User user) {
        if (user != null) {
            this.users.add(user);
        }
    }

    public void removeUser(User user) {
        if (user != null) {
            this.users.remove(user);
        }
    }

    public void deactivate() {
        this.status = LocationStatus.INACTIVE;
    }

    public void activate() {
        this.status = LocationStatus.ACTIVE;
    }

    // =========================================================================
    // Standard Hibernate equals & hashCode
    // =========================================================================

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Location location = (Location) o;
        return getId() != null && Objects.equals(getId(), location.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
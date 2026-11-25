package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(
        name = "user_data_scopes",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_user_scope_target",
                columnNames = {"user_id", "tenant_id", "scope_type", "target_id"}
        )
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserDataScope extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false, length = 30)
    UserScopeType scopeType;

    @Column(name = "target_id", nullable = false)
    Long targetId;
}
```mermaid
classDiagram
    %% ==========================================
    %% 1. ENTITIES LAYER (USER & IAM SCOPE ONLY)
    %% ==========================================
    class User {
        -id: UUID
        -username: String
        -email: String
        -employeeCode: String
        -fullName: String
        -passwordHash: String
        -primaryDepartmentId: UUID
        -status: UserStatus
        -lastLoginAt: Instant
        -createdAt: Instant
        -updatedAt: Instant
        -deletedAt: Instant
        +activate()
        +suspend(reason: String)
        +deactivate()
        +changePassword(hash: String)
        +isActive(): bool
    }

    class Department {
        -id: UUID
        -code: String
        -name: String
        -parentDepartmentId: UUID
        -status: CommonStatus
        +getParent(): Department
        +getChildren(): Department[]
    }

    class UserDepartment {
        -id: UUID
        -userId: UUID
        -departmentId: UUID
        -assignedAt: Instant
    }

    class UserRole {
        -id: UUID
        -userId: UUID
        -roleId: UUID
        -scopeType: String
        -scopeId: UUID
        -effectiveFrom: Date
        -effectiveTo: Date
        +isEffective(at: Date): bool
    }

    class Role {
        -id: UUID
        -code: String
        -name: String
        -description: String
        -isSystem: Boolean
        -status: CommonStatus
        +addPermission(p: Permission)
        +removePermission(p: Permission)
    }

    class UserPermission {
        -id: UUID
        -userId: UUID
        -permissionId: UUID
        -isGranted: Boolean
    }

    class RolePermission {
        -id: UUID
        -roleId: UUID
        -permissionId: UUID
    }

    class Permission {
        -id: UUID
        -code: String
        -resource: String
        -action: CrudAction
        -description: String
        -active: Boolean
    }

    class AuthSession {
        -id: UUID
        -userId: UUID
        -tokenHash: String
        -issuedAt: Instant
        -expiresAt: Instant
        -revokedAt: Instant
        +isValid(): bool
        +revoke()
    }

    class PasswordResetToken {
        -id: UUID
        -userId: UUID
        -tokenHash: String
        -expiresAt: Instant
        -usedAt: Instant
        +isUsable(): bool
        +markUsed()
    }

    class AuditLog {
        -id: UUID
        -actorId: UUID
        -action: String
        -entity: String
        -entityId: String
        -beforeData: String
        -afterData: String
        -timestamp: Instant
    }

    class UserStatus {
        <<enumeration>>
        INVITED
        ACTIVE
        SUSPENDED
        DEACTIVATED
    }

    class CommonStatus {
        <<enumeration>>
        ACTIVE
        INACTIVE
    }

    class CrudAction {
        <<enumeration>>
        VIEW
        CREATE
        UPDATE
        DELETE
        APPROVE
    }

    %% ==========================================
    %% 2. SERVICE LAYER (BUSINESS LOGIC)
    %% ==========================================
    class DepartmentService {
        +createDepartment(dto): Department
        +getDepartmentTree(): DepartmentDTO[]
        +assignUserDepartments(userId, deptIds): bool
    }

    class AuthorizationService {
        +hasPermission(user, code): bool
        +canAccessScope(user, type, id): bool
        +getEffectiveRoles(user): Role[]
    }

    %% ==========================================
    %% 3. ENTITY RELATIONSHIPS
    %% ==========================================
    Department "0..*" --> "0..1" Department : parent

    User "0..*" --> "0..1" Department : primary department
    User "1" --> "0..*" UserDepartment : assigns
    UserDepartment "0..*" --> "1" Department : belongs to
    
    User "1" --> "0..*" UserRole : has
    UserRole "0..*" --> "1" Role : assigned
    
    User "1" --> "0..*" UserPermission : direct permissions
    UserPermission "0..*" --> "1" Permission : grants
    
    Role "1" --> "0..*" RolePermission : has
    RolePermission "0..*" --> "1" Permission : grants
    
    User "1" --> "0..*" AuthSession : owns
    User "1" --> "0..*" PasswordResetToken : owns
    User "1" --> "0..*" AuditLog : actor
    User --> UserStatus
    Department --> CommonStatus
    Role --> CommonStatus
    Permission --> CrudAction

    %% ==========================================
    %% 4. SERVICE DEPENDENCY RELATIONSHIPS
    %% ==========================================
    DepartmentService ..> Department : manages
    DepartmentService ..> UserDepartment : assigns
    
    AuthorizationService ..> User : checks perms
    AuthorizationService ..> UserRole : reads roles
    AuthorizationService ..> UserPermission : reads perms
    AuthorizationService ..> Permission : validates
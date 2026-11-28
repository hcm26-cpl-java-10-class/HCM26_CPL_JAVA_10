# RULEBOOK: THIẾT KẾ ENTITY VÀ CÁC MỐI QUAN HỆ

> Tài liệu quy tắc thực hành bắt buộc khi phân tích nghiệp vụ, thiết kế Entity JPA/Hibernate và kiểm tra cấu trúc bảng dữ liệu trong dự án **FAMS LMS (`HCM26_CPL_JAVA_10`)**.
>
> Nội dung được chuẩn hóa từ chương **"14 - Thiết kế quan hệ Entity: từ nghiệp vụ đến bảng dữ liệu"** và đã đối chiếu, hiệu chỉnh đường dẫn cùng hiện trạng thực tế của codebase.

---

## 1. Mục tiêu và nguyên tắc cốt lõi

Thiết kế Entity phải phản ánh đúng **dữ liệu và nghiệp vụ**, không thiết kế theo nhu cầu hiển thị của từng màn hình.

Một mô hình có vấn đề thường có các dấu hiệu:

- Cùng một thông tin bị lặp ở nhiều dòng hoặc nhiều bảng.
- Sửa dữ liệu ở một nơi nhưng nơi khác vẫn giữ giá trị cũ.
- Một cột chứa nhiều giá trị, ví dụ `permissions = "READ,WRITE,DELETE"`.
- Lưu tên thực thể dưới dạng chuỗi thay vì lưu khóa ngoại.
- Quan hệ giữa các Entity không phản ánh đúng số lượng bản ghi thực tế.

**Quy tắc vàng:** Với mỗi thông tin, phải xác định thông tin đó thuộc về thực thể nào. Nếu đổi một thông tin mà phải sửa nhiều bản ghi không cần thiết, cần xem lại mô hình dữ liệu.

---

## 2. Quy trình thiết kế Entity — 6 bước bắt buộc

Thực hiện phân tích trên giấy trước khi viết `@Entity`.

### Bước 1 — Liệt kê danh từ nghiệp vụ

Đọc mô tả nghiệp vụ và gạch chân danh từ.

Ví dụ:

> Học viên thuộc một lớp. Mỗi lớp có nhiều học viên. Giảng viên dạy nhiều khóa học. Mỗi khóa học có nhiều giảng viên. Học viên nhận điểm cho từng đầu điểm của khóa học.

Các danh từ: `Học viên`, `Lớp`, `Giảng viên`, `Khóa học`, `Điểm`, `Đầu điểm`.

Danh từ chỉ là ứng viên để xem xét tạo Entity, không có nghĩa danh từ nào cũng phải trở thành một bảng.

### Bước 2 — Phân biệt Entity và thuộc tính

Với mỗi danh từ, đặt 3 câu hỏi:

1. Nó có thuộc tính riêng không?
2. Nó có tồn tại độc lập không?
3. Có cần thực thể khác tham chiếu đến nó không?

Nếu cả 3 câu trả lời đều là **không**, nó có thể chỉ là thuộc tính, collection hoặc value object thay vì Entity.

Ví dụ:

- `TrainingClass` có mã, tên và tồn tại ngay cả khi chưa có học viên → Entity.
- Một đầu điểm chỉ là cặp key-value của một bản ghi điểm, không có thuộc tính riêng và không được tham chiếu nơi khác → có thể dùng `@ElementCollection`.
- Nếu đầu điểm có `weight`, `teacherComment`, `gradedAt` → nên tách thành Entity riêng.

### Bước 3 — Xác định cardinality ở cả hai chiều

Với hai thực thể A và B, luôn hỏi:

- Một A có bao nhiêu B?
- Một B có bao nhiêu A?

| A → B | B → A | Loại quan hệ |
|---|---|---|
| 1 | 1 | 1-1 |
| 1 | N | 1-N |
| N | 1 | 1-N theo chiều ngược lại |
| N | N | N-N |

Ví dụ:

- Một nhóm menu có nhiều module; một module thuộc một nhóm menu → `ModuleGroup` 1-N `Module`.
- Một người dùng có thể có nhiều vai trò; một vai trò có thể gán cho nhiều người dùng → `User` N-N `Role`.

**Không kết luận quan hệ chỉ từ một chiều.** Nếu chỉ hỏi "một khóa học có bao nhiêu giảng viên?" và câu trả lời hiện tại là một, chưa đủ để kết luận 1-N. Phải hỏi thêm "một giảng viên có thể dạy bao nhiêu khóa học?" và kiểm tra khả năng mở rộng nghiệp vụ.

### Bước 4 — Chọn cách biểu diễn trong JPA

| Nhu cầu | Cách biểu diễn |
|---|---|
| Bên nhiều giữ FK trỏ về bên một | `@ManyToOne(fetch = FetchType.LAZY)` ở bên nhiều |
| Cần duyệt danh sách con từ cha | `@OneToMany(mappedBy = "...")` ở bên một |
| N-N không có dữ liệu phụ | `@ManyToMany(fetch = FetchType.LAZY)` + `@JoinTable` + `@UniqueConstraint` |
| N-N có dữ liệu phụ như ngày, trạng thái, vai trò | Entity trung gian |
| Map key-value hoặc danh sách giá trị thuộc riêng một bản ghi | `@ElementCollection` + `@CollectionTable` |
| Tập giá trị cố định, ít thay đổi | `enum` với `@Enumerated(EnumType.STRING)` |
| Cần lưu ảnh chụp dữ liệu tại một thời điểm | Copy có chủ đích cho audit/snapshot (kèm Javadoc) |

### Bước 5 — Kiểm tra chuẩn hóa dữ liệu

#### 1NF — First Normal Form

Mỗi ô chỉ chứa một giá trị nguyên tử.

| Không nên | Nên |
|---|---|
| `permissions = "READ,WRITE"` | Bảng `role_permissions(role_id, permission_id)` |
| `scores = "8.2,9.0,7.8"` | Bảng `student_score_columns(student_score_id, score_key, score_value)` |

Không lưu danh sách giá trị trong một chuỗi nếu cần lọc, truy vấn hoặc liên kết từng phần tử.

#### 2NF — Second Normal Form

Không có thuộc tính chỉ phụ thuộc vào một phần của khóa.

Ví dụ không phù hợp:

`student_scores(student_id, course_id, student_name, score)`

Nếu khóa là `(student_id, course_id)`, `student_name` chỉ phụ thuộc `student_id`, không phụ thuộc toàn bộ khóa. Tên học viên nên nằm ở bảng `users`.

#### 3NF — Third Normal Form

Không có phụ thuộc bắc cầu giữa các thuộc tính không khóa.

Ví dụ không phù hợp:

`class_members(member_id, class_id, class_name)`

`class_name` phụ thuộc `class_id`, trong khi `class_id` phụ thuộc `member_id`. Thông tin lớp phải nằm ở bảng `training_classes`.

### Bước 6 — Kiểm tra DDL thực tế

Không chỉ kiểm tra code Java. Hãy kiểm tra bảng thực tế được tạo trong database.

Dự án hiện cấu hình tại `backend/src/main/resources/application.properties`:

- Môi trường local mặc định dùng **H2 file database** với `spring.jpa.hibernate.ddl-auto=update` và bật H2 Console tại `/h2-console`.
- Môi trường MySQL/MariaDB chạy bằng biến môi trường (`DB_URL`, `DB_DRIVER`, `DB_DIALECT`, `DB_DDL_AUTO`).
- Các script DDL thủ công nằm tại `backend/src/main/resources/db/manual/` và các bản di chuyển dữ liệu/schema bằng Java là các class `*Migration.java`.

Cách kiểm tra DDL thực tế:

- **Trên H2 Console (`/h2-console`):**

```sql
SHOW COLUMNS FROM user_roles;
SCRIPT NODATA TABLE user_roles;
```

- **Trên MySQL / MariaDB:**

```sql
SHOW CREATE TABLE class_members;
SHOW CREATE TABLE course_enrollments;
```

- **Khi triển khai production/safe-deployment:** kiểm tra và đối chiếu script SQL thủ công trong `backend/src/main/resources/db/manual/` hoặc `docs/09-deployment-operations/`.

Checklist:

- [ ] Có cột nào trùng nghĩa với cột ở bảng khác không? Nếu có, giải thích được lý do nghiệp vụ chưa?
- [ ] Có quan hệ nào cần FK nhưng database lại không có FK không?
- [ ] Bảng trung gian N-N đã có unique constraint chống trùng chưa?
- [ ] Có chuỗi nào đang đóng vai trò "FK ngầm", ví dụ `className`, thay vì `class_id` không?

---

## 3. Quy tắc cho từng loại quan hệ

### 3.1. One-to-One (1-1)

Dùng khi một bản ghi A tương ứng tối đa một bản ghi B theo quy tắc nghiệp vụ.

Ví dụ thực tế trong dự án (`ExamResultPublication` ↔ `Exam`):

```java
@Entity
@Table(
    name = "exam_result_publication",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_exam_result_publication_exam",
        columnNames = "exam_id"
    )
)
public class ExamResultPublication extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false, unique = true)
    private Exam exam;
}
```

Hoặc có thể dùng `@ManyToOne(fetch = FetchType.LAZY, optional = false)` kèm `@JoinColumn(..., unique = true)` khi muốn tránh một số giới hạn lazy proxy ở phía inverse của `@OneToOne`. Dù chọn cách nào, ràng buộc `UNIQUE` trên cột FK ở database mới là thứ đảm bảo quan hệ 1-1.

Quy tắc:

- FK đặt ở một phía.
- Luôn thêm `UNIQUE` cho FK (qua `@JoinColumn(..., unique = true)` hoặc `@Table(uniqueConstraints = ...)`) để database không cho phép nhiều bản ghi trỏ tới cùng một bản ghi cha.
- Luôn dùng `fetch = FetchType.LAZY` trên `@OneToOne` (mặc định của JPA là `EAGER`).
- Không chỉ dựa vào tên quan hệ trong Java; phải kiểm tra constraint thực tế.

### 3.2. One-to-Many / Many-to-One (1-N)

Ví dụ thực tế trong dự án: một `ModuleGroup` có nhiều `Module`, mỗi `Module` thuộc một `ModuleGroup`.

**Bên nhiều giữ khóa ngoại** và là owning side (`Module.java`):

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "module_group_id", nullable = false)
ModuleGroup moduleGroup;
```

Phía một, nếu cần truy cập danh sách con (`ModuleGroup.java`):

```java
@Builder.Default
@OneToMany(mappedBy = "moduleGroup")
@Fetch(FetchMode.SUBSELECT)
List<Module> modules = new ArrayList<>();
```

Quy tắc:

- `@ManyToOne(fetch = FetchType.LAZY)` là phía giữ FK (mặc định JPA là `EAGER`, **bắt buộc** khai báo `FetchType.LAZY`).
- `@OneToMany(mappedBy = "...")` là phía nghịch đảo; `mappedBy` phải trùng chính xác tên field Java ở Entity bên kia.
- Không bắt buộc phải khai báo quan hệ hai chiều. Chỉ thêm collection nếu nghiệp vụ/use case cần truy cập từ cha sang con.
- Khởi tạo collection và gắn `@Builder.Default` (nếu Entity dùng `@Builder` / `@SuperBuilder`) để tránh `null` khi build đối tượng.

### 3.3. Many-to-Many (N-N) không có dữ liệu phụ

Ví dụ thực tế trong dự án (`User` ↔ `Role` trong `User.java`):

```java
@Builder.Default
@ManyToMany(fetch = FetchType.LAZY)
@JoinTable(
    name = "user_roles",
    joinColumns = @JoinColumn(name = "user_id"),
    inverseJoinColumns = @JoinColumn(name = "role_id"),
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_roles_user_role",
        columnNames = {"user_id", "role_id"}
    )
)
Set<Role> roles = new HashSet<>();
```

Phía nghịch đảo (`Permission.java` ↔ `Role`):

```java
@Builder.Default
@ManyToMany(mappedBy = "permissions", fetch = FetchType.LAZY)
Set<Role> roles = new HashSet<>();
```

Quy tắc:

1. `@JoinTable` chỉ khai báo ở một bên — owning side.
2. Bên còn lại dùng `mappedBy`.
3. Bảng join **phải có `uniqueConstraints`** trên cặp FK để ngăn một cặp quan hệ bị thêm trùng ở tầng database.
4. Ưu tiên `Set` cho N-N để thể hiện tập hợp không trùng lặp.
5. `Set` chỉ giúp ở tầng Java; **không thay thế unique constraint ở database**.
6. Khai báo rõ `fetch = FetchType.LAZY` và `@Builder.Default` (nếu có Builder).
7. Không dùng N-N trực tiếp nếu quan hệ cần lưu thêm thuộc tính nghiệp vụ.

### 3.4. Many-to-Many có dữ liệu phụ — Entity trung gian

Ví dụ thực tế trong dự án: Học viên tham gia lớp (`ClassMember`), hoặc học viên đăng ký khóa học (`CourseEnrollment`), mỗi bản ghi có `status`, `joinedAt` / `lastAccessedAt`, `department`.

Không dùng `@ManyToMany` trực tiếp vì bản thân mối quan hệ có dữ liệu riêng. Tách thành Entity trung gian (`ClassMember.java`):

```java
@Entity
@Table(
    name = "class_members",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_class_member_class_user",
        columnNames = {"class_id", "user_id"}
    )
)
public class ClassMember extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "class_id", nullable = false)
    TrainingClass trainingClass;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    ClassMemberStatus status;

    @Column(name = "joined_at")
    LocalDateTime joinedAt;
}
```

Quy tắc:

- Entity trung gian có hai quan hệ `@ManyToOne(fetch = FetchType.LAZY, optional = false)`.
- Mỗi FK trỏ về một Entity gốc.
- Đặt `uniqueConstraints` trên cặp FK nếu nghiệp vụ không cho phép trùng (ví dụ: một học viên chỉ thuộc một lớp một lần hoặc đăng ký cùng khóa học một lần).
- Nếu nghiệp vụ cho phép đăng ký lại nhiều lần, phải xác định khóa duy nhất theo đúng quy tắc đó, không áp dụng unique cặp FK một cách máy móc.
- Các thuộc tính như ngày tham gia, trạng thái, vai trò, điểm, ghi chú... thuộc về Entity trung gian vì chúng mô tả chính mối quan hệ.

### 3.5. ElementCollection — tập giá trị không cần Entity riêng

Dùng khi dữ liệu là các giá trị đơn giản hoặc key-value thuộc vòng đời của một Entity và không cần được tham chiếu độc lập.

Ví dụ map điểm (`StudentScore.java`):

```java
@Builder.Default
@ElementCollection(fetch = FetchType.EAGER)
@CollectionTable(
    name = "student_score_columns",
    joinColumns = @JoinColumn(name = "student_score_id")
)
@MapKeyColumn(name = "score_key", length = 80)
@Column(name = "score_value", precision = 8, scale = 2)
Map<String, BigDecimal> scores = new LinkedHashMap<>();
```

Ví dụ danh sách enum có chống trùng ở database (`Workspace.java`):

```java
@ElementCollection
@CollectionTable(
    name = "workspace_sections",
    joinColumns = @JoinColumn(name = "workspace_id"),
    uniqueConstraints = @UniqueConstraint(
        name = "uk_workspace_section",
        columnNames = {"workspace_id", "section"}
    )
)
@Enumerated(EnumType.STRING)
@OrderColumn(name = "display_order")
@Column(name = "section", nullable = false, length = 32)
private List<WorkspaceSection> sections = new ArrayList<>();
```

Quy tắc:

- Dữ liệu collection không phải Entity độc lập.
- `@CollectionTable` tạo bảng lưu các phần tử collection (nên đặt thêm `uniqueConstraints` nếu không được trùng phần tử trong cùng một cha).
- Ưu tiên `LAZY` (mặc định của `@ElementCollection`); chỉ dùng `EAGER` khi đã cân nhắc kỹ số lượng phần tử rất nhỏ và luôn cần cùng Entity cha.
- Khi phần tử bắt đầu có thuộc tính riêng hoặc cần được tham chiếu độc lập, nâng cấp thành Entity riêng.

### 3.6. Enum — danh sách giá trị cố định

Dùng `enum` khi tập giá trị ít, cố định và không cần quản trị như dữ liệu độc lập (ví dụ `NotificationCategory`, `ClassMemberStatus`, `EmailDeliveryStatus`).

Quy tắc:

- **Bắt buộc** dùng `@Enumerated(EnumType.STRING)` (tuyệt đối không dùng `EnumType.ORDINAL` vì thêm/đổi thứ tự enum sẽ làm sai toàn bộ dữ liệu cũ).
- Khai báo rõ `@Column(length = ...)` đủ dài cho tên hằng số enum.
- Không tạo bảng chỉ để lưu vài giá trị cố định nếu không có nhu cầu nghiệp vụ quản lý danh mục đó.

### 3.7. Snapshot / Denormalization có chủ đích

Thông thường không copy thông tin đã có ở Entity khác. Tuy nhiên, dữ liệu lịch sử/audit cần phản ánh chính xác trạng thái tại thời điểm phát sinh.

Ví dụ thực tế trong dự án:

- `ProjectTopicSnapshot` (`@Immutable`): đóng băng `topicCode`, `topicTitle`, `version`, `requirementsJson` khi gán đề tài cho Project.
- `EmailTemplateVersion`: đóng băng từng phiên bản mẫu email đã phát hành.
- `EmailAttempt`: đóng băng `recipientEmail`, `templateCode`, `templateVersion`, `subject`, `renderedBodyHtml` tại thời điểm xếp hàng gửi email.
- `NotificationAuditLog`: ghi bất biến `actorEmail`, `beforeState`, `afterState` phục vụ kiểm toán.

Chỉ chấp nhận copy dữ liệu khi thỏa **đủ 4 điều kiện**:

1. Bản ghi có tính bất biến sau khi tạo (cân nhắc `@Immutable` hoặc `updatable = false` cho cột snapshot).
2. Có lý do nghiệp vụ rõ ràng: audit log, hóa đơn, outbox gửi email, snapshot đề thi/báo cáo.
3. Có **comment/Javadoc** giải thích rõ vì sao cần lưu bản sao.
4. Không dùng dữ liệu snapshot như nguồn sự thật hiện tại để join hoặc cập nhật dữ liệu chính.

---

## 4. Quy tắc owning side và mappedBy

Trong quan hệ hai chiều, phải phân biệt:

- **Owning side:** phía quản lý quan hệ và cập nhật FK/bảng join.
- **Inverse side:** phía tham chiếu ngược, khai báo bằng `mappedBy`.

Ví dụ 1-N:

- `Module.moduleGroup` có `@ManyToOne` và `@JoinColumn(name = "module_group_id")` → owning side.
- `ModuleGroup.modules` có `@OneToMany(mappedBy = "moduleGroup")` → inverse side.

Ví dụ N-N:

- `Role.permissions` có `@JoinTable(name = "role_permissions", ...)` → owning side.
- `Permission.roles` có `@ManyToMany(mappedBy = "permissions")` → inverse side.

Lưu ý:

- `mappedBy` nhận **tên field Java**, không phải tên cột database.
- Chỉ một phía khai báo `@JoinTable` trong một quan hệ N-N hai chiều.
- Khi cập nhật quan hệ hai chiều trong bộ nhớ, phải đồng bộ cả hai phía (nên dùng helper method):

```java
public void addModule(Module module) {
    modules.add(module);
    module.setModuleGroup(this);
}

public void removeModule(Module module) {
    modules.remove(module);
    module.setModuleGroup(null);
}
```

---

## 5. Quy tắc Cascade, orphanRemoval và xóa dữ liệu

Cascade là quyết định về vòng đời dữ liệu, không phải annotation nên thêm mặc định.

### `CascadeType.ALL`

Ví dụ thực tế (`Question` → `QuestionOption`, `Rubric` → `RubricVersion`, `Milestone` → `MilestoneChecklistItem`):

```java
@OneToMany(
    mappedBy = "question",
    cascade = CascadeType.ALL,
    orphanRemoval = true
)
private List<QuestionOption> options = new ArrayList<>();
```

Chỉ dùng khi:

- Entity con thực sự phụ thuộc hoàn toàn vòng đời vào Entity cha.
- Xóa cha thì việc xóa con là đúng nghiệp vụ.
- Bỏ con khỏi collection cũng có nghĩa là xóa con khỏi database khi dùng `orphanRemoval = true`.

Không dùng `CascadeType.ALL` nếu Entity con có thể tồn tại hoặc được quản lý độc lập. Khi đó cân nhắc cascade giới hạn như `PERSIST` hoặc `MERGE` theo nhu cầu.

### `orphanRemoval = true`

- Bỏ một Entity con khỏi collection của cha sẽ khiến Entity con bị xóa khỏi database.
- Cẩn thận khi thay thế toàn bộ collection (tránh gán `this.items = newList` trên collection đang do Hibernate quản lý; hãy `clear()` rồi `addAll()`).
- Chỉ dùng khi "không còn thuộc cha" đồng nghĩa "không còn tồn tại".

### Tránh cascade REMOVE ngược chiều

Ví dụ nguy hiểm (tuyệt đối cấm):

```java
@ManyToOne(cascade = CascadeType.REMOVE)
private User user;
```

Đặt `REMOVE` ở phía con trỏ tới cha có thể dẫn đến xóa `User` khi xóa bản ghi con.

Nếu yêu cầu là **xóa cha thì xóa hoặc gỡ liên kết ở con tại tầng database**, dùng `@OnDelete` phù hợp và kiểm tra DDL:

Ví dụ thực tế trong dự án (`LessonProgress.java` và `Exam.java`):

```java
// Xóa enrollment thì xóa tiến độ học tương ứng ở DB
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "enrollment_id", nullable = false)
@OnDelete(action = OnDeleteAction.CASCADE)
CourseEnrollment enrollment;

// Xóa course thì chỉ gỡ liên kết trên Exam, không xóa Exam
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "course_id")
@OnDelete(action = OnDeleteAction.SET_NULL)
private Course course;
```

> Lưu ý: `@OnDelete` chỉ có tác dụng khi Hibernate tạo mới ràng buộc FK (DDL ban đầu); với bảng đã tồn tại trên DB production/H2 cũ, phải có script migration SQL tương ứng.

**Checklist trước khi thêm cascade:**

- [ ] Xóa Entity cha có được phép xóa Entity con không?
- [ ] Entity con có thể tồn tại độc lập không?
- [ ] Cascade đang chạy theo chiều nào?
- [ ] `orphanRemoval` có đúng với ý nghĩa nghiệp vụ không?
- [ ] Có nguy cơ xóa nhầm dữ liệu được dùng ở module khác không?

---

## 6. Fetch strategy và truy vấn quan hệ

Ưu tiên `LAZY` cho mọi quan hệ `@ManyToOne`, `@OneToOne`, `@OneToMany`, `@ManyToMany`.

```java
@ManyToOne(fetch = FetchType.LAZY, optional = false)
@JoinColumn(name = "class_id", nullable = false)
TrainingClass trainingClass;
```

Không cấu hình `EAGER` cho mọi quan hệ. Khi tải danh sách nhiều bản ghi, việc tải tất cả quan hệ gây thừa dữ liệu và vấn đề N+1.

Khi một use case cần dữ liệu quan hệ, chủ động tối ưu truy vấn ở Repository bằng `@EntityGraph` hoặc `JOIN FETCH`:

```java
@EntityGraph(attributePaths = "user")
List<ClassMember> findAllByTrainingClass_IdAndStatusOrderByIdAsc(
    Long classId,
    ClassMemberStatus status
);
```

Nguyên tắc:

- Mapping mặc định nên tránh tải dữ liệu không cần thiết (`LAZY`).
- Tối ưu theo use case truy vấn thực tế (`@EntityGraph`, `JOIN FETCH`, hoặc DTO projection).
- Kiểm tra SQL/query count, không chỉ nhìn code annotation.
- Không biến mọi quan hệ thành `EAGER` để chữa lỗi `LazyInitializationException` ở một màn hình.

---

## 7. Ràng buộc dữ liệu phải được bảo vệ ở database

Không chỉ kiểm tra ở Java/service. Các quy tắc toàn vẹn quan trọng cần được database bảo vệ.

| Ràng buộc | Mục đích |
|---|---|
| Primary Key | Định danh duy nhất bản ghi |
| Foreign Key | Bảo đảm tham chiếu tới bản ghi hợp lệ |
| `NOT NULL` | Không cho phép thiếu dữ liệu bắt buộc |
| `UNIQUE` | Ngăn trùng giá trị hoặc trùng cặp quan hệ |
| `ON DELETE` | Xác định hành vi khi bản ghi được tham chiếu bị xóa |

Ví dụ các trường hợp cần `UNIQUE`:

- FK của quan hệ 1-1 (`exam_result_publication.exam_id`, `gradebook_state.course_id`).
- Cặp FK trong bảng join N-N (`user_roles(user_id, role_id)`, `role_permissions(role_id, permission_id)`).
- Cặp FK trong Entity trung gian (`course_enrollments(user_id, course_id)`, `class_members(class_id, user_id)`).
- Khóa idempotency hoặc khóa nghiệp vụ (`user_notifications(user_id, event_key)`, `email_attempts(idempotency_key)`).

Ràng buộc phải phản ánh đúng nghiệp vụ. Không thêm `UNIQUE` nếu nghiệp vụ hợp lệ cho phép nhiều bản ghi cùng cặp tham chiếu.

---

## 8. Anti-pattern cần tránh

| Anti-pattern | Vấn đề | Cách xử lý |
|---|---|---|
| Lưu `className`, `studentName`, `courseName` thay vì FK | Trùng dữ liệu, dễ lệch khi đổi tên | Tạo Entity tương ứng và tham chiếu bằng FK |
| Dùng `@ManyToMany` khi quan hệ có thuộc tính phụ | Không có nơi đúng để lưu dữ liệu phụ | Tạo Entity trung gian (`ClassMember`, `CourseEnrollment`) |
| Dùng `List` cho quan hệ N-N không cần thứ tự | Có thể biểu diễn phần tử trùng, Hibernate delete-all-reinsert | Ưu tiên `Set` và `uniqueConstraints` |
| Không có `uniqueConstraints` ở `@JoinTable` | Database có thể lưu cặp quan hệ trùng | Thêm `uniqueConstraints = @UniqueConstraint(...)` |
| Dùng `cascade = ALL` mọi nơi | Có thể xóa dây chuyền ngoài ý muốn | Chỉ cascade theo vòng đời thực |
| Dùng `@ManyToOne(cascade = REMOVE)` tùy tiện | Có nguy cơ xóa Entity cha | Tuyệt đối cấm; xem lại chiều cascade |
| Lưu mảng dạng chuỗi `"a,b,c"` | Khó lọc/join, vi phạm 1NF | Bảng con hoặc `@ElementCollection` |
| Thiếu `@Builder.Default` với field/collection có giá trị khởi tạo | Giá trị bị `null` khi dùng `@Builder` / `@SuperBuilder` | Khởi tạo collection và thêm `@Builder.Default` |
| Dùng `@Data` trên `@Entity` | Tự sinh `equals`/`hashCode`/`toString` có thể kích hoạt lazy loading hoặc đệ quy vô hạn | Dùng `@Getter`, `@Setter`, `@NoArgsConstructor` (hoặc loại trừ quan hệ khỏi `toString`/`equals`) |
| Quan hệ hai chiều không đồng bộ | Object graph trong RAM không nhất quán | Dùng `addX()` / `removeX()` cập nhật cả hai phía |
| Dùng `EAGER` cho mọi quan hệ | Tải thừa và gây N+1 | `LAZY` + `@EntityGraph` / `JOIN FETCH` khi cần |
| Dùng `@Enumerated` mặc định (`ORDINAL`) | Chèn/đổi thứ tự enum làm sai dữ liệu cũ | Luôn dùng `@Enumerated(EnumType.STRING)` |
| Tạo bảng cho vài giá trị cố định | Mô hình phức tạp không cần thiết | Dùng `enum` nếu phù hợp |

---

## 9. Cây quyết định chọn kiểu quan hệ

```text
Hai dữ liệu A và B có liên quan
|
|-- B có thuộc tính riêng, tồn tại độc lập hoặc cần được tham chiếu?
|     |
|     |-- Không --> Có thể là thuộc tính, embedded value hoặc @ElementCollection
|     |
|     `-- Có
|          |
|          |-- Một A liên kết bao nhiêu B?
|          |     |
|          |     |-- Một
|          |     |    |
|          |     |    `-- Một B liên kết bao nhiêu A?
|          |     |          |-- Một --> 1-1 (@OneToOne LAZY + FK UNIQUE)
|          |     |          `-- Nhiều --> 1-N
|          |     |
|          |     `-- Nhiều
|          |          |
|          |          `-- Một B liên kết bao nhiêu A?
|          |                |-- Một --> 1-N theo chiều ngược
|          |                `-- Nhiều --> N-N
|          |                      |
|          |                      |-- Quan hệ có dữ liệu phụ?
|          |                      |     |-- Không --> @ManyToMany + @JoinTable + @UniqueConstraint
|          |                      |     `-- Có --> Entity trung gian
|          |                      |
|          |                      `-- Nếu chỉ là map key-value của một bản ghi:
|          |                            xem xét @ElementCollection
|
`-- Dữ liệu là snapshot lịch sử/audit?
      `-- Có thể copy có chủ đích, bất biến và ghi rõ Javadoc lý do
```

---

## 10. Checklist review trước khi commit Entity

Trả lời đủ các câu hỏi sau trước khi gửi Pull Request:

1. **Entity này đại diện cho điều gì trong nghiệp vụ?** Mô tả bằng một câu.
2. **Thuộc tính nào đang bị lặp ở bảng khác?** Có thuộc về Entity khác không?
3. **Cardinality với từng Entity liên quan là gì?** Đã hỏi cả hai chiều chưa?
4. **Vì sao chọn FK, join table hay Entity trung gian?**
5. **Các ràng buộc database nào cần có?** PK, FK, unique, not null, on delete?
6. **Đã kiểm tra DDL thật chưa?** Có cột trùng nghĩa hoặc FK bị thiếu không?

### Checklist nhanh

- [ ] Phân tích danh từ nghiệp vụ.
- [ ] Phân biệt Entity và thuộc tính.
- [ ] Xác định cardinality hai chiều.
- [ ] Chọn đúng mapping JPA.
- [ ] Xác định owning side và inverse side.
- [ ] Kiểm tra 1NF, 2NF, 3NF.
- [ ] Thêm constraint ở database (`NOT NULL`, `UNIQUE`, FK).
- [ ] Thêm `@Builder.Default` cho mọi collection/field có giá trị khởi tạo khi dùng `@Builder` / `@SuperBuilder`.
- [ ] Xem xét `cascade`/`orphanRemoval` theo vòng đời thực tế.
- [ ] Dùng `FetchType.LAZY` mặc định và tối ưu bằng `@EntityGraph` / `JOIN FETCH` khi cần.
- [ ] Dùng `@Enumerated(EnumType.STRING)` cho mọi `enum`.
- [ ] Kiểm tra DDL/migration thực tế.
- [ ] Ghi Javadoc giải thích mọi trường hợp denormalize/snapshot.

---

## 11. Bản đồ tra cứu ví dụ thực tế trong dự án

Tất cả đường dẫn dưới đây đã được xác minh trực tiếp trên codebase hiện tại (`backend/src/main/java/com/example/starter_project_2025/...`):

| Nhu cầu | File trong dự án | Vị trí / nội dung cần xem |
|---|---|---|
| 1-N, bên nhiều giữ FK (owning side) | `system/menu/module/Module.java` | Dòng 35–37: `@ManyToOne(fetch = FetchType.LAZY)` + `@JoinColumn(name = "module_group_id", nullable = false)` |
| 1-N, phía một có collection (inverse side) | `system/menu/module_groups/ModuleGroup.java` | Dòng 50–53: `@Builder.Default` + `@OneToMany(mappedBy = "moduleGroup")` |
| N-N không dữ liệu phụ & chống trùng | `system/rbac/user/User.java` | Dòng 119–144: `@ManyToMany(fetch = FetchType.LAZY)`, `@JoinTable`, `@UniqueConstraint` (`user_departments`, `user_roles`) |
| N-N không dữ liệu phụ (RBAC) | `system/rbac/role/Role.java` | Dòng 62–75: `role_permissions` với `@UniqueConstraint` |
| N-N phía nghịch đảo | `system/rbac/permission/Permission.java` | Dòng 60–62: `@ManyToMany(mappedBy = "permissions", fetch = FetchType.LAZY)` |
| N-N có dữ liệu phụ (Entity trung gian) | `system/project/trainingclass/ClassMember.java` | Dòng 24–54: `uk_class_member_class_user`, `status`, `joinedAt` |
| N-N có dữ liệu phụ (Đăng ký khóa học) | `system/demo/enrollment/CourseEnrollment.java` | Dòng 17–60: `uk_enrollment_user_course`, `department`, `lastAccessedAt` |
| 1-1 bằng FK `UNIQUE` | `system/exam/result/domain/ExamResultPublication.java` | Dòng 14–34: `@OneToOne(fetch = FetchType.LAZY, optional = false)` + `unique = true` |
| 1-1 bằng `@Table(uniqueConstraints)` | `system/exam/gradebook/GradebookState.java` | Dòng 13–24: `uk_gradebook_state_course` |
| Map key-value (`@ElementCollection`) | `system/demo/student_score/StudentScore.java` | Dòng 71–77: `student_score_columns` |
| Collection giá trị có `UNIQUE` | `system/project/workspace/domain/Workspace.java` | Dòng 85–90: `workspace_sections` + `uk_workspace_section` |
| Xóa cha → xóa con ở DB (`CASCADE`) | `system/demo/progress/LessonProgress.java` | Dòng 33–41: `@OnDelete(action = OnDeleteAction.CASCADE)` |
| Xóa cha → gỡ liên kết ở DB (`SET_NULL`) | `system/exam/core/domain/Exam.java` | Dòng 191–204: `@OnDelete(action = OnDeleteAction.SET_NULL)` |
| Cascade composition cha → con | `system/question/core/domain/Question.java` | Dòng 71: `cascade = CascadeType.ALL, orphanRemoval = true` |
| Snapshot bất biến (`@Immutable`) | `system/project/domain/ProjectTopicSnapshot.java` | Toàn file: đóng băng thông tin đề tài theo Project |
| Snapshot audit & delivery outbox | `system/notification/template/EmailTemplateVersion.java`, `system/notification/audit/NotificationAuditLog.java`, `system/notification/email/EmailAttempt.java` | Javadoc giải thích snapshot + `uniqueConstraints` chống trùng |
| Tránh N+1 bằng `@EntityGraph` | `system/project/trainingclass/ClassMemberRepository.java` | Dòng 21–25: `@EntityGraph(attributePaths = "user")` |
| `@EntityGraph` nhiều tầng | `system/project/workspace/repository/WorkspaceRepository.java` | Dòng 17–18: `attributePaths = {"tenant", "project", "team", ...}` |
| Cấu hình DB & DDL thủ công | `backend/src/main/resources/application.properties` & `backend/src/main/resources/db/manual/` | Cấu hình `ddl-auto=update`, H2 Console và các file `.sql` thủ công |

### Ghi chú hiện trạng đối chiếu & ngoại lệ legacy

Khi đọc mã nguồn cũ, cần phân biệt các mẫu **legacy** (giữ nguyên để không phá dữ liệu/API hiện có) với chuẩn áp dụng cho mọi tính năng mới:

- `system/demo/student_score/StudentScore.java`: module demo legacy đang lưu `studentCode`, `studentName`, `className` dạng chuỗi thay vì FK và dùng `@ElementCollection(fetch = FetchType.EAGER)`. **Không sao chép mẫu này cho module nghiệp vụ mới.**
- `system/demo/course/Course.java`: còn giữ cột `String instructor` legacy song song với `@ManyToOne User instructorUser` để tương thích ngược.
- Một số entity cũ ở nhóm `system/project/template/domain/*`, `system/subject/*`, `system/trainingprogram/*` vẫn đang dùng `@Data` (14 entity). Khi tạo mới hoặc refactor các entity này, chuyển sang `@Getter` / `@Setter` để tránh lỗi lazy loading khi gọi `toString()` / `equals()` / `hashCode()`.

### Tài liệu liên quan trong dự án

- [AGENTS.md](../../AGENTS.md): Quy tắc phát triển, bảo toàn dữ liệu và tổ chức tài liệu toàn dự án.
- [CLASS_DIAGRAM.md](CLASS_DIAGRAM.md): Sơ đồ lớp và kiến trúc tổng thể.
- [COMMIT_GUIDE.md](../01-getting-started/COMMIT_GUIDE.md): Quy ước commit.
- [docs/README.md](../README.md): Mục lục toàn bộ tài liệu dự án.

---

## 12. Nguyên tắc kết luận

- Thiết kế từ nghiệp vụ và dữ liệu, không thiết kế theo màn hình.
- Xác định cardinality ở cả hai chiều trước khi chọn annotation.
- Bên nhiều của quan hệ 1-N giữ FK.
- N-N có dữ liệu phụ phải cân nhắc Entity trung gian.
- `Set` không thay thế unique constraint ở database.
- Cascade và orphan removal phải dựa trên vòng đời thực tế.
- Ưu tiên `LAZY`, tối ưu truy vấn theo use case.
- Chỉ denormalize khi cần lưu snapshot/audit và có lý do rõ ràng (kèm Javadoc).
- Luôn kiểm tra DDL thực tế sau khi mapping Entity.

> **Câu hỏi vàng khi review:** "Nếu đổi thông tin này, cần sửa bao nhiêu nơi?"  
> Với dữ liệu nghiệp vụ hiện tại đã được chuẩn hóa, câu trả lời thông thường phải là **một nơi**. Ngoại lệ snapshot/audit phải được giải thích rõ.

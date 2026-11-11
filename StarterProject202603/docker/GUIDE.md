# Docker

Tài liệu này hướng dẫn **cách sử dụng Docker & Docker Compose**.

---

## 1. Cấu trúc thư mục

```text
FAS_Training_Project/
│
├─ backend/...
│ 
├─ docker/
│   ├─ .env                 # Biến môi trường (tự setup ở local)
│   ├─ .gitignore
│   ├─ dev-env.yml          # Môi trường chung (DB, Redis, …) cho development
│   ├─ docker-compose.yml   # Docker Compose cho production
│   ├─ docker.env.example   # Ví dụ / template cho docker.env
│   ├─ Dockerfile           # Dockerfile cho backend
│   └─ GUIDE.md             # File hướng dẫn
│
├─ frontend/...
└─ ...
```

### Giải thích nhanh

* Thư mục `docker/` chứa **toàn bộ cấu hình liên quan đến Docker**
* `dev-env.yml` chỉ dùng cho **development**
* `docker-compose.yml` dành cho **production / deployment**
* `.env` **không commit** lên git

---

## 2. Hướng dẫn chạy môi trường cho development (`dev-env.yml`)

### Bước 1: Setup file env

* Tạo file `.env` dựa trên `docker.env.example` tại máy local **trong folder docker**. 
* Chỉnh sửa `.env` theo môi trường local của bạn 

**Không commit file `.env`** (đã được ignore trong `.gitignore`)

---

### Bước 2: Sử dụng terminal và di chuyển về thư mục root (FAS_Training_Project/)

```bash
FAS_Training_Project> _
```

---

### Bước 3: Sử dụng lệnh dưới đây để chạy Docker Compose cho DEV

```bash
docker compose --env-file docker/.env -f docker/dev-env.yml up -d
```

Sau khi chạy xong:

* Database / Redis sẽ được khởi tạo
* Backend có thể kết nối bằng **service name** trong compose

---

### Optional

* **Dừng môi trường dev**:

```bash
docker compose -f docker/dev-env.yml down
```

* **Reset sạch (xoá cả volume / data)**:

```bash
docker compose -f docker/dev-env.yml down -v
```

    Lệnh `down -v` sẽ **xoá toàn bộ dữ liệu database**.

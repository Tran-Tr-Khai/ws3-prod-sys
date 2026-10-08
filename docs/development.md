# Phát triển local

## Yêu cầu

- Python `>=3.10,<3.14` và `uv`.
- Node.js/npm tương thích với Vite 6; dùng `npm ci` theo lockfile.
- Docker Compose và PostgreSQL 16 (hoặc service `postgres` trong `docker-compose.yml`).

## Khởi tạo backend

Chạy từ thư mục gốc repository trong PowerShell:

```powershell
uv sync --project backend --group dev
Copy-Item backend\.env.example backend\.env
docker compose up -d postgres
uv run --project backend alembic -c backend\alembic.ini upgrade head
```

Kiểm tra `backend/.env` trỏ đúng database local trước migration. `.env.example` dành cho development, không dùng làm cấu hình production.

Khởi động API:

```powershell
Set-Location backend
uv run python run.py
```

API mặc định ở `http://localhost:8000`; healthcheck là `/health`. OpenAPI thường ở `/docs` trong development.

Seed vai trò ban đầu (không tạo user):

```powershell
uv run --directory backend python -m scripts.seed
```

## Khởi tạo frontend

Trong terminal khác, tại thư mục gốc:

```powershell
npm ci
npm run dev
```

Vite chạy tại `http://localhost:5173`. API URL mẫu có trong `.env.example`; backend cần cho phép origin này ở `BACKEND_CORS_ORIGINS`.

## Tài khoản và vai trò

`seed.py` chỉ tạo role. Tạo/cập nhật user bằng CLI trong thư mục `backend`:

```powershell
uv run python -m app.db.create_user <username> <password> --name "Tên hiển thị" --role OPERATOR --machines BU-01
```

Mật khẩu tối thiểu 10 ký tự. Role CLI hỗ trợ: `ADMIN`, `PRODUCTION_MANAGER`, `SUPERVISOR`, `OPERATOR`. `--machines` nhận danh sách ID phân tách bằng dấu phẩy. Tránh dùng password thật trong shell history dùng chung hoặc tài liệu.

## Lệnh kiểm tra

```powershell
npm run lint
npm run build
uv run --project backend python -m unittest discover -s backend/tests -v
```

Migration integration tests cần PostgreSQL riêng và `MIGRATION_TEST_ADMIN_URL` có quyền tạo/xóa database test; xem [hướng dẫn Alembic](deployment/alembic-safety.md). Không trỏ biến này vào production. Kiểm thử MES mẫu có thể bỏ qua nếu thiếu fixture nội bộ.

## Quy ước thay đổi

- Thêm cấu trúc PostgreSQL: tạo migration Alembic và kiểm tra cả database trống lẫn đường nâng cấp được hỗ trợ.
- Không sửa lịch sử migration đã áp dụng tùy tiện; ngoại lệ bootstrap cần nêu lý do và kiểm chứng schema cũ/mới.
- Khi đổi request/response, cập nhật frontend/API liên quan.
- Không commit dữ liệu MES hoặc dump thật nếu chưa loại bỏ thông tin nhạy cảm.

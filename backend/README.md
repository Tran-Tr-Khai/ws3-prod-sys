# WS3 Backend

Backend là FastAPI service cung cấp API MES, authentication, snapshot/order
data, Buffing, Unrolling và Tentering realtime.

## Chạy local

Từ thư mục gốc repository:

```powershell
uv sync --project backend --group dev
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
docker compose up -d postgres
uv run --project backend alembic -c backend\alembic.ini upgrade head
uv run --directory backend python run.py
```

Không chạy lại `Copy-Item` nếu `backend/.env` đã tồn tại. File này là cấu hình
local và không được commit. Settings tự resolve đúng file dù lệnh được chạy từ
root hoặc từ thư mục `backend`.

API mặc định:

```text
http://localhost:8000/health
http://localhost:8000/docs
```

## Lệnh quản trị

Tạo role mặc định:

```powershell
uv run --directory backend python -m scripts.seed
```

Tạo user:

```powershell
uv run --directory backend python -m app.db.create_user <username> <password> --name "Tên hiển thị" --role OPERATOR --machines BU-01
```

`scripts/` chỉ chứa các lệnh bảo trì/seed do operator chạy thủ công. Business
logic và HTTP endpoint phải nằm trong `app/`.

## Kiểm thử và lint

```powershell
uv run --directory backend ruff check app scripts tests
uv run --directory backend python -m unittest discover -s tests -v
```

Migration integration test cần biến `MIGRATION_TEST_ADMIN_URL` trỏ tới một
PostgreSQL disposable có quyền tạo/xóa database test.

## File cấu hình

- `pyproject.toml`: nguồn khai báo dependency và cấu hình tooling.
- `uv.lock`: phiên bản dependency đã khóa, Docker dùng với `--frozen`.
- `Dockerfile`: image backend được cài dependency bằng `uv`.
- `alembic.ini`: vị trí migration và logging Alembic.
- `.env.example`: mẫu cấu hình backend local (`backend/.env.example` khi nhìn từ root).
- `alembic/README`: quy tắc migration và baseline hiện tại.

Đọc tài liệu repository tại [../docs/README.md](../docs/README.md) trước khi
thay đổi database hoặc API contract.

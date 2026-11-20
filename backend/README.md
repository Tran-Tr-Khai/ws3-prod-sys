# WS3 Backend

Backend là FastAPI service cung cấp API MES, authentication, snapshot/order
data, Buffing, Unrolling và Tentering realtime.

## Chạy local

Từ thư mục gốc repository:

```powershell
.\scripts\ws3.cmd dev up
```

Backend đọc `.env` của repo dù khởi chạy từ root hay từ thư mục `backend`.
PostgreSQL dev mặc định dùng cổng 5433. Mẫu cấu hình nằm ở root `.env.example`.

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
- Root `.env`: cấu hình local dùng chung; tạo từ `.env.example` ở root repository.
- `alembic/README`: quy tắc migration và baseline hiện tại.

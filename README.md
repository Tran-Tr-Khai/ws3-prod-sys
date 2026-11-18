# WS3 Production System

Hệ thống MES nội bộ gồm giao diện vận hành, API backend, PostgreSQL,
Nginx và Camera Agent cho các camera công nghiệp Hikrobot/MVS.

## 1. Yêu cầu môi trường

- Windows hoặc Ubuntu.
- Docker Desktop/Docker Engine và Docker Compose.
- `uv` cho backend local.
- Node.js/npm cho frontend local.
- PostgreSQL 16 nếu không chạy PostgreSQL bằng Docker.
- Hikrobot MVS trên máy tính được nối với camera công nghiệp.

## 2. Cấu trúc repository

```text
backend/       FastAPI, SQLAlchemy, Alembic, script quản trị và test
frontend/      React/TypeScript/Vite và cấu hình Nginx
camera-agent/  Cầu nối local tới camera Hikrobot/MVS
docs/          Tài liệu phát triển, nghiệp vụ, triển khai và vận hành
scripts/       Tiện ích ở cấp repository
```

Không commit `.env` thật, mật khẩu, secret key, dump database hoặc dữ liệu
sản xuất. Chỉ commit các file `.env.example` không chứa secret.

## 3. Chạy local để phát triển

Các lệnh dưới đây chạy từ thư mục gốc repository trong PowerShell.

### Backend và PostgreSQL

```powershell
uv sync --project backend --group dev
Copy-Item backend\.env.example backend\.env
docker compose up -d postgres
uv run --project backend alembic -c backend\alembic.ini upgrade head
uv run --directory backend python run.py
```

Nếu đã có `backend/.env`, không chạy lại `Copy-Item` vì lệnh này sẽ ghi đè
cấu hình local. API chạy tại `http://localhost:8000`.

Health check và tài liệu OpenAPI:

```text
GET  http://localhost:8000/health
GET  http://localhost:8000/docs
```

Tạo role mặc định và user thử nghiệm:

```powershell
uv run --directory backend python -m scripts.seed
uv run --directory backend python -m app.db.create_user <username> <password> --name "Tên hiển thị" --role OPERATOR --machines BU-01
```

### Frontend

Mở terminal thứ hai:

```powershell
npm ci
npm run dev
```

Frontend chạy tại `http://localhost:5173`. Các biến Vite nằm trong file `.env`
ở thư mục gốc; mẫu là `.env.example`.

### Camera Agent

Camera Agent phải chạy trên đúng máy Windows đang nối camera, không chạy trong
Docker backend:

```powershell
Set-Location camera-agent
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
ws3-camera-agent
```

Health check: `http://127.0.0.1:8765/health`. Chi tiết cài MVS và xử lý camera
xem [camera-agent/README.md](camera-agent/README.md).

## 4. Chạy toàn hệ thống bằng Docker

Đây là cách chạy gần với môi trường production. Tạo file cấu hình local từ
mẫu rồi thay các giá trị bắt buộc:

```powershell
Copy-Item .env.production.example .env.production
```

HTTP:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml up -d --build
```

HTTPS:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml -f docker-compose.https.yml `
  up -d --build
```

HTTPS yêu cầu certificate/key hợp lệ trong thư mục `WS3_TLS_DIR`. Nếu port 80
hoặc 443 đang được ứng dụng khác sử dụng, hãy dừng stack gây xung đột hoặc đổi
port trong `.env.production`.

Kiểm tra stack:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml ps
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml logs --tail=100 backend web
```

## 5. Các file cấu hình quan trọng

| File | Vai trò |
| --- | --- |
| `backend/pyproject.toml` | Dependency, phiên bản Python, cấu hình Ruff và nhóm dev của backend. |
| `backend/uv.lock` | Khóa chính xác phiên bản dependency do `uv` resolve. Không sửa thủ công. |
| `backend/requirements.production.txt` | Danh sách dependency production được `backend/Dockerfile` cài bằng pip. Phải đồng bộ với `pyproject.toml`. |
| `backend/Dockerfile` | Đóng gói API backend thành image Docker. |
| `backend/alembic.ini` | Cấu hình vị trí migration và logging của Alembic; database URL được lấy từ Settings. |
| `docker-compose.yml` | PostgreSQL tối giản cho local development. |
| `docker-compose.production.yml` | PostgreSQL, backend và web cho stack production-like. |
| `docker-compose.https.yml` | Overlay bật HTTPS và mount certificate cho Nginx. |
| `backend/.env.example` | Mẫu biến môi trường local của backend. |
| `.env.example` | Mẫu biến Vite của frontend local. |
| `.env.production.example` | Mẫu biến Compose production; không chứa secret thật. |

## 6. Kiểm tra trước khi gửi code

```powershell
npm run lint
npm run build
uv run --directory backend ruff check app scripts tests
uv run --directory backend python -m unittest discover -s tests -v
```

Migration mới phải được kiểm tra trên PostgreSQL riêng. Đọc
[docs/deployment/alembic-safety.md](docs/deployment/alembic-safety.md) trước khi
thay đổi schema hoặc deploy.

## 7. Tài liệu chi tiết

- [Tài liệu phát triển](docs/development.md)
- [Quy ước API](docs/api-conventions.md)
- [Kiến trúc và dữ liệu](docs/architecture.md)
- [Luồng MES và phân quyền](docs/production-workflows.md)
- [Triển khai production](docs/deployment/production.md)
- [An toàn Alembic](docs/deployment/alembic-safety.md)
- [Xóa dữ liệu test](docs/operations/clear-test-data.md)

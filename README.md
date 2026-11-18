# WS3 Production System

Hệ thống MES nội bộ gồm giao diện vận hành, API backend, PostgreSQL,
Nginx và Camera Agent cho các camera công nghiệp Hikrobot/MVS.

## Chọn cách chạy

| Mục đích | Chọn luồng |
| --- | --- |
| Code, debug API/UI, xem lỗi trực tiếp | [Chạy local](#3-chạy-local-để-phát-triển) |
| Chạy nguyên hệ thống bằng container | [Chạy Docker](#4-chạy-toàn-hệ-thống-bằng-docker) |

Không chạy đồng thời backend local với backend Docker trên cùng port. Camera
Agent luôn chạy trên máy được nối camera, độc lập với hai luồng trên.

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
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
docker compose up -d postgres
uv run --project backend alembic -c backend\alembic.ini upgrade head
uv run --directory backend python run.py
```

Nếu cần đổi database hoặc CORS, mở `backend\.env` trước khi chạy migration.
API chạy tại `http://localhost:8000`.

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
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
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
if (-not (Test-Path .env.production)) { Copy-Item .env.production.example .env.production }
notepad .env.production
```

Trước khi chạy, bắt buộc thay `POSTGRES_PASSWORD` và `AUTH_SECRET_KEY`. Đặt
`BACKEND_CORS_ORIGINS` theo đúng URL/IP người dùng truy cập, ví dụ
`https://192.168.100.253`. Không dùng giá trị `REPLACE_WITH_...`.

HTTP:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml up -d --build
```

Có thể kiểm tra cấu hình đã được Compose resolve trước khi tạo container:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml config --quiet
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

Overlay HTTPS hiện yêu cầu hai file sau trong `WS3_TLS_DIR`:

```text
ws3-lan.crt
ws3-lan.key
```

Kiểm tra stack:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml ps
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml logs --tail=100 backend web
```

Dừng stack nhưng giữ volume database:

```powershell
docker compose -p ws3 --env-file .env.production `
  -f docker-compose.production.yml -f docker-compose.https.yml down
```

Không dùng `down -v` nếu chưa có chủ đích xóa database và media volume.

Nếu gặp `port is already allocated`, kiểm tra container đang chiếm port:

```powershell
docker ps --format "table {{.Names}}\t{{.Ports}}"
docker compose -p ws3 ps
```

## 5. Các file cấu hình quan trọng

| File | Vai trò |
| --- | --- |
| `backend/pyproject.toml` | Nguồn khai báo dependency, phiên bản Python, cấu hình Ruff và nhóm dev của backend. |
| `backend/uv.lock` | Khóa chính xác phiên bản dependency; Docker dùng file này với `--frozen`. |
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

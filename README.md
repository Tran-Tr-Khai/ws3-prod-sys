# WS3 Production System

Hệ thống MES nội bộ gồm giao diện vận hành, API backend, PostgreSQL,
Nginx và Camera Agent cho các camera công nghiệp Hikrobot/MVS.

## Chọn cách chạy

| Mục đích | Chọn luồng |
| --- | --- |
| Code, debug API/UI, xem lỗi trực tiếp | [Chạy local](#3-chạy-local-để-phát-triển) |
| Kiểm tra hoặc triển khai nguyên hệ thống | [Chạy staging và production](#4-chạy-staging-và-production) |

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
infra/compose/ Cấu hình Docker cho dev và triển khai
environments/  Mẫu cấu hình staging và production
scripts/       Tiện ích ở cấp repository
```

Không commit `.env` thật, mật khẩu, secret key, dump database hoặc dữ liệu
sản xuất. Chỉ commit các file `.env.example` không chứa secret.

## 3. Chạy local để phát triển

Các lệnh dưới đây chạy từ thư mục gốc repository trong PowerShell.

### Khởi động dev

```powershell
.\scripts\ws3.cmd dev up
```

Launcher tạo `.env` từ mẫu nếu chưa có, khởi động PostgreSQL thuộc project
`ws3-dev`, áp dụng migration rồi mở hai terminal cho API và frontend. API mặc
định ở cổng 8000, frontend ở 5173 và PostgreSQL dev ở 5433.

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

Khi muốn chạy riêng frontend, dùng:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev
```

Frontend chạy tại `http://localhost:5173`. Vite chuyển tiếp `/api` và `/ws`
đến backend local.

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

## 4. Chạy staging và production

Mỗi thư mục triển khai có một `.env` riêng. Tạo file từ mẫu [staging](environments/.env.staging.example)
hoặc [production](environments/.env.production.example), rồi điền cổng, origin,
đường dẫn chứng chỉ và thông tin đăng nhập của môi trường đó.

```powershell
.\scripts\ws3.cmd staging config -EnvFile ..\ws3-staging\.env
.\scripts\ws3.cmd staging up -EnvFile ..\ws3-staging\.env
```

Nếu `.env` nằm ở root của checkout staging/prod, bỏ `-EnvFile`. Trên Ubuntu, dùng
`pwsh -File ./scripts/ws3.ps1` trên Ubuntu.

Staging và production dùng cùng stack HTTPS. Production giữ project `ws3`;
staging dùng `ws3-staging`. Lệnh `down` giữ volume. Khi chuyển từ `.env.production`
cũ, thêm `APP_ENV=production` và giữ nguyên project `ws3`, database và chứng chỉ.

## 5. Các file cấu hình quan trọng

| File | Vai trò |
| --- | --- |
| `backend/pyproject.toml` | Nguồn khai báo dependency, phiên bản Python, cấu hình Ruff và nhóm dev của backend. |
| `backend/uv.lock` | Khóa chính xác phiên bản dependency; Docker dùng file này với `--frozen`. |
| `backend/Dockerfile` | Đóng gói API backend thành image Docker. |
| `backend/alembic.ini` | Cấu hình vị trí migration và logging của Alembic; database URL được lấy từ Settings. |
| `infra/compose/docker-compose.yml` | PostgreSQL tối giản cho local development. |
| `infra/compose/docker-compose.production.yml` | PostgreSQL, backend và web cho stack production-like. |
| `infra/compose/docker-compose.https.yml` | Overlay bật HTTPS và mount certificate cho Nginx. |
| `.env.example` | Mẫu cấu hình local dùng chung cho backend và PostgreSQL. |
| `frontend/src/config/runtime.ts` | Endpoint mặc định của frontend local và logic chọn URL runtime. |
| `environments/.env.production.example` | Mẫu biến Compose production; không chứa secret thật. |

## 6. Kiểm tra trước khi gửi code

```powershell
Set-Location frontend
npm run check
npm run build
Set-Location ..
uv run --directory backend ruff check app scripts tests
uv run --directory backend python -m unittest discover -s tests -v
```

Migration mới phải được kiểm tra trên PostgreSQL riêng trước khi deploy.

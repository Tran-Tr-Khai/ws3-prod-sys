# WS3 Production System

Ứng dụng nội bộ theo dõi vận hành và dữ liệu sản xuất WS3. Hệ thống gồm giao diện React/Vite, API FastAPI, PostgreSQL và dịch vụ Nginx; dữ liệu MES được nạp dưới dạng snapshot Excel.

## Bắt đầu

- Tài liệu dự án: [docs/README.md](docs/README.md)
- Chạy môi trường local: [docs/development.md](docs/development.md)
- Kiến trúc và dữ liệu: [docs/architecture.md](docs/architecture.md)
- Luồng MES và phân quyền: [docs/production-workflows.md](docs/production-workflows.md)
- Triển khai Ubuntu/Docker: [docs/deployment/production.md](docs/deployment/production.md)
- An toàn migration Alembic: [docs/deployment/alembic-safety.md](docs/deployment/alembic-safety.md)
- Xóa dữ liệu ứng dụng, giữ tài khoản đăng nhập: [docs/operations/clear-test-data.md](docs/operations/clear-test-data.md)

## Công nghệ và cấu trúc

- Frontend: React 18, TypeScript, Vite, npm.
- Backend: Python, FastAPI, SQLAlchemy, Alembic.
- Database: PostgreSQL 16.
- Triển khai: Docker Compose và Nginx; HTTPS dùng chứng chỉ do đơn vị vận hành cung cấp.

```text
backend/      API, mô hình dữ liệu, migration, script quản trị và kiểm thử
frontend/     mã giao diện React/TypeScript và cấu hình Nginx
docs/         tài liệu nghiệp vụ, phát triển, triển khai và vận hành
scripts/      tiện ích triển khai/demo
```

Không lưu bí mật, file `.env` thực tế, dump database hoặc dữ liệu sản xuất trong Git. Luôn đọc hướng dẫn tương ứng trước khi thay đổi database hoặc triển khai lên server.

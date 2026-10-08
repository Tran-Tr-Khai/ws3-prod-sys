# Kiến trúc hệ thống

## Tổng quan

```text
Trình duyệt --HTTP(S)--> Nginx (frontend + reverse proxy)
                              | /api
                              v
                          FastAPI --SQLAlchemy/Alembic--> PostgreSQL 16
                            |
                            +--> media volume (ảnh/file vận hành)
```

Compose production có ba service: `web`, `backend`, `postgres`. Backend chờ PostgreSQL healthy, chạy `alembic upgrade head` rồi khởi động Uvicorn. Web phụ thuộc healthcheck backend. PostgreSQL và media nằm trên named volumes, không nằm trong filesystem tạm của container.

## Mã nguồn

- `backend/app/api/routes/`: API theo miền nghiệp vụ.
- `backend/app/models/`, `backend/app/schemas/`: mô hình database và hợp đồng request/response.
- `backend/app/services/`: xử lý nghiệp vụ, đọc snapshot MES và lập báo cáo.
- `backend/alembic/versions/`: lịch sử schema; thay đổi mới cần migration tiến về phía trước.
- `backend/tests/`: kiểm thử API, báo cáo, Unrolling và nâng cấp database.
- `frontend/src/features/`: màn hình nghiệp vụ; `frontend/src/auth/`: đăng nhập.
- `frontend/src/components/`: component dùng chung, bao gồm HMI.
- `frontend/nginx.conf`, `frontend/nginx.https.conf`: cấu hình proxy HTTP/HTTPS.

## Dữ liệu và độ bền

| Loại dữ liệu | Lưu ở đâu | Lưu ý |
|---|---|---|
| Tài khoản, vai trò, phiên | PostgreSQL | Mật khẩu dạng hash; xóa phiên khiến user đăng nhập lại |
| Snapshot MES, đơn hàng | PostgreSQL | Nguồn cho tổng quan, đơn và Unrolling |
| Scouring/Buffing, lịch sử | PostgreSQL | Ảnh Buffing có metadata DB và file trong media volume |
| Ticket/thông báo | PostgreSQL | Cần backup cùng database |
| Ảnh đính kèm | `MEDIA_ROOT` trên media volume | Backup/restore riêng với dump PostgreSQL |
| Cấu hình | Environment/`.env.production` | Không commit secret |

## API cấp cao

Production mặc định dùng prefix `/api`; healthcheck tại `/health`.

- `/api/auth/*`: đăng nhập, đăng xuất, phiên hiện tại.
- `/api/ws3/data-snapshot`, `/api/ws3/production-orders`, `/api/ws3/unrolling/*`: dữ liệu MES, đơn và Unrolling.
- `/api/scouring/*`, `/api/buffing/checks/*`: bản ghi và lịch sử máy.
- `/api/support/*`: ticket, tin nhắn và thông báo vận hành.
- `/api/machine-orders/progress`: tiến độ đơn theo máy.

`API_PREFIX` điều chỉnh prefix nhóm API chung; Scouring, Buffing, Support và Auth được mount tại `/api`. Không đổi prefix production nếu chưa kiểm tra đồng bộ Nginx/frontend.

## Ranh giới tin cậy

- Xác thực bằng cookie session HTTP-only `ws3_session`; bật cookie Secure qua cấu hình HTTPS production.
- Không đưa `AUTH_SECRET_KEY`, mật khẩu database hay thông tin tài khoản vào tài liệu, log chia sẻ hoặc Git.
- CORS cấu hình qua `BACKEND_CORS_ORIGINS`; chỉ khai báo origin được phép.
- UI ẩn/hiện màn hình theo role để tiện sử dụng; route nhạy cảm vẫn cần xác thực/phân quyền ở backend.

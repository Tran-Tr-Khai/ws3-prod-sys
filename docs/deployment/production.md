# Deploy website production trên Ubuntu

Tài liệu này dành cho website chính trong `~/project/ws3-prod-sys`, Compose project `ws3`. Không dùng tên project test thay cho project chính. Chỉ deploy sau khi xác nhận commit và có backup phù hợp.

## Xác nhận trước deploy

```bash
cd ~/project/ws3-prod-sys
git status --short
git log -1 --oneline
docker compose -p ws3 --env-file .env.production \
  -f docker-compose.production.yml -f docker-compose.https.yml ps
```

Nếu working tree trên server có thay đổi chưa hiểu, dừng và kiểm tra trước khi pull. Đảm bảo `.env.production` có các biến bắt buộc như `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET_KEY`, `BACKEND_CORS_ORIGINS`; không in giá trị bí mật ra terminal/log chia sẻ. HTTPS cần chứng chỉ và key hợp lệ tại `WS3_TLS_DIR` (mặc định `./infra/tls`).

## Backup database trước thay đổi

```bash
dc() {
  docker compose -p ws3 --env-file .env.production \
    -f docker-compose.production.yml -f docker-compose.https.yml "$@"
}

dc ps
backup_file="/tmp/ws3-predeploy-$(date +%Y%m%d-%H%M%S).dump"
dc exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
test -s "$backup_file"
dc exec -T postgres pg_restore --list < "$backup_file"
printf 'Backup file: %s\n' "$backup_file"
```

Lưu/copy backup sang vùng bền vững theo chính sách công ty; `/tmp` không phải backup dài hạn. Nếu cần giữ ảnh Buffing, backup media volume riêng theo quy trình đã xác minh.

## Cập nhật toàn website

Sau khi xác nhận backup và branch/commit đúng:

```bash
git pull --ff-only
git log -1 --oneline
dc up -d --build --force-recreate
dc ps
dc logs --tail=100 backend web
```

Không thêm tên service ở cuối lệnh cuối nếu mục tiêu là build/cập nhật toàn bộ website. Backend startup chạy `alembic upgrade head` trước Uvicorn; theo dõi log và healthcheck đến khi backend healthy, web hoạt động và trang truy cập được qua HTTP/HTTPS.

Kiểm tra nhanh:

```bash
dc exec -T backend python -c \
  "from urllib.request import urlopen; print(urlopen('http://127.0.0.1:8000/health').read().decode())"
dc ps
```

Đăng nhập, kiểm tra màn hình chính và luồng dữ liệu cần thiết. Nếu schema thay đổi, xác nhận `alembic current` trong backend.

## Cổng và Compose projects

HTTPS overlay publish web trên host ports 80/443. Nếu `ws3-lan-test` cũng khởi chạy web với cùng mapping, Docker báo `port is already allocated`; đây là xung đột cổng, không phải lỗi build. Không dừng/xóa stack khác để né lỗi. Nếu chỉ cập nhật backend của project test thì website chính không đổi; muốn cập nhật website chính, target Compose project `ws3` như trên.

## Nếu backend restart hoặc migration lỗi

```bash
dc ps
dc logs --tail=200 backend
dc exec -T postgres sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version_num FROM alembic_version;"'
```

Nếu backend không chạy được, `dc run --rm --no-deps backend alembic current` cho phép xem revision mà không phụ thuộc service backend đang restart. Chỉ upgrade sau khi đã đọc [an toàn Alembic](alembic-safety.md). Giữ traceback, revision, commit và backup. Không `stamp head`, xóa volume hoặc truncate bảng để né lỗi migration. Rollback code không tự đảo schema; restore backup cần quy hoạch và xác nhận tương thích phiên bản.

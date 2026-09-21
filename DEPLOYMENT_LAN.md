# WS3 – Tài liệu triển khai mạng LAN

Tài liệu này mô tả cách chạy WS3 trên máy Windows hiện tại để các máy khác trong mạng nội bộ truy cập và kiểm thử.

## 1. Kiến trúc triển khai

```text
Máy người dùng trong LAN
        |
        | http://<IP-máy-dev>:80
        v
Web/Nginx container
        |
        v
Backend/FastAPI container
        |
        v
PostgreSQL container
```

Chỉ container `web` mở cổng ra máy Windows. Backend và PostgreSQL không mở cổng trực tiếp ra LAN.

Production Compose dùng project riêng `ws3-lan-test`, nên không dùng chung container hoặc volume với môi trường dev `ws3-prod-sys`.

## 2. Điều kiện cần

- Docker Desktop đang cài trên Windows.
- Docker Engine đang ở trạng thái `Engine running`.
- Máy dev và máy người dùng nằm cùng mạng LAN.
- Máy dev có IP LAN ổn định trong thời gian test.
- Cổng TCP 80 chưa bị ứng dụng khác sử dụng.

Kiểm tra Docker:

```powershell
docker version
```

Kết quả hợp lệ phải có cả phần `Client:` và `Server:`.

Kiểm tra IP máy dev:

```powershell
ipconfig
```

Ví dụ IP hiện tại của máy dev là `192.168.101.7`. Nếu DHCP cấp IP mới, phải dùng IP mới khi truy cập LAN.

## 3. Cấu hình production

File mẫu nằm ở:

```text
.env.production.example
```

Tạo file thật:

```powershell
Set-Location D:\pj\ws3-prod-sys
Copy-Item .env.production.example .env.production
```

Mở file để chỉnh:

```powershell
notepad .env.production
```

Nội dung tối thiểu:

```dotenv
POSTGRES_DB=ws3
POSTGRES_USER=ws3_app
POSTGRES_PASSWORD=<mat-khau-rieng-dai-va-ngau-nhien>
BACKEND_CORS_ORIGINS=http://192.168.101.7
WS3_HTTP_PORT=80
```

Lưu ý:

- Không dùng lại mật khẩu dev.
- Không đưa `.env.production` lên Git.
- Khi IP thay đổi, cập nhật `BACKEND_CORS_ORIGINS`.
- Nếu mật khẩu đã bị gửi trong chat hoặc tài liệu, phải đổi lại trước khi dùng lâu dài.

## 4. Khởi chạy lần đầu

Mở PowerShell và chạy đúng thứ tự:

```powershell
Set-Location D:\pj\ws3-prod-sys
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml up -d --build --force-recreate
```

Lệnh này sẽ:

1. Build backend.
2. Build frontend và đóng gói vào Nginx.
3. Tạo PostgreSQL production riêng.
4. Chạy Alembic migration.
5. Tạo network private/public.
6. Publish web ra cổng 80.

Kiểm tra trạng thái:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml ps
```

Trạng thái mong đợi:

```text
postgres   Up ... (healthy)
backend    Up ... (healthy)
web        Up ...
```

Kiểm tra ánh xạ cổng web:

```powershell
docker port ws3-lan-test-web-1
```

Kết quả cần có dạng:

```text
80/tcp -> 0.0.0.0:80
```

## 5. Kiểm tra trên máy dev

Mở trình duyệt tại:

```text
http://localhost
```

Hoặc:

```text
http://192.168.101.7
```

API health check nội bộ:

```powershell
curl.exe http://localhost/api/health
```

Kết quả mong đợi:

```json
{"status":"ok"}
```

## 6. Mở truy cập LAN an toàn

Chỉ thực hiện sau khi `http://localhost` hoạt động.

Mở PowerShell bằng quyền Administrator, sau đó chạy rule giới hạn trong mạng nội bộ:

```powershell
New-NetFirewallRule `
  -DisplayName "WS3 LAN HTTP 80" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 80 `
  -Profile Domain,Private `
  -RemoteAddress LocalSubnet
```

Từ máy khác trong LAN, truy cập:

```text
http://192.168.101.7
```

Kiểm tra cổng từ một máy Windows khác:

```powershell
Test-NetConnection 192.168.101.7 -Port 80
```

Không mở port PostgreSQL `5432` hoặc backend `8000` ra LAN.

## 7. Cập nhật phiên bản sau khi sửa code

Trong giai đoạn phát triển, xem giao diện nhanh bằng Vite:

```powershell
Set-Location D:\pj\ws3-prod-sys
npm run dev
```

Truy cập:

```text
http://localhost:5173
```

Chỉ deploy LAN sau khi đã duyệt xong thay đổi:

```powershell
Set-Location D:\pj\ws3-prod-sys
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml up -d --build --force-recreate
```

Nếu chỉ Docker Desktop vừa khởi động lại mà code không đổi, không cần build:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml up -d
```

## 8. Xem log và xử lý sự cố

Xem toàn bộ log:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml logs --tail=150
```

Chỉ xem backend:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml logs --tail=150 backend
```

Chỉ xem web:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml logs --tail=150 web
```

Các lỗi thường gặp:

| Hiện tượng | Kiểm tra |
|---|---|
| `localhost refused to connect` | Docker Engine, trạng thái container và port 80 |
| Backend `unhealthy` | Log `backend`, thường là migration hoặc database |
| Máy khác không truy cập được | IP máy dev, Windows Firewall, network profile |
| Docker chỉ hiện `Client` | Docker Engine/WSL chưa sẵn sàng |
| IP truy cập không được sau khi restart máy | Chạy `ipconfig`, IP DHCP có thể đã đổi |

Nếu Docker Desktop bị kẹt ở `Engine starting`, không dùng `Clean / Purge data` hoặc `Reset to factory defaults`. Có thể đóng Docker Desktop, chạy:

```powershell
wsl --shutdown
```

Sau đó mở lại Docker Desktop và chờ `Engine running`.

## 9. Dừng và khởi động lại

Dừng riêng bản LAN nhưng giữ database volume:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml stop
```

Khởi động lại:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml start
```

Xóa container/network nhưng giữ volume database:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml down
```

Không thêm `-v` nếu chưa chủ động muốn xóa database test.

## 10. Backup database

Backup database production LAN:

```powershell
docker exec ws3-lan-test-postgres-1 pg_dump -U ws3_app -d ws3 > ws3-lan-backup.sql
```

File backup nên được lưu ở nơi an toàn và không đưa lên Git.

## 11. Dữ liệu mẫu kiểm thử

Script tạo mẫu Buffing và Scouring hiện nằm ở:

```text
scripts\seed-lan-demo.ps1
```

Chạy bằng PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\pj\ws3-prod-sys\scripts\seed-lan-demo.ps1"
```

Script dùng thời điểm hiện tại, người vận hành `TNTKhai` và tự tránh tạo trùng mẫu test.

## 12. Chuyển từ máy dev sang server cố định

Khi công ty có server cố định:

1. Sao chép source code và file Compose lên server.
2. Tạo `.env.production` mới trên server.
3. Đặt mật khẩu database mới, không dùng mật khẩu test.
4. Cập nhật IP hoặc hostname trong `BACKEND_CORS_ORIGINS`.
5. Dùng IP cố định hoặc DHCP reservation.
6. Chỉ mở TCP 80 từ mạng nội bộ.
7. Backup database cũ trước khi chuyển dữ liệu.
8. Chạy lại lệnh khởi động production.

Không cần thay đổi kiến trúc ứng dụng; chỉ thay đổi IP/hostname, secret và dữ liệu database.

# Nginx trong hệ thống WS3

## 1. Nginx là gì?

Nginx là một web server và reverse proxy. Nói đơn giản, Nginx là “cổng vào” đứng trước ứng dụng:

```text
Trình duyệt trong mạng LAN
            |
            v
      Nginx :80
       /     \
      /       \
 Frontend   Backend :8000
                |
                v
          PostgreSQL :5432
```

Nginx không phải database và cũng không thay thế backend. Nó tiếp nhận request HTTP, quyết định request đó cần trả file giao diện hay chuyển tiếp cho backend.

## 2. Nginx đang làm gì trong WS3?

Trong WS3, Nginx nằm trong container `web`. Frontend được build thành các file tĩnh rồi được chép vào:

```text
/usr/share/nginx/html
```

Container web mở cổng nội bộ 80 và Docker publish cổng đó ra máy phát triển:

```yaml
ports:
  - "${WS3_HTTP_PORT:-80}:80"
```

Vì vậy người dùng trong mạng LAN chỉ cần mở:

```text
http://192.168.101.7
```

hoặc địa chỉ IP hiện tại của máy deploy.

## 3. Luồng xử lý request

### Truy cập giao diện

Khi người dùng mở `/`:

```text
Browser → Nginx → /usr/share/nginx/html/index.html
```

Nginx trả HTML, JavaScript, CSS và các asset đã được Vite build.

### Gọi API

Frontend gọi các URL bắt đầu bằng `/api/`, ví dụ:

```text
/api/scouring/records
/api/buffing/checks
```

Nginx chuyển tiếp các request đó tới service backend bằng tên service Docker:

```text
Browser → Nginx → http://backend:8000 → FastAPI → PostgreSQL
```

Tên `backend` hoạt động vì web và backend cùng tham gia mạng Docker `ws3_private`. Người dùng bên ngoài không cần biết địa chỉ hoặc cổng thật của backend.

### WebSocket

Khu vực `/ws/` được cấu hình riêng để giữ các header `Upgrade` và `Connection`. Điều này cần thiết nếu sau này hệ thống sử dụng WebSocket cho dữ liệu thời gian thực.

## 4. Giải thích cấu hình hiện tại

File cấu hình chính là `frontend/nginx.conf`.

```nginx
listen 80;
```

Nginx lắng nghe HTTP trên cổng 80 trong container.

```nginx
server_name _;
```

Chấp nhận request tới bất kỳ hostname nào. Điều này phù hợp với môi trường LAN truy cập bằng IP.

```nginx
root /usr/share/nginx/html;
index index.html;
```

Chỉ định nơi chứa frontend đã build và file giao diện mặc định.

```nginx
location /api/ {
    proxy_pass http://backend:8000;
}
```

Mọi request `/api/` được chuyển sang backend FastAPI.

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Đây là cấu hình quan trọng cho React Router. Nếu người dùng mở trực tiếp một đường dẫn như `/machine/scouring/history`, Nginx vẫn trả `index.html` để React tự xử lý route thay vì trả lỗi 404.

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Các header này giúp backend biết IP client và giao thức gốc của request.

## 5. Vì sao Nginx được dùng phổ biến?

### Một địa chỉ truy cập duy nhất

Không có Nginx, người dùng có thể phải truy cập frontend và backend bằng các cổng khác nhau. Có Nginx, toàn bộ hệ thống dùng một địa chỉ:

```text
http://192.168.101.7
```

### Tách frontend và backend

Frontend chỉ phục vụ file giao diện. Backend chỉ tập trung xử lý API. Cấu trúc này rõ ràng và dễ bảo vệ hơn.

### Không công khai database và backend

Trong cấu hình hiện tại:

- PostgreSQL không publish cổng ra máy host.
- Backend không publish cổng `8000` ra máy host.
- Chỉ Nginx publish cổng HTTP.

Đây là lý do người dùng LAN chỉ nhìn thấy web, không truy cập trực tiếp database.

### Hiệu năng tốt

Nginx phục vụ file tĩnh rất nhẹ và ổn định. Backend không phải xử lý việc trả từng file CSS, JavaScript hoặc hình ảnh.

### Dễ mở rộng

Sau này có thể bổ sung:

- HTTPS/TLS.
- Cache file tĩnh.
- Giới hạn request.
- Nén response.
- Chuyển traffic tới nhiều backend.
- Log truy cập và log lỗi tập trung.

## 6. Nếu không dùng Nginx thì sao?

Có thể bỏ Nginx, nhưng cần thay thế chức năng của nó bằng cách khác.

### Phương án A: Dùng Vite dev server

```text
Browser → Vite :5173
```

Ưu điểm:

- Dễ chạy khi phát triển.
- Có hot reload.
- Không cần build image frontend.

Nhược điểm:

- Không phù hợp production.
- Có thể expose source map và cơ chế dev.
- Không phải web server tối ưu cho mạng công ty.
- Cần cấu hình proxy API riêng.
- Không phản ánh chính xác môi trường deploy thật.

Đây là cách phù hợp khi lập trình trên máy dev, không phải cách nên dùng cho sếp hoặc người dùng LAN test dài ngày.

### Phương án B: Chạy frontend bằng một static server khác

Có thể dùng Apache, Caddy, Node static server hoặc một web server khác.

Các server này vẫn phải làm những việc tương tự Nginx:

- Trả file frontend.
- Fallback về `index.html` cho React Router.
- Proxy `/api` tới backend.
- Mở cổng HTTP/HTTPS.

Bỏ Nginx không làm mất các yêu cầu đó; chỉ là chuyển chúng sang công cụ khác.

### Phương án C: Backend phục vụ luôn frontend

Có thể copy thư mục frontend build vào FastAPI rồi để backend trả cả HTML và API.

Ưu điểm:

- Chỉ còn một service chính.
- Kiến trúc ban đầu có vẻ đơn giản hơn.

Nhược điểm:

- Backend phải đảm nhiệm cả API và file tĩnh.
- Khó tách riêng frontend khi cần mở rộng.
- Cấu hình cache và HTTPS kém linh hoạt hơn.
- Dễ làm service backend phức tạp.
- Không phải lựa chọn tối ưu cho production.

### Kết luận khi bỏ Nginx

Ứng dụng vẫn có thể chạy, nhưng cần chọn một thành phần khác để thay Nginx. Với WS3, giữ Nginx là lựa chọn hợp lý vì nó đơn giản, nhẹ và phù hợp với mô hình LAN hiện tại.

## 7. Nginx và bảo mật trong WS3

Nginx giúp giảm bề mặt truy cập, nhưng bản thân Nginx không tự động bảo mật toàn bộ hệ thống.

Các lớp bảo vệ hiện tại:

1. Chỉ web publish cổng ra host.
2. Backend và PostgreSQL nằm trong mạng Docker riêng.
3. PostgreSQL dùng volume để giữ dữ liệu.
4. Backend chạy production mode, không bật debug.
5. Docker restart container khi process dừng.

Các việc nên bổ sung khi đưa vào sử dụng chính thức:

- Chỉ cho phép subnet công ty truy cập cổng 80.
- Bật HTTPS nếu có domain hoặc chứng thư nội bộ.
- Không mở cổng PostgreSQL ra LAN nếu không cần.
- Đặt mật khẩu database dài và không commit `.env.production`.
- Sao lưu volume PostgreSQL định kỳ.
- Theo dõi log Nginx và backend.

## 8. Các lệnh kiểm tra Nginx

### Xem trạng thái các service

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml ps
```

### Xem log Nginx

```powershell
docker compose -p ws3-lan-test logs -f web
```

### Kiểm tra cấu hình Nginx

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml exec web nginx -t
```

Kết quả đúng thường có dạng:

```text
syntax is ok
test is successful
```

### Xem toàn bộ cấu hình đang chạy

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml exec web nginx -T
```

### Kiểm tra cổng publish

```powershell
docker port ws3-lan-test-web-1
```

Kết quả mong đợi khi dùng cổng 80:

```text
80/tcp -> 0.0.0.0:80
```

### Kiểm tra nhanh từ máy deploy

```powershell
Invoke-WebRequest http://localhost
Invoke-WebRequest http://localhost/api/health
```

Nếu truy cập từ máy khác trong LAN:

```powershell
Invoke-WebRequest http://192.168.101.7
```

## 9. Chẩn đoán lỗi thường gặp

### Browser báo connection refused

Kiểm tra theo thứ tự:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml ps
docker port ws3-lan-test-web-1
Test-NetConnection localhost -Port 80
```

Nguyên nhân thường là Docker Desktop chưa chạy, container web đã dừng, cổng 80 bị chiếm hoặc firewall chặn.

### Trang có giao diện nhưng API lỗi

Xem log cả web và backend:

```powershell
docker compose -p ws3-lan-test logs --tail=150 web backend
```

Kiểm tra backend có healthy không:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml ps
```

### Refresh route React bị 404

Kiểm tra `location /` còn dòng sau không:

```nginx
try_files $uri $uri/ /index.html;
```

### Nginx không kết nối được backend

Trong Docker Compose phải dùng tên service:

```nginx
proxy_pass http://backend:8000;
```

Không dùng `localhost:8000` trong Nginx, vì `localhost` bên trong container web trỏ tới chính container web, không trỏ tới backend.

## 10. Quy trình deploy WS3 có Nginx

Tại thư mục project, chạy PowerShell:

```powershell
Set-Location D:\pj\ws3-prod-sys
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml up -d --build --force-recreate
```

Kiểm tra:

```powershell
docker compose -p ws3-lan-test --env-file .env.production -f docker-compose.production.yml ps
Invoke-WebRequest http://localhost
```

Khi chỉ chỉnh frontend, có thể kiểm tra bằng dev server trước:

```powershell
npm run dev
```

Chỉ khi giao diện đã được duyệt mới build lại Docker image và deploy LAN. Nginx sẽ nhận frontend build mới sau khi container `web` được tạo lại.

## 11. Tóm tắt dễ nhớ

```text
Nginx = cửa chính của hệ thống web

/             → trả giao diện frontend
/api/...      → chuyển tới backend
/ws/...       → chuyển WebSocket tới backend
PostgreSQL    → không cho truy cập trực tiếp từ LAN
```

Không dùng Nginx vẫn có thể chạy, nhưng phải dùng Vite, Apache, Caddy hoặc backend để thay thế. Trong môi trường production/LAN của WS3, giữ Nginx giúp hệ thống có một cổng truy cập duy nhất, tách biệt rõ frontend/backend và an toàn hơn.

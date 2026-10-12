# Tài liệu WS3

Tài liệu mô tả mã nguồn hiện có và cách vận hành đã đối chiếu với repository. Nếu tài liệu khác hành vi thực tế, xác minh lại phiên bản/commit trước khi thao tác trên server.

| Tài liệu | Nội dung |
|---|---|
| [Kiến trúc](architecture.md) | Thành phần hệ thống, nơi lưu dữ liệu, request và quy tắc thiết kế |
| [Phát triển local](development.md) | Cài dependencies, cấu hình môi trường, chạy frontend/backend, kiểm tra |
| [Luồng sản xuất và MES](production-workflows.md) | Snapshot Excel, Unrolling, Buffing, Scouring và quyền truy cập |
| [Deploy production](deployment/production.md) | Compose project chính `ws3`, backup, cập nhật website và kiểm tra |
| [An toàn Alembic](deployment/alembic-safety.md) | Migration, phục hồi lỗi và rollout schema |
| [Dọn dữ liệu ứng dụng](operations/clear-test-data.md) | Xóa dữ liệu test nhưng giữ tài khoản và bảng xác thực |

## Quy tắc an toàn dữ liệu

1. Xác nhận đúng máy chủ, thư mục dự án, Compose project, service và database trước lệnh ghi/xóa.
2. Tạo và kiểm tra backup trước thao tác phá hủy hoặc nâng cấp schema; file dump khác rỗng chưa chứng minh restore được.
3. Không dùng `docker compose down -v`, `TRUNCATE`, `DROP`, `alembic stamp head` hay downgrade trên dữ liệu đang dùng nếu chưa có kế hoạch phù hợp.
4. `ws3` là website chính; `ws3-lan-test` là Compose project khác. Cả hai không thể đồng thời publish web trên cùng host ports 80/443.
5. Nạp snapshot MES thay thế dữ liệu của nguồn được chọn; kiểm tra file trước khi import.

Sau khi truncate các bảng nghiệp vụ, tài khoản có thể đăng nhập nhưng dashboard/history sẽ trống tới khi nạp lại snapshot MES và phát sinh bản ghi mới. Xóa hàng database không đồng nghĩa ảnh đã bị xóa khỏi media volume.

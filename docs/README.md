# Tài liệu WS3 MES

Tài liệu này chỉ mô tả phần WS3 MES đã hoàn thiện. Khi tài liệu và mã nguồn
khác nhau, commit đang triển khai là nguồn tham chiếu trước khi thao tác trên
server hoặc database.

## Dành cho phát triển

| Tài liệu | Nội dung |
|---|---|
| [Phát triển local](development.md) | Cài dependency, chạy backend/frontend và kiểm tra thay đổi. |
| [Kiến trúc](architecture.md) | Thành phần hệ thống, dữ liệu, ranh giới tin cậy và các module nguồn. |
| [HTTP API](api-conventions.md) | API `/api`, naming contract và quy tắc thay đổi tương thích. |

## Dành cho vận hành

| Tài liệu | Nội dung |
|---|---|
| [Luồng sản xuất MES](operations/production-workflows.md) | Snapshot Excel, Unrolling, Buffing, Tentering và phạm vi máy hỗ trợ. |
| [Deploy production](deployment/production.md) | Compose project `ws3`, backup, cập nhật website và kiểm tra. |
| [An toàn Alembic](deployment/alembic-safety.md) | Baseline schema, migration tiến và xử lý database hiện hữu. |
| [Dọn dữ liệu ứng dụng](operations/clear-test-data.md) | Xóa dữ liệu test nhưng giữ tài khoản và bảng xác thực. |

## Quy tắc an toàn dữ liệu

1. Xác nhận đúng máy chủ, thư mục dự án, Compose project, service và database trước lệnh ghi/xóa.
2. Tạo và kiểm tra backup trước thao tác phá hủy hoặc nâng cấp schema; file dump khác rỗng chưa chứng minh restore được.
3. Không dùng `docker compose down -v`, `TRUNCATE`, `DROP`, `alembic stamp head` hay downgrade trên dữ liệu đang dùng nếu chưa có kế hoạch phù hợp.
4. `ws3` là website chính; `ws3-lan-test` là Compose project khác. Cả hai không thể đồng thời publish web trên cùng host ports 80/443.
5. Nạp snapshot MES thay thế dữ liệu của nguồn được chọn; kiểm tra file trước khi import.

Sau khi truncate các bảng nghiệp vụ, tài khoản có thể đăng nhập nhưng dashboard/history sẽ trống tới khi nạp lại snapshot MES và phát sinh bản ghi mới. Xóa hàng database không đồng nghĩa ảnh đã bị xóa khỏi media volume.

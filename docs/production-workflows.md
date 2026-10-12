# Luồng sản xuất và dữ liệu MES

## Nạp dữ liệu MES

Trang quản trị nhận ba nguồn Excel: `ORDER`, `MACHINE`, `WORKER`. Backend hỗ trợ `.xls` và `.xlsx`, tìm header trong 30 dòng đầu, kiểm tra cột bắt buộc và ràng buộc dữ liệu (ngày, định danh, số cuộn, mét). Logic header/đơn vị nằm ở backend; không đổi header theo suy đoán.

Mỗi lần nạp thay thế snapshot hiện tại của đúng nguồn được chọn. File được parse/validate trước khi thay thế; lỗi transaction giữ dữ liệu cũ. Nạp một nguồn không làm mới các nguồn còn lại. Sau import hãy xem trạng thái nguồn và kiểm tra số lượng/mẫu dữ liệu.

Các khóa liên kết lấy từ mã MES (PK/OUT/ORDER, SOP, roll, máy, ngày và định danh liên quan); không ghép dòng chỉ theo vị trí. Khóa thiếu hoặc trùng có thể làm báo cáo thiếu/không xác định được quan hệ. Khi điều tra, giữ file gốc và ghi nhận nguồn/ngày nạp.

## Unrolling

Unrolling nhận dữ liệu đơn/cuộn từ MES và ghi thao tác gom/chuyển cuộn; đây không phải form tạo lại đơn sản xuất thủ công. Danh sách phụ thuộc snapshot MES. Worker được phân công máy Unrolling ghi thông tin người thực hiện theo luồng vận hành và thao tác roll; hoàn tác/chuyển tiếp được lưu thành event lịch sử.

Nếu danh sách đơn/cuộn trống sau khi dọn database, kiểm tra trạng thái snapshot và nạp lại các file nguồn cần thiết. Không khắc phục bằng cách tạo đơn giả nếu mục đích là khôi phục MES.

## Buffing

Worker ghi checklist chất lượng theo từng lượt, kèm thông tin vận hành/đơn và ảnh khi cần. Tổng quan tính từ các lượt liên quan đến đơn: số lượt có lỗi trên tổng lượt kiểm tra; trạng thái `ĐẠT` chỉ đúng khi tổng lỗi bằng 0. Ảnh được lưu ngoài database trong media volume, nên backup cần bao gồm volume này.

## Scouring

Worker ghi bản ghi vận hành và kiểm tra pH theo các màn hình tương ứng. Lịch sử đọc từ các bảng Scouring; số mét của quy trình này không thay cho số lượt checklist Buffing.

## Máy và giao diện

Các máy dùng chung component nhập thông tin vận hành ở frontend, nhưng dữ liệu/đơn được chọn vẫn thuộc từng máy. Màn hình placeholder không đồng nghĩa nghiệp vụ máy đã triển khai đầy đủ.

## Tài khoản và quyền

| Vai trò | Mục đích |
|---|---|
| `ADMIN` | Quản trị; giao diện có trang kho dữ liệu MES dành cho admin |
| `PRODUCTION_MANAGER` / `SUPERVISOR` | Giám sát và truy cập các màn supervisor được cấp |
| `OPERATOR` | Ghi nhận máy được phân công; giao diện giới hạn theo machine ID |

CLI hỗ trợ cả `SUPERVISOR`, nhưng seed ban đầu chỉ tạo `ADMIN`, `PRODUCTION_MANAGER`, `OPERATOR`. Operator cần machine ID chính xác như `SC-01`, `BU-01`, `TE-01`, `UN-01`. Backend là ranh giới bảo mật chính; cần rà soát policy backend khi thêm route.

## Sau khi xóa dữ liệu test

Runbook [dọn dữ liệu](operations/clear-test-data.md) giữ user/role/session nhưng xóa các bảng nghiệp vụ khác. Đăng nhập vẫn hoạt động, còn dashboard/history trống cho tới khi nạp lại snapshot MES và phát sinh bản ghi mới.

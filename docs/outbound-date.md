# Ngày xuất thực tế — 19/11/2026

## Mục tiêu và cách dùng

Trong **Giỏ xuất hàng**, chọn **Ngày xuất thực tế** trước khi xác nhận xuất. Mặc định là hôm nay theo giờ Việt Nam. Có thể chọn ngày trước; không nhận ngày tương lai, ngày không hợp lệ hoặc thiếu ngày. Mỗi lượt xuất áp dụng một ngày cho toàn bộ các dòng trong giỏ. Nhập bù nhiều ngày phải chia thành từng lượt theo ngày thực tế.

Ví dụ: nhân viên nhập ngày 19/11, chọn 17/11. Giao dịch ghi ngày xuất thực tế 17/11, còn thời điểm nhập hệ thống vẫn là 19/11. Tồn kho giảm một lần khi xác nhận thành công.

## Quy tắc dữ liệu

- `InventoryTransaction.outboundDate`: ngày lịch, PostgreSQL `date`, chỉ dùng cho `CUSTOMER_OUT` và `TRANSFER`.
- `createdAt`: thời điểm nhập hệ thống, giữ mặc định từ cơ sở dữ liệu; không nhận giá trị thay thế từ giao diện. Lịch sử hiển thị theo múi giờ thiết bị bằng cơ chế đã triển khai trước đó.
- Máy chủ xác thực ngày; cơ sở dữ liệu kiểm tra ngày thực tế không vượt quá ngày nhập theo giờ Việt Nam. Payload của tab cũ không có ngày sẽ bị từ chối, cần tải lại trang.
- Báo cáo Kế toán kho và CSV dùng `outboundDate` cho xuất bán/COGS và chuyển kho. Nhập NCC, hàng hoàn/trả vẫn tính vào ngày nhập/nhận lại như trước. Giá vốn, phân loại hoàn/trả và công thức xuất ròng giữ nguyên.
- Lịch sử và CSV giao dịch giữ cả ngày thực tế lẫn thời điểm nhập để đối soát.
- Không thay đổi bảng tồn kho hoặc thời điểm nhập của giao dịch cũ. Không tạo giao dịch xuất thử trên kho vận hành.

## Dữ liệu trước khi bật tính năng

Cột mới để trống với toàn bộ giao dịch cũ, không tự suy ra ngày thực tế từ ngày nhập. Lịch sử ghi **Chưa xác nhận**. Báo cáo giữ số liệu cũ, xếp tạm theo ngày nhập giờ Việt Nam và cảnh báo rõ số dòng chưa xác nhận trong toàn bộ lịch sử của luồng đang xem. Vì vậy số 0 của một ngày cũ không chứng minh ngày đó không xuất hàng.

Lô nhập gộp ngày 17–18/11 cần bảng đối chiếu thực tế theo SKU và số lượng từng ngày trước khi có thể phân bổ lại. **Không xuất lại lô đó**, vì sẽ trừ tồn kho lần nữa. Tính năng này chưa có chức năng sửa ngày hoặc chia lại giao dịch cũ.

## Thay đổi cấu trúc và phát hành

SQL bổ sung: `prisma/sql/20261119_outbound_date.sql`. Thêm một cột nullable, ràng buộc kiểm tra và chỉ mục; không backfill, không cập nhật/xóa giao dịch. Áp dụng SQL một lần vào database trước khi phát hành mã mới; không dùng `db push` để bỏ qua ràng buộc kiểm tra. Nếu cần quay lui mã, giữ nguyên cột và dữ liệu mới; không xóa cột vì sẽ mất ngày đã chọn. Mã cũ sẽ chưa phân loại được COGS theo ngày thực tế, nên cần báo rõ nếu rollback.

## Kiểm chứng trước phát hành

- 84 kiểm thử hiện có đã đạt sau khi cập nhật hợp đồng ngày và CSV.
- 8 kiểm thử riêng đạt: ngày lịch/qua nửa đêm Việt Nam, nhập bù qua tháng, từ chối ngày thiếu/trùng/tương lai, lưu ngày nhưng giữ thời điểm nhập, rollback giao dịch lỗi, phân ngày COGS không đếm trùng, lịch sử/CSV, giao diện gửi đúng ngày.
- PostgreSQL nhúng PGlite đã chạy SQL migration và bộ lọc dữ liệu giả lập; kiểm tra dữ liệu cũ không đổi, ràng buộc loại giao dịch/ngày tương lai hoạt động.
- Migration đã thử trên nhánh Neon tách riêng từ dữ liệu thật: cột kiểu `date`, ràng buộc và chỉ mục hiện diện; 0 dòng bị tự gán ngày. Chưa sửa dữ liệu kho thật trong bước thử.
- Lint đạt, còn 3 cảnh báo sẵn có ngoài phần thay đổi. Production build và kiểm tra kiểu dữ liệu đạt. Chưa áp dụng migration vào kho vận hành; đang chờ xác nhận cuối theo yêu cầu của công cụ Neon. Computer Use dừng do không xác định chắc chắn URL Chrome, nên chưa kiểm tra giao diện trực tiếp.

## Bước tiếp theo

Áp dụng migration đã thử vào database vận hành, phát hành mã, kiểm tra giao diện và báo cáo đọc thật. Chỉ xác nhận luồng xuất thật khi nhân viên sử dụng cho một giao dịch thực tế; không tạo đơn giả để thử trên production.

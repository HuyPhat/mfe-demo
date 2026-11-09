# TODO: cải tiến sau

## Bỏ `remotes.json` tĩnh, lấy URL remote từ nguồn động

**Hiện tại:** [host/public/remotes.json](host/public/remotes.json) là file tĩnh, viết tay. Host fetch nó lúc chạy ([host/src/bootstrap.tsx](host/src/bootstrap.tsx)). Mỗi lần release hay rollback một remote, ai đó phải sửa file này thủ công.

**Mục tiêu:** ở production, URL của remote được cập nhật tự động mỗi lần release một remote, không cần sửa tay.

**Hướng làm** (chọn một):
- Pipeline release của mỗi remote tự ghi URL bản mới vào `remotes.json` (ví dụ file trên CDN).
- Một config service / API trả về JSON `{ name: manifestUrl }`. Host đổi `fetch('/remotes.json')` thành gọi API đó.

**Việc cần quyết định khi làm:**
- Nguồn cấu hình nằm ở đâu (CDN, API, service riêng).
- Rollback: giữ lịch sử các URL cũ để quay lại nhanh.
- Cache: file/API này không nên bị cache lâu, nếu không release mới sẽ không đến người dùng kịp.

**Xong khi:** release một remote chỉ cần chạy pipeline của remote đó, host không phải build lại và không ai phải sửa `remotes.json` bằng tay.

## Canary / A-B: trả URL remote theo từng người dùng

**Hiện tại:** mọi người dùng nhận cùng một `remotes.json`, nên release một remote là release cho 100% người dùng ngay.

**Mục tiêu:** một phần người dùng (ví dụ 5%) nhận bản mới, số còn lại nhận bản cũ. Tăng dần phần trăm nếu ổn, hạ về 0 để rollback tức thì.

**Hướng làm:**
- Host gọi một API (ví dụ `/api/remotes`) thay vì đọc file tĩnh (đổi dòng `fetch` trong `host/src/bootstrap.tsx`). Việc này gắn với mục trên.
- API băm ID người dùng (hoặc cookie) rồi lấy phần dư cho 100. Nhỏ hơn `percent` thì trả URL bản canary, ngược lại trả bản ổn định.
- Dùng dịch vụ feature flag thay vì tự viết, nếu không muốn quản lý logic chia nhóm.

**Việc cần quyết định khi làm:**
- Định danh dùng để chia nhóm: ID đăng nhập hay cookie ẩn danh.
- Đảm bảo một người luôn vào cùng một nhóm (không đổi bản giữa các lần tải).
- API không được cache, vì mỗi người một đáp án.
- Gắn nhãn version vào log lỗi và số liệu để so sánh nhóm canary với nhóm còn lại.

**Xong khi:** đổi một con số phần trăm là thay đổi được số người dùng nhận bản mới, không phải build hay sửa file.

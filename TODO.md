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

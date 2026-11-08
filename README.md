# Micro-frontend demo: React + Rspack + Module Federation 2.0

Một shop nhỏ gồm **3 ứng dụng độc lập**. Mỗi app build, chạy và deploy riêng, rồi được ghép lại thành một trang khi chạy trên trình duyệt (runtime).

| App        | Port | Vai trò                     | Team giả định |
|------------|------|-----------------------------|---------------|
| `host`     | 3000 | Shell: layout, header, nạp các remote | Platform team |
| `products` | 3001 | Remote: danh sách sản phẩm   | Catalog team  |
| `cart`     | 3002 | Remote: giỏ hàng             | Checkout team |

```bash
npm install
```

```bash
npm run dev
```

Mở http://localhost:3000. Có thể mở riêng từng remote: http://localhost:3001 và http://localhost:3002.

Phiên bản dùng: Rspack 2.3, `@module-federation/enhanced` 2.9 (Module Federation 2.0), React 19.

---

## Phần 1: Kiến thức nền

### 1.1 Micro-frontend là gì?

Đây là cách chia **một giao diện lớn** thành nhiều **app nhỏ**. Mỗi app thuộc về một team, có repo, CI/CD và lịch release riêng. Ý tưởng giống microservices, nhưng áp dụng cho frontend.

Vấn đề nó giải quyết: khi có 5 đến 10 team cùng sửa một monolith frontend, mọi thay đổi phải chờ chung một lần build và một lần release. Một team làm hỏng thì cả trang hỏng, và các team phải merge code chồng lên nhau.

**Đừng dùng micro-frontend khi** chỉ có 1 hoặc 2 team, hoặc app còn nhỏ. Cái giá phải trả là độ phức tạp vận hành, rủi ro trùng thư viện và khó debug. Câu này rất hay được hỏi khi phỏng vấn: *"Khi nào KHÔNG nên dùng micro-frontend?"*

### 1.2 Các cách ghép micro-frontend

| Cách | Ghép lúc nào | Ưu | Nhược |
|---|---|---|---|
| npm package | build-time | đơn giản | muốn update thì host phải rebuild, nên **không** deploy độc lập được |
| iframe | runtime | cô lập tuyệt đối | UX kém (scroll, modal, routing), khó chia sẻ state, nặng |
| Web Components | runtime | không phụ thuộc framework | vẫn phải tự lo việc tải code và chia sẻ thư viện |
| **Module Federation** | **runtime** | deploy độc lập, **chia sẻ dependency** (một bản React duy nhất), lazy load | phải quản lý version và contract cẩn thận |
| single-spa | runtime | điều phối lifecycle nhiều framework | thường được dùng *kèm* Module Federation |

### 1.3 Module Federation hoạt động thế nào

- **Remote**: app *cho đi* code. Nó khai báo `exposes` và build ra file `remoteEntry.js` (cùng `mf-manifest.json`).
- **Host** (consumer): app *nhận* code. Khi chạy, nó tải `remoteEntry` của remote rồi gọi `loadRemote('products/ProductList')`.
- **Shared**: các thư viện dùng chung (react, react-dom). Lúc runtime, các app "thương lượng" để chọn ra **một phiên bản** dùng chung, gọi là share scope.
- Một app có thể vừa là host vừa là remote.

```
 Browser
 ┌──────────────────── host :3000 ─────────────────────┐
 │ fetch /remotes.json → registerRemotes()             │
 │                                                     │
 │  loadRemote('products/ProductList')                 │
 │        │                       loadRemote('cart/Cart')
 │        ▼                               ▼            │
 │  :3001/mf-manifest.json         :3002/mf-manifest.json
 │                                                     │
 │  share scope: react@19.3.1 (từ host, dùng chung) ◄──┤
 │                                                     │
 │  products ──CustomEvent 'cart:add'──► cart          │
 │  cart ──CustomEvent 'cart:changed'──► host header   │
 └─────────────────────────────────────────────────────┘
```

---

## Phần 2: Đi qua code từng bước

### Bước 1: Cấu trúc và tính độc lập (`package.json` ở root)

Mỗi thư mục là một **npm workspace** riêng, có `package.json`, `rspack.config.mjs` và `version` riêng. Ở công ty thật, mỗi thư mục thường là **một repo riêng**. Monorepo ở đây chỉ để bạn chạy demo cho tiện.

Ba file `rspack.config.mjs` gần như giống nhau, và đó là **cố ý**. Nếu tách ra một file config dùng chung, các app sẽ bị ràng buộc với nhau, mất đi tính độc lập.

### Bước 2: Expose một remote ([products/rspack.config.mjs](products/rspack.config.mjs))

```js
new ModuleFederationPlugin({
  name: 'products',
  filename: 'remoteEntry.js',
  exposes: { './ProductList': './src/ProductList.jsx' },
  shared: { react: { singleton: true, requiredVersion: pkg.dependencies.react }, ... },
})
```

- `exposes` là **public API** của micro-frontend này. Chỉ những gì được expose mới được phép dùng từ bên ngoài. Hãy coi nó như API của backend: đổi tên hay xoá thì là **breaking change**.
- `output.publicPath: 'auto'`: các chunk được tải theo đường dẫn của nơi đang host `remoteEntry`. Nhờ vậy bạn deploy lên CDN ở path nào cũng chạy được.
- `output.uniqueName`: tránh đụng tên biến global khi nhiều app cùng nằm trên một trang.
- `Access-Control-Allow-Origin: *` trong devServer: host ở `:3000` tải file từ `:3001`, tức là khác origin, nên cần CORS.

### Bước 3: Bootstrap pattern ([*/src/index.js](host/src/index.js))

```js
import('./bootstrap');
```

Vì sao không import React ngay trong `index.js`? Module Federation cần **một điểm bất đồng bộ** (async boundary) để kịp tải remote và thương lượng xem dùng bản React nào **trước khi** code của bạn chạy. Nếu import React đồng bộ ngay từ đầu, bạn sẽ gặp lỗi kiểu `Shared module is not available for eager consumption`. Đây là câu hỏi phỏng vấn kinh điển.

### Bước 4: Shared dependencies và versioning thư viện

```js
react: { singleton: true, requiredVersion: '^19.3.1' }
```

- `singleton: true`: cả trang chỉ có **một** bản React. Nếu có hai bản React, hooks sẽ hỏng (`Invalid hook call`), context không truyền qua được, và người dùng phải tải code gấp đôi.
- `requiredVersion`: dải semver mà app chấp nhận. Nếu bản được chọn không thoả dải này, console sẽ hiện warning.
- `strictVersion: true` (không bật trong demo): nếu lệch version thì **ném lỗi** thay vì chỉ cảnh báo.
- `eager: true`: đưa thư viện vào bundle chính, không tải async. Chỉ dùng khi thật sự cần, vì nó làm bundle to ra.

Mình đã kiểm tra trong browser rằng `react@19.3.1` được tải **một lần từ host**, và `useIn: [host, products, cart]`. Bạn có thể tự xem bằng cách gõ vào DevTools console: `__FEDERATION__.__SHARE__`.

**Thư viện nào nên share?** Những thư viện có state toàn cục hoặc bắt buộc chỉ có một bản: react, react-dom, router, design system. **Không nên** share mọi thứ, vì càng share nhiều thì càng phải phối hợp version giữa các team nhiều.

### Bước 5: Dynamic remotes, để deploy và rollback không cần rebuild host ([host/src/bootstrap.jsx](host/src/bootstrap.jsx))

```js
const remotes = await fetch('/remotes.json').then((r) => r.json());
registerRemotes(Object.entries(remotes).map(([name, entry]) => ({ name, entry })));
```

Cách *cơ bản* là ghi cứng URL vào config của host: `remotes: { products: 'products@http://.../remoteEntry.js' }`. Cách này có một vấn đề: muốn trỏ host sang bản remote mới hay rollback về bản cũ thì phải **rebuild host**.

Cách *nâng cao* dùng trong demo này: URL của remote nằm trong một file JSON và được đọc **lúc runtime**. Ở production, file đó thường được thay bằng một config service hoặc một file trên CDN. Khi đó:

- **Release**: team products upload bản build lên `cdn/products/1.1.0/`, sau đó sửa manifest thành `"products": "https://cdn/products/1.1.0/mf-manifest.json"`.
- **Rollback**: sửa manifest trỏ về `1.0.0`. Việc này mất vài giây và không cần build lại gì.
- **Canary / A-B**: config service trả URL v1.1.0 cho 5% người dùng, v1.0.0 cho số còn lại.

`mf-manifest.json` là định dạng của Module Federation 2.0. Nó chứa danh sách module được expose, các shared lib và version, nên runtime có thể preload hoặc kiểm tra trước khi tải code.

### Bước 6: Isolation, để remote lỗi mà trang vẫn sống ([host/src/RemoteComponent.jsx](host/src/RemoteComponent.jsx))

Remote là code của team khác, được deploy lúc nào không biết, nên **phải coi nó là không đáng tin**:

- `ErrorBoundary`: remote ném lỗi lúc render, hoặc tải `remoteEntry` thất bại (404, CDN chết), thì chỉ ô đó hiện fallback, phần còn lại vẫn chạy. Mình đã thử trỏ `cart` sang port chết: products vẫn hoạt động, ô cart hiện lỗi `RUNTIME-003 Failed to get manifest` cùng nút "Thử lại".
- `Suspense` cùng `lazy`: remote chỉ được tải khi cần. Có `cache` để mỗi remote chỉ tạo `lazy()` một lần; nếu không, mỗi lần render React sẽ mount lại component.
- **CSS isolation**: `products` và `cart` đều có class `.box` và `.title`, nhưng nhờ **CSS Modules** (`type: 'css/module'`) tên class được hash nên không đè lên nhau. Các cách khác: prefix theo tên app, CSS-in-JS, Shadow DOM (cô lập mạnh nhất nhưng khó làm theme).
- **Global isolation**: không ghi lung tung lên `window`, và `uniqueName` phải khác nhau giữa các app.

### Bước 7: Interoperability, tức là giao tiếp giữa các micro-frontend

Products **không import** Cart. Hai bên chỉ nói chuyện qua **contract** là browser `CustomEvent`:

| Event          | Ai gửi   | Ai nghe     | `detail`              |
|----------------|----------|-------------|-----------------------|
| `cart:add`     | products | cart        | `{ id, name, price }` |
| `cart:changed` | cart     | host header | `{ count }`           |

Vì sao không dùng chung một Redux store? Một store chung buộc mọi team phải dùng chung cấu trúc state và chung version thư viện. Như vậy là **coupling**, và các team lại phải release cùng lúc, mất đi lợi ích chính của micro-frontend. Nguyên tắc là **mỗi micro-frontend tự quản lý state của mình và chỉ công bố event hoặc props**.

Các kênh giao tiếp, xếp từ ít coupling đến nhiều coupling:

1. URL / query string: mọi app đều đọc được, và người dùng có thể bookmark.
2. Props từ host truyền xuống: `<Remote userId={...} />`.
3. Custom events / pub-sub: cách dùng trong demo này.
4. Shared store được expose như một remote module: mạnh nhưng coupling nhiều nhất.

Contract chính là **API có version**. Nếu cần đổi cấu trúc `detail`, hãy thêm event mới (`cart:add.v2`) và giữ event cũ một thời gian, đừng sửa thẳng vào event cũ.

### Bước 8: Standalone mode ([products/src/bootstrap.jsx](products/src/bootstrap.jsx))

Mỗi remote tự chạy được một mình (port 3001 hoặc 3002), có mock những phần phụ thuộc. Nhờ đó team phát triển và test mà không cần chạy host. Đây là một phần của **scalability về mặt tổ chức**: thêm team mới thì không làm chậm các team cũ.

---

## Phần 3: Bài lab, tự làm để có kinh nghiệm thật

1. **Deploy độc lập**: đổi `"version"` trong `products/package.json` thành `1.1.0`, rồi sửa text trong `ProductList.jsx`. Restart **chỉ** products (vì version được đọc lúc khởi động), rồi reload host: products đã đổi mà **host không bị build lại**.
2. **Remote chết**: tắt riêng cart (hoặc sửa port trong `host/public/remotes.json` thành `3999`), rồi reload. Products vẫn chạy, ô cart hiện lỗi.
3. **Remote crash lúc render**: thêm `throw new Error('boom')` vào `Cart.jsx`. Hãy xem ErrorBoundary bắt lỗi thế nào.
4. **Lệch version**: trong `cart/rspack.config.mjs`, đặt `requiredVersion: '^18.0.0'` và đọc warning trong console. Sau đó thêm `strictVersion: true` và xem lỗi xảy ra.
5. **Bỏ singleton**: xoá `singleton: true` khỏi cả 3 app, sau đó xem `__FEDERATION__.__SHARE__` và tab Network. Hãy hiểu vì sao nhiều bản React là nguy hiểm.
6. **Bỏ bootstrap**: chuyển nội dung `bootstrap.jsx` vào thẳng `index.js` và xem lỗi eager consumption.
7. **Mô phỏng CDN có version** (production):

   ```bash
   npm run build
   ```

   Copy `products/dist` vào `cdn/products/1.0.0/`, sửa code rồi build tiếp ra `cdn/products/1.1.0/`. Serve thư mục `cdn` bằng `npx serve --cors cdn -p 4000`, rồi đổi `remotes.json` qua lại giữa hai version. Đó chính là release và rollback.

---

## Phần 4: Câu hỏi phỏng vấn thường gặp

**Q: Micro-frontend giải quyết vấn đề gì? Khi nào không nên dùng?**
Nó giúp nhiều team deploy độc lập và mỗi team sở hữu trọn một mảng sản phẩm. Không nên dùng khi team nhỏ hoặc app nhỏ, vì độ phức tạp vận hành lớn hơn lợi ích.

**Q: Module Federation khác npm package ở điểm nào?**
npm package được ghép lúc build: muốn update thì consumer phải bump version và rebuild. Module Federation ghép lúc runtime: remote deploy xong là consumer nhận ngay.

**Q: Làm sao tránh tải React nhiều lần?**
Khai báo `shared` với `singleton: true` cùng `requiredVersion`. Bootstrap pattern cho phép runtime thương lượng version trước khi code chạy.

**Q: Hai team cần hai major version khác nhau của cùng một thư viện thì sao?**
Nếu thư viện không bắt buộc singleton (ví dụ lodash), hãy bỏ `singleton`. Mỗi app sẽ lấy bản thoả `requiredVersion` của mình, chấp nhận tải 2 bản. Nếu là React thì phải thống nhất major version trong toàn tổ chức, và nâng cấp bằng cách cho host hỗ trợ cả hai bản trong giai đoạn chuyển tiếp.

**Q: Versioning remote thế nào để rollback nhanh?**
Mỗi bản build được upload lên CDN theo path bất biến (`/products/1.2.0/`). Host đọc URL từ manifest hoặc config service lúc runtime (dynamic remotes). Rollback chỉ là sửa một dòng config. Nhớ đặt cache: `remoteEntry`/manifest cache ngắn hoặc không cache, các chunk có hash thì cache lâu dài.

**Q: Remote chết hoặc lỗi thì sao?**
Dùng ErrorBoundary và Suspense fallback cho từng remote, có retry, và có thể thêm runtime plugin `errorLoadRemote` để chuyển sang URL dự phòng. Remote lỗi không được phép làm sập cả trang.

**Q: Các micro-frontend giao tiếp với nhau thế nào?**
Ưu tiên cách ít coupling: URL, props, custom events. Contract được đặt version như một API. Tránh dùng shared global store.

**Q: CSS bị xung đột thì xử lý ra sao?**
Dùng CSS Modules, prefix, CSS-in-JS hoặc Shadow DOM. Design tokens nên được chia sẻ qua CSS variables.

**Q: Đảm bảo type safety giữa các app thế nào?**
Module Federation 2.0 có tính năng `dts`: remote tự sinh file `.d.ts` của các module được expose, host tải về khi dev. Ngoài ra nên có contract test hoặc e2e test chạy trên bản ghép thật.

**Q: Scale lên 20 micro-frontend thì cần gì?**
- Một registry hoặc config service quản lý URL và version của các remote.
- Preload các remote quan trọng.
- Mỗi remote có ngân sách bundle size.
- Shared deps được quản lý tập trung (một danh sách version được phép dùng).
- Mỗi team tự lo observability cho remote của mình (log lỗi gắn tên remote và version).
- Routing: host quản lý route cấp cao nhất, remote tự quản lý route con.

---

## Những gì demo cố ý chưa làm (và nên thêm khi nào)

- **Routing** (react-router chia route giữa host và remote): thêm khi có nhiều trang.
- **TypeScript + `dts`**: thêm khi dự án dùng TS. Demo tắt `dts: false` cho gọn.
- **Runtime plugin fallback/retry** (`errorLoadRemote`, `@module-federation/retry-plugin`): thêm khi đã có CDN dự phòng.
- **Shared design system** (expose dưới dạng remote hoặc shared singleton): thêm khi có từ 2 app trở lên cần cùng một UI kit.

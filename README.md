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

Phiên bản dùng: Rspack 2.3, `@module-federation/enhanced` 2.9 (Module Federation 2.0), React 19, TypeScript 7.

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
  exposes: { './ProductList': './src/ProductList.tsx' },
  shared: { react: { singleton: true, requiredVersion: pkg.dependencies.react }, ... },
})
```

- `exposes` là **public API** của micro-frontend này. Chỉ những gì được expose mới được phép dùng từ bên ngoài. Hãy coi nó như API của backend: đổi tên hay xoá thì là **breaking change**.
- `output.publicPath: 'auto'`: các chunk được tải theo đường dẫn của nơi đang host `remoteEntry`. Nhờ vậy bạn deploy lên CDN ở path nào cũng chạy được.
- `output.uniqueName`: tránh đụng tên biến global khi nhiều app cùng nằm trên một trang.
- `Access-Control-Allow-Origin: *` trong devServer: host ở `:3000` tải file từ `:3001`, tức là khác origin, nên cần CORS.

### Bước 3: Bootstrap pattern ([*/src/index.ts](host/src/index.ts))

```js
import('./bootstrap');
```

Vì sao không import React ngay trong `index.ts`? Module Federation cần **một điểm bất đồng bộ** (async boundary) để kịp tải remote và thương lượng xem dùng bản React nào **trước khi** code của bạn chạy. Nếu import React đồng bộ ngay từ đầu, bạn sẽ gặp lỗi kiểu `Shared module is not available for eager consumption`. Đây là câu hỏi phỏng vấn kinh điển.

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

### Bước 5: Dynamic remotes, để deploy và rollback không cần rebuild host ([host/src/bootstrap.tsx](host/src/bootstrap.tsx))

```js
const remotes = await fetch('/remotes.json').then((r) => r.json());
registerRemotes(Object.entries(remotes).map(([name, entry]) => ({ name, entry })));
```

Cách *cơ bản* là ghi cứng URL vào config của host: `remotes: { products: 'products@http://.../remoteEntry.js' }`. Cách này có một vấn đề: muốn trỏ host sang bản remote mới hay rollback về bản cũ thì phải **rebuild host**.

Cách *nâng cao* dùng trong demo này: URL của remote nằm trong một file JSON và được đọc **lúc runtime**. Ở production, file đó thường được thay bằng một config service hoặc một file trên CDN. Khi đó:

- **Release**: team products upload bản build lên `cdn/products/1.1.0/`, sau đó sửa `remotes.json` của host thành `"products": "https://cdn/products/1.1.0/mf-manifest.json"`.
- **Rollback**: sửa `remotes.json` trỏ về `1.0.0`. Việc này mất vài giây và không cần build lại gì.
- **Canary / A-B**: config service trả URL v1.1.0 cho 5% người dùng, v1.0.0 cho số còn lại.

`mf-manifest.json` là định dạng của Module Federation 2.0. Nó chứa danh sách module được expose, các shared lib và version, nên runtime có thể preload hoặc kiểm tra trước khi tải code.

### Bước 6: Isolation, để remote lỗi mà trang vẫn sống ([host/src/RemoteComponent.tsx](host/src/RemoteComponent.tsx))

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

### Bước 8: Standalone mode ([products/src/bootstrap.tsx](products/src/bootstrap.tsx))

Mỗi remote tự chạy được một mình (port 3001 hoặc 3002), có mock những phần phụ thuộc. Nhờ đó team phát triển và test mà không cần chạy host. Đây là một phần của **scalability về mặt tổ chức**: thêm team mới thì không làm chậm các team cũ.

### Bước 9: TypeScript trong micro-frontend ([cart/src/events.d.ts](cart/src/events.d.ts))

- Mỗi app có `tsconfig.json` riêng và chạy `npm run typecheck -w <app>`. Rspack (swc) chỉ **bỏ kiểu** khi build, không kiểm tra kiểu, nên phải chạy `tsc` riêng (thường trong CI).
- **Contract bằng type**: mỗi app tự khai báo phần event nó dùng bằng cách mở rộng `WindowEventMap`. Nhờ vậy `addEventListener('cart:add', e => e.detail.price)` có type đầy đủ, và gõ sai tên event sẽ báo lỗi. Các file `events.d.ts` cố ý **lặp lại** giữa app, không gom vào package chung, vì package chung sẽ buộc các team cùng phiên bản. Muốn chắc chắn khớp nhau, dùng contract test hoặc e2e.
- `loadRemote('cart/Cart')` trả về kiểu `unknown` vì host không biết remote export gì. Trong `RemoteComponent.tsx` ta ép kiểu thủ công. Cách chuẩn là bật `dts` của Module Federation: remote sinh `.d.ts` cho các module expose, host tải về để có type thật.
- `env.d.ts` khai báo `__APP_VERSION__` (do `DefinePlugin` chèn vào) và kiểu cho `*.module.css`.

---

## Phần 3: Bài lab, tự làm để có kinh nghiệm thật

### Chuẩn bị chung (làm một lần)

1. `npm install` ở thư mục gốc.
2. Mở **3 terminal**, mỗi terminal chạy một app. Chạy riêng để sau này restart được từng app mà không đụng app khác:

   | Terminal | Lệnh | Port |
   |---|---|---|
   | 1 | `npm run dev -w host` | 3000 |
   | 2 | `npm run dev -w products` | 3001 |
   | 3 | `npm run dev -w cart` | 3002 |

   (`npm run dev` ở gốc chạy cả 4 app trong một terminal, tiện nhưng không restart riêng được. Remote `legacy` ở port 3003 chỉ cần cho lab nâng cao, xem `TODO.md` và mã trong thư mục `legacy/`.)
3. Mở http://localhost:3000, bấm F12 và mở hai tab: **Console** và **Network** (tick **Disable cache** trong Network).
4. Remote đã tắt HMR (`hot: false` trong `devServer`). Vì vậy sau khi sửa code của remote, hãy **đợi terminal báo `compiled successfully`**, rồi nhấn **Cmd+R** (Ctrl+R trên Windows) ở trang host để thấy thay đổi.
5. Mỗi lab có mục **Hoàn tác**. Làm xong thì chạy `git status` để chắc là không còn thay đổi thừa.

> Nếu bạn đang có chỉnh sửa chưa commit mà muốn giữ, lưu lại trước (`git stash` hoặc commit) vì các lệnh hoàn tác có thể xoá chúng.

---

### Lab 1: Deploy độc lập

**Mục tiêu:** thấy rằng sửa và "deploy" một remote không làm host hay remote khác build lại.

**Các bước**
1. Quan sát trang host: tiêu đề products đang là `... v1.0.0`. Ghi lại.
2. Trong `products/package.json`, đổi `"version"` thành `1.1.0`.
3. Trong `products/src/ProductList.tsx`, đổi chữ trong thẻ `<h2>` (ví dụ `Products` thành `Catalog`).
4. Ở terminal 2 (products): nhấn Ctrl+C rồi chạy lại `npm run dev -w products`. Cần restart vì số version được đọc lúc khởi động.
5. Đợi dòng `compiled successfully`, rồi nhấn Cmd+R ở trang host.

**Kết quả mong đợi**
- Tiêu đề thành `Catalog v1.1.0`.
- Terminal 1 (host) và terminal 3 (cart) **không in thêm dòng compile nào** từ bước 2 trở đi.
- Tab Network: file `__federation_expose_ProductList.js` đến từ `localhost:3001`; `main.js` đến từ `localhost:3000`.

**Tự kiểm chứng host không đổi (tuỳ chọn)**
```bash
curl -s localhost:3000/main.js | shasum
```
Chạy trước bước 2 và sau bước 5. Hai chuỗi hash phải giống nhau.

**Hoàn tác:** `git checkout products/package.json products/src/ProductList.tsx`

---

### Lab 2: Remote chết

**Mục tiêu:** thấy một remote không tải được thì chỉ ô của nó báo lỗi, phần còn lại vẫn chạy.

**Các bước**
1. Ở terminal 3 (cart): nhấn Ctrl+C để tắt cart.
2. Nhấn Cmd+R ở trang host.
3. Bấm "Thêm vào giỏ" ở một sản phẩm của products.

**Kết quả mong đợi**
- Ô cart hiện khung đỏ: `cart/Cart đang lỗi — phần còn lại vẫn chạy`.
- Products vẫn hiện và bấm được.
- Tab Network: request tới `localhost:3002/mf-manifest.json` báo đỏ (connection refused).

**Thử thêm: nút "Thử lại"**
1. Bật lại cart: `npm run dev -w cart`.
2. Bấm **Thử lại** trong khung đỏ (không reload trang). Ô cart phải hiện lại và Network có request mới tới `:3002`.

**Biến thể:** thay vì tắt cart, sửa port của cart trong `host/public/remotes.json` thành `3999` rồi reload. Kết quả giống nhau.

**Hoàn tác:** bật lại cart; nếu sửa `remotes.json` thì `git checkout host/public/remotes.json`.

---

### Lab 3: Remote crash lúc render

**Mục tiêu:** phân biệt lỗi "không tải được code" (lab 2) với lỗi "tải được nhưng chạy sai".

**Các bước**
1. Trong `cart/src/Cart.tsx`, thêm dòng này làm dòng đầu tiên trong thân hàm `Cart`:
   ```ts
   throw new Error('boom');
   ```
2. Đợi cart `compiled successfully`, rồi nhấn Cmd+R ở trang host.

**Kết quả mong đợi**
- Ô cart hiện khung đỏ với nội dung `boom`. Products vẫn chạy.
- Tab Network: các file của cart tải về **bình thường** (status 200), khác lab 2.
- Console: có stack trace trỏ vào `Cart.tsx`.
- Bấm **Thử lại**: lỗi hiện lại vì bug vẫn còn.

**So sánh với lab 2**

| | Lab 2 | Lab 3 |
|---|---|---|
| Network | request tới cart báo đỏ | request tới cart thành công |
| Nguyên nhân | không lấy được code | code chạy ném lỗi |

**Hoàn tác:** xoá dòng `throw`, hoặc `git checkout cart/src/Cart.tsx`, rồi Cmd+R ở host.

---

### Lab 4: Lệch version thư viện dùng chung

**Mục tiêu:** hiểu `requiredVersion` (cảnh báo) và `strictVersion` (báo lỗi).

**Các bước**
1. Trong `cart/rspack.config.mjs`, đổi dòng `react` thành:
   ```js
   react: { singleton: true, requiredVersion: '^18.0.0' },
   ```
2. Restart cart (Ctrl+C rồi `npm run dev -w cart`), rồi Cmd+R ở host. Xem Console.
3. Thêm `strictVersion: true`:
   ```js
   react: { singleton: true, requiredVersion: '^18.0.0', strictVersion: true },
   ```
4. Restart cart, Cmd+R ở host.

**Kết quả mong đợi**
- Sau bước 2, Console có **cảnh báo** dạng `Version 19.3.1 from host of shared singleton module react does not satisfy the requirement of cart which needs ^18.0.0`. Cart vẫn chạy bình thường.
- Sau bước 4, cùng điều kiện lệch nhưng thành **lỗi**: ô cart hiện khung đỏ, các phần khác vẫn chạy.

**Câu hỏi để suy nghĩ:** trường hợp nào bạn muốn cảnh báo, trường hợp nào muốn lỗi?

**Hoàn tác:** `git checkout cart/rspack.config.mjs`, rồi restart cart.

---

### Lab 5: Bỏ `singleton`

**Mục tiêu:** hiểu `singleton` thực sự làm gì, và khi nào nhiều bản React xuất hiện.

**Cách xem trạng thái React đang dùng chung:** dán đoạn này vào Console của trang host:
```js
Object.entries(__FEDERATION__.__SHARE__['host:1.0.0'].default.react)
  .map(([v, e]) => ({ v, from: e.from, singleton: e.shareConfig.singleton, useIn: e.useIn }))
```

**Phần A: chỉ bỏ `singleton`**
1. Ghi lại kết quả đoạn trên khi chưa sửa gì. Phải thấy một mục `19.3.1` với `useIn` gồm `host`, `products`, `cart`.
2. Trong `cart/rspack.config.mjs`, bỏ `singleton: true` ở cả `react` và `react-dom` (giữ `requiredVersion`).
3. Restart cart, Cmd+R ở host, chạy lại đoạn Console.

**Kết quả mong đợi (A):** **không có gì thay đổi**. Cart vẫn dùng React 19.3.1 của host, trang vẫn chạy bình thường. Lý do: bản của host thỏa `requiredVersion` nên runtime dùng chung, dù không có `singleton`.

**Phần B (nâng cao): làm cho hai bản React xuất hiện.** Cần cả hai điều kiện: bỏ `singleton` và để version lệch (ví dụ cài `react@18` cho cart rồi đặt `requiredVersion: '^18.0.0'`). Phần này làm thay đổi `package-lock.json`, nên chỉ làm trên một nhánh thử.

**Hoàn tác:** `git checkout cart` (và `git checkout package-lock.json` nếu có cài thêm gì).

**Ý chính:** `singleton` là lưới an toàn cho lúc **lệch** version, không phải thứ tạo ra việc chia sẻ khi mọi thứ đã khớp. Nhiều bản React nguy hiểm vì component của bản này, khi được bản kia render, có thể báo lỗi `Invalid hook call` hoặc mất context.

---

### Lab 6: Bỏ bootstrap

**Mục tiêu:** thấy lỗi khi code import thư viện shared ngay ở lượt chạy đầu tiên, và hiểu vì sao cần `bootstrap`.

**Các bước (làm trên cart)**
1. Đổi tên `cart/src/index.ts` thành `index.tsx` (vì sắp có JSX):
   ```bash
   git mv cart/src/index.ts cart/src/index.tsx
   ```
2. Trong `cart/rspack.config.mjs`, đổi `entry: './src/index.ts'` thành `entry: './src/index.tsx'`.
3. Xoá nội dung `index.tsx` (dòng `import('./bootstrap')`) và dán toàn bộ nội dung của `cart/src/bootstrap.tsx` vào.
4. Restart cart và mở http://localhost:3002 (mở cart độc lập, không qua host).

**Kết quả mong đợi**
- Trang trống. Console có lỗi **RUNTIME-006**: `loadShareSync failed! ... check whether an async boundary is implemented` và `Invalid loadShareSync function call ... "sharedPkgName":"react"`. Ba dòng này là cùng một lỗi.

**Vì sao:** React là thư viện shared nên Module Federation phải khởi tạo kho chung (bất đồng bộ) trước. `import('./bootstrap')` tạo ra khoảng chờ đó. Nếu file đầu tiên import React đồng bộ thì kho chung chưa sẵn sàng.

**Hoàn tác:** `git restore --staged --worktree cart`

---

### Lab 7: Mô phỏng CDN có version (production)

**Mục tiêu:** làm lại quy trình release và rollback như ở production, chỉ bằng cách đổi con trỏ trong `remotes.json`.

Mỗi bản build của remote nằm trong một thư mục có version và không bao giờ bị ghi đè. `publicPath: 'auto'` giúp chunk luôn được tải từ đúng thư mục chứa `remoteEntry.js`.

**Các bước**
1. **Tạo bản 1.0.0 và "upload".**
   ```bash
   npm run build -w products
   mkdir -p cdn/products/1.0.0 && cp -R products/dist/. cdn/products/1.0.0/
   ```
2. **Tạo bản 1.1.0.** Đổi `"version"` trong `products/package.json` thành `1.1.0` và sửa chữ trong `ProductList.tsx`, rồi:
   ```bash
   npm run build -w products
   mkdir -p cdn/products/1.1.0 && cp -R products/dist/. cdn/products/1.1.0/
   ```
   Phải đổi `version` **trước khi** build, vì số version được chèn vào code lúc build.
3. **Chạy "CDN".** Mở một terminal mới:
   ```bash
   npx serve --cors cdn -p 4000
   ```
   `--cors` cần thiết vì host (`:3000`) tải file từ `:4000`.
4. **Chạy host và cart** (terminal 1 và 3 như phần chuẩn bị). Products không cần chạy dev server nữa; tắt terminal 2.
5. **Release.** Sửa dòng products trong `host/public/remotes.json`:
   ```json
   "products": "http://localhost:4000/products/1.0.0/mf-manifest.json"
   ```
   Cmd+R ở host: hiện `v1.0.0`. Đổi thành `.../1.1.0/mf-manifest.json`, Cmd+R: hiện `v1.1.0`.
6. **Rollback.** Đổi lại `1.0.0`, Cmd+R: hiện `v1.0.0`. Không build lại gì cả.

**Kết quả mong đợi**
- Tab Network: file của products đến từ `localhost:4000/products/<version>/...`.
- Terminal host không in thêm dòng compile nào khi bạn đổi version.
- Build production không có HMR nên không dính lỗi `ChunkVersionError`.

**Dọn dẹp:** xoá thư mục `cdn/` (đừng commit), rồi `git checkout host/public/remotes.json products/package.json products/src/ProductList.tsx`.

> Ở công ty thật, bước "upload" và "đổi con trỏ" do pipeline làm tự động. Xem `TODO.md`.

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
- **`dts` (tự sinh type của remote)**: demo đã dùng TS nhưng tắt `dts: false` cho gọn, nên `loadRemote` phải ép kiểu thủ công. Bật `dts` khi remote và host ở repo khác nhau.
- **Runtime plugin fallback/retry** (`errorLoadRemote`, `@module-federation/retry-plugin`): thêm khi đã có CDN dự phòng.
- **Shared design system** (expose dưới dạng remote hoặc shared singleton): thêm khi có từ 2 app trở lên cần cùng một UI kit.

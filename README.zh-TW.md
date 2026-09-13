# 吾黨所鍾 Family Chat

![繁體中文示意圖](./demo-zh-TW.png)

> 給家人使用的私人共享空間：討論、回憶、相簿與行程集中管理。

[English README](./README.md)

## 專案簡介

Family Chat 是一個響應式 React 家庭社群網站。家庭成員可以發布富文字文章、留言討論、建立共享相簿、上傳附帶地點與文字說明的照片、規劃行程，以及管理個人資料。

## 功能分享

- **家庭討論區** — 富文字文章、格式化預覽、作者資訊、大頭貼、稱號／徽章、發文數量與原Po 標示。
- **留言與回覆** — 使用 Supabase 持久化儲存，保留作者身份與富文字內容。
- **共享相簿** — 新增、瀏覽、編輯與刪除相簿；上傳照片；燈箱預覽；儲存地點與相片文字描述；刪除照片。
- **家庭行程** — 建立與瀏覽包含開始、結束日期的行程。
- **個人檔案** — 修改顯示名稱、大頭貼，以及稱號／徽章的顏色與大小。
- **響應式介面** — 深色毛玻璃視覺、手機導覽、桌面側欄與可存取的按鈕／標籤。
- **安全上傳** — 圖片依登入家庭範圍存入 Supabase Storage，並執行檔案類型與大小檢查。

## 技術規格

| 層級 | 技術 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite |
| 樣式 | CSS、響應式版面、毛玻璃主題 |
| 富文字 | `react-quill-new`／Quill |
| 圖示 | `lucide-react` |
| 後端 | Supabase Auth、PostgreSQL、Row Level Security |
| 媒體 | Supabase Storage（`family-photos`）與簽名 URL |
| 部署 | Vercel SPA |
| 品質檢查 | TypeScript 型別檢查／建置與 Node 安全測試 |

## 本機開發

```bash
npm install
npm run dev
```

建立 `.env.local`，設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`，執行 [`supabase/schema.sql`](./supabase/schema.sql)，再依序執行 `supabase/migrations/`。

```bash
npm run typecheck
npm run build
npm test
```

## Demo 圖片

- [繁體中文示意圖](./demo-zh-TW.png)
- [English demo](./demo-en.png)

## 部署

將 repository 連接到 Vercel，設定 `master` 為 production branch，填入 Vite 環境變數後即可部署。詳細內容請參考 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

## 授權

私人家庭專案。若要公開散布，請先補上正式授權條款。

# 吾黨所鍾 Family Chat

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

![繁體中文示意圖](./demo-zh-TW.png)

> 給家人使用的私人共享空間：討論、回憶、相簿與行程集中管理。

[English README](./README.md)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=fff)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=111)
![Vercel](https://img.shields.io/badge/Vercel-deployed-000?logo=vercel&logoColor=fff)

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

## 🧭 功能區域

| 區域 | 家庭成員可以做什麼 |
| --- | --- |
| 🏠 首頁 | 查看最新家庭動態與共享相簿 |
| 📈 討論 | 發布、編輯、刪除文章並查看詳情 |
| 💬 對話 | 發布富文字留言並標示原Po |
| 🖼️ 相簿 | 上傳、預覽、描述、標記地點、編輯與刪除照片 |
| 🗓️ 行程 | 記錄家庭行程與日期範圍 |
| 👤 個人檔案 | 管理名稱、大頭貼、稱號與徽章樣式 |

## 🧱 系統架構

```text
React + TypeScript + Vite
        │
        ├── Supabase Auth ─── 登入與家庭工作階段
        ├── PostgreSQL ─────── 文章、留言、相簿、照片、檔案
        └── Storage ────────── family-photos bucket + 簽名 URL
```

前端維持輕量設計：家庭成員資格與權限由 Supabase RLS 強制執行，Vercel 負責提供 SPA 與路由 fallback。

## 🔐 安全模型

- 所有家庭資料表都啟用 Row Level Security。
- 讀寫操作依登入會員的 `family_id` 限制範圍。
- Storage 路徑以家庭識別碼開頭，私人媒體使用簽名 URL。
- 瀏覽器只使用 Supabase anonymous key，不可暴露 service-role key。
- 上傳前檢查圖片 MIME 類型與檔案大小。

## 🗃️ 資料模型

- `profiles` — 顯示身份、大頭貼、稱號／徽章樣式與家庭關聯。
- `threads` — 討論標題、建立者、家庭範圍與時間。
- `posts` — 文章與留言／回覆；`parent_post_id` 支援巢狀回覆。
- `albums` — 共享相簿名稱與描述。
- `photos` — Storage 路徑、文字描述、地點、上傳者與相簿關聯。

## 🧪 常用指令

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動本機 Vite 開發伺服器 |
| `npm run typecheck` | 檢查 TypeScript 型別 |
| `npm run build` | 建立正式版本 bundle |
| `npm test` | 執行安全性與 repository 測試 |

## 🛠️ 疑難排解

- **內容空白：** 確認已登入，且 `profiles.family_id` 存在。
- **RLS 錯誤：** 依序執行 `supabase/schema.sql` 與所有 migration。
- **無法上傳：** 確認 `family-photos` bucket 與 Storage policies 已建立。
- **Vercel 仍是舊畫面：** 確認連接的 repository 與 production branch 和 Git remote 一致，再重新部署。

## 🗺️ Roadmap

- 完整巢狀回覆控制與通知徽章
- 相簿拖曳排序與更多照片 metadata
- 自動 Preview Deployment 與瀏覽器端 E2E 測試

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

本專案以 [MIT License](./LICENSE) 開源。你可以依授權條款自由使用、修改與重新散布本專案。

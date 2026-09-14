# Family Chat（家庭交流空間）

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

一個提供家庭成員使用的私有、響應式交流網站，整合討論文章、留言回覆、相簿、旅程與個人資料。

English documentation: [README.md](./README.md)

## 功能

- 家庭帳號登入與註冊，透過 Supabase RLS 限制家庭資料存取範圍。
- 發文編輯器：文章標題、富文字內文、圖片、分類與 Hashtag。
- 討論區文章列表：作者、回覆數、文章搜尋、置頂、`HOT`、`NEW` 與「推薦」標籤。
- 文章詳情頁：作者可編輯或刪除文章，也可直接回覆文章。
- Threads 風格留言串：頭像、回覆對象、階層樓層、父子留言連接線、編輯／刪除與回覆通知。
- 可選擇開啟霓虹橫向彈幕，讓留言飄過文章內容。
- 共用相簿：最後一張照片縮圖作為封面、照片說明與地點、燈箱瀏覽、上一張／下一張控制。
- 家庭旅程：建立行程與起訖日期。
- 個人檔案：顯示名稱、頭像、稱號徽章與視覺設定。
- 支援桌面與 iPhone 尺寸 RWD、深色模式，以及 Flaticon UIcons 圖示。

## 系統架構

```text
React + TypeScript + Vite
        ├── Supabase Auth      使用者登入狀態
        ├── PostgreSQL         家庭、會員、文章、留言、相簿、照片
        └── Supabase Storage   私有 family-photos 儲存桶與簽名網址
```

前端是 Vite SPA，資料權限由 Supabase Row Level Security 強制執行；瀏覽器只使用 anonymous key。

## 資料模型

- `families`／`profiles`：家庭成員關係與顯示身份。
- `threads`：文章標題、作者、時間、置頂狀態與家庭範圍。
- `posts`：原始文章及留言／回覆，`parent_post_id` 表示回覆階層。
- `notifications`：回覆通知。
- `albums`／`photos`：相簿、說明、地點與儲存路徑。
- `itineraries`／`itinerary_items`：家庭旅程規劃。

## 開始使用

```bash
npm install
npm run dev
```

建立 `.env.local`，設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。先執行 [`supabase/schema.sql`](./supabase/schema.sql)，再依序執行 `supabase/migrations/` 內的 migration，並建立私有 `family-photos` Storage bucket。

## 檢查指令

```bash
npm run typecheck
npm run build
npm test
```

## 部署

將 repository 連接至 Vercel，production branch 設為 `master`，並設定兩個 Vite 環境變數。詳細內容請參考 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

## 專案截圖

- [English demo](./demo-en.png)
- [繁體中文 demo](./demo-zh-TW.png)

## 授權

MIT，請參考 [LICENSE](./LICENSE)。

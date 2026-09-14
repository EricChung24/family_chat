import { useEffect, useState } from "react";
import "./App.css";
import "./Thread.css";
import { supabase } from "./lib/supabaseClient";
import { isSupabaseConfigured } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";

type Tab = "home" | "discussions" | "trips" | "albums" | "weather";
type Thread = {
  id?: string;
  title: string;
  body: string;
  author: string;
  authorId?: string;
  avatarUrl?: string | null;
  time: string;
  replies: number;
  tone: string;
  pinned?: boolean;
  createdAt?: string;
};
type ProfileInfo = { displayName: string; avatarUrl?: string | null };
const decodeRichHtml = (value: string) => {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1)
    decoded = decoded
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
  return decoded;
};
const extractHashtags = (value: string) => {
  const plainText = value.replace(/<[^>]*>/g, " ");
  return Array.from(new Set(plainText.match(/#[\p{L}\p{N}_-]+/gu) ?? []));
};
const normalizeHashtags = (value: string) =>
  value
    .split(/[\s,，、]+/)
    .map((tag) => tag.replace(/^#+/, "").replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`);

function RichTextEditor({
  value,
  onChange,
  onImageUpload,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  placeholder: string;
}) {
  const quillRef = useRef<ReactQuill>(null);
  const imageHandler = async () => {
    if (!onImageUpload) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await onImageUpload(file);
      const quill = quillRef.current?.getEditor();
      if (url && quill) {
        const index = quill.getSelection()?.index ?? quill.getLength();
        quill.insertEmbed(index, "image", url, "user");
        quill.setSelection(index + 1, 0, "silent");
      }
    };
  };
  const modules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ font: [] }, { size: ["small", false, "large", "huge"] }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "link", "image", "clean"],
      ],
      handlers: { image: imageHandler },
    },
  };
  return (
    <div className="rich-editor">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
      />
    </div>
  );
}

function logSupabaseError(
  operation: string,
  error:
    | { message?: string; code?: string; details?: string; hint?: string }
    | null
    | undefined,
) {
  if (!error) return;
  console.error(`[吾黨所鍾][Supabase][${operation}]`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

const initialThreads: Thread[] = [];

function setThreadsFromDatabase(
  rows: Array<{
    id: string;
    title: string;
    created_at: string;
    pinned: boolean;
    created_by?: string;
    posts?: Array<{ content: string; user_id?: string; created_at?: string }>;
  }>,
  profiles = new Map<string, ProfileInfo>(),
) {
  return rows.map((row, index) => {
    const profile = profiles.get(row.created_by ?? "");
    return {
      id: row.id,
      title: row.title,
      body:
        row.posts?.find((post) => post.user_id === row.created_by)?.content ??
        row.posts?.[0]?.content ??
        "尚無內容",
      author: profile?.displayName ?? "會員",
      authorId: row.created_by,
      avatarUrl: profile?.avatarUrl,
      time: index === 0 ? "最新" : "較早",
      replies: Math.max((row.posts?.length ?? 0) - 1, 0),
      tone: index % 2 ? "forest" : "coral",
      pinned: row.pinned,
      createdAt: row.created_at,
    };
  });
}

function App() {
  const [tab, setTab] = useState<Tab | "profile">("home");
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [draft, setDraft] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftCategory, setDraftCategory] = useState("日常");
  const [draftTags, setDraftTags] = useState("");
  const [compose, setCompose] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [profilePanel, setProfilePanel] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(
    () =>
      window.location.pathname.match(/^\/forum\/posts\/([^/]+)/)?.[1] ?? null,
  );
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const onPopState = () => {
      const next =
        window.location.pathname.match(/^\/forum\/posts\/([^/]+)/)?.[1] ?? null;
      setDetailId(next);
      if (!next) setTab("discussions");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!supabase || !sessionUserId) {
      setUnreadNotifications(0);
      return;
    }
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", sessionUserId)
      .is("read_at", null)
      .then(({ count, error }) => {
        logSupabaseError("notifications.unread", error);
        if (!error) setUnreadNotifications(count ?? 0);
      });
  }, [sessionUserId]);
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    const client = supabase;
    const applyUser = async (current: User | null) => {
      setSessionEmail(current?.email ?? null);
      setSessionUserId(current?.id ?? null);
      if (!current?.id) {
        setSessionName("");
        setCurrentAvatarUrl(null);
        setAuthReady(true);
        return;
      }
      const fallbackName = String(current.email?.split("@")[0] ?? "會員");
      let profile = await client
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", current.id)
        .maybeSingle();
      logSupabaseError("profiles.select", profile.error);
      const legacyName =
        profile.data?.display_name?.trim().toLowerCase() === "maya chen";
      if (!profile.data || legacyName) {
        const bootstrap = await client.rpc("bootstrap_family", {
          p_display_name: fallbackName,
        });
        logSupabaseError("bootstrap_family", bootstrap.error);
        if (bootstrap.error) {
          setAuthReady(true);
          return;
        }
        profile = await client
          .from("profiles")
          .select("display_name")
          .eq("id", current.id)
          .maybeSingle();
        logSupabaseError("profiles.select.retry", profile.error);
      }
      setSessionName(profile.data?.display_name ?? fallbackName);
      setCurrentAvatarUrl(profile.data?.avatar_url ?? null);
      setAuthReady(true);
    };
    client.auth.getSession().then(({ data, error }) => {
      logSupabaseError("auth.getSession", error);
      applyUser(data.session?.user ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !sessionEmail) return;
    const client = supabase;
    client
      .from("threads")
      .select(
        "id,title,created_at,pinned,created_by,posts(content,created_at,user_id)",
      )
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error || !data) return;
        const ids = [
          ...new Set(data.map((row) => row.created_by).filter(Boolean)),
        ] as string[];
        const profiles = ids.length
          ? await client
              .from("profiles")
              .select("id,display_name,avatar_url")
              .in("id", ids)
          : { data: [] };
        const profileMap = new Map(
          (profiles.data ?? []).map((profile) => [
            profile.id,
            {
              displayName: profile.display_name || "會員",
              avatarUrl: profile.avatar_url,
            },
          ]),
        );
        setThreads(
          setThreadsFromDatabase(
            data as Array<{
              id: string;
              title: string;
              created_at: string;
              pinned: boolean;
              created_by?: string;
              posts?: Array<{
                content: string;
                user_id?: string;
                created_at?: string;
              }>;
            }>,
            profileMap,
          ),
        );
      });
  }, [sessionEmail]);
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };
  useEffect(() => {
    if (!authOpen) return;
    const submitOnEnter = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !authBusy) {
        event.preventDefault();
        void submitAuth();
      }
    };
    document.addEventListener("keydown", submitOnEnter);
    return () => document.removeEventListener("keydown", submitOnEnter);
  }, [authOpen, authBusy, email, password, displayName, authMode]);
  useEffect(() => {
    const navClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest(".nav-button");
      if (button && /討論|交流/.test(button.textContent ?? "")) {
        history.pushState({}, "", "/");
        setDetailId(null);
      }
    };
    document.addEventListener("click", navClick);
    return () => document.removeEventListener("click", navClick);
  }, []);
  useEffect(() => {
    const toggleRail = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        document.documentElement.classList.toggle("rail-collapsed");
      }
    };
    document.addEventListener("keydown", toggleRail);
    return () => document.removeEventListener("keydown", toggleRail);
  }, []);
  useEffect(() => {
    const rememberBadge = (event: Event) => {
      const target = event.target as HTMLInputElement;
      if (target.closest(".title-editor-row") && target.type === "text")
        window.localStorage.setItem("profile-title-badge", target.value);
    };
    document.addEventListener("input", rememberBadge);
    return () => document.removeEventListener("input", rememberBadge);
  }, []);
  const submitAuth = async () => {
    if (!supabase || !email.trim() || !password) return;
    setAuthBusy(true);
    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { display_name: displayName.trim() },
              emailRedirectTo: window.location.origin,
            },
          });
    if (result.error) {
      notify(result.error.message);
      setAuthBusy(false);
      return;
    }
    if (!result.data.user || !result.data.session) {
      if (authMode === "signup") {
        notify("註冊成功，請先到信箱完成驗證，再回來登入");
        setAuthMode("login");
      } else notify("登入未建立工作階段，請重新嘗試");
      setAuthBusy(false);
      return;
    }
    const memberName =
      authMode === "signup" ? displayName.trim() : email.trim().split("@")[0];
    if (authMode === "signup") {
      const bootstrap = await supabase.rpc("bootstrap_family", {
        p_display_name: memberName,
      });
      if (bootstrap.error) {
        notify(`會員資料同步失敗：${bootstrap.error.message}`);
        setAuthBusy(false);
        return;
      }
    }
    notify(authMode === "login" ? "登入成功" : "註冊成功");
    setSessionEmail(result.data.user.email ?? email.trim());
    setSessionUserId(result.data.user.id);
    setSessionName(memberName);
    setAuthOpen(false);
    setCompose(false);
    setProfilePanel(false);
    setTab("home");
    setAuthBusy(false);
  };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSessionEmail(null);
    setSessionUserId(null);
    setSessionName("");
    setUnreadNotifications(0);
    setThreads([]);
    setProfilePanel(false);
    setTab("home");
    notify("已登出");
  };
  const openNotifications = async () => {
    if (!supabase || !sessionUserId) return;
    const count = unreadNotifications;
    const result = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", sessionUserId)
      .is("read_at", null);
    logSupabaseError("notifications.markRead", result.error);
    if (!result.error) setUnreadNotifications(0);
    notify(count ? `你有 ${count} 則新的回覆通知` : "目前沒有新的回覆通知");
  };
  const openComposer = async () => {
    if (!supabase) {
      notify("尚未連接 Supabase，暫時無法建立內容");
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    logSupabaseError("auth.getSession.composer", error);
    if (!data.session?.user?.id) {
      setSessionEmail(null);
      setSessionName("");
      setAuthOpen(true);
      return;
    }
    setSessionEmail(data.session.user.email ?? null);
    setCompose(true);
  };
  const uploadEditorImage = async (file: File) => {
    if (!supabase || !sessionUserId) {
      notify("請先登入才能上傳圖片");
      return null;
    }
    if (!file.type.startsWith("image/") || file.size > 50 * 1024 * 1024) {
      notify("請選擇 50MB 以下的圖片");
      return null;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", sessionUserId)
      .maybeSingle();
    if (!profile?.family_id) {
      notify("會員資料尚未同步");
      return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "") || "image.jpg";
    const path = `${profile.family_id}/posts/${sessionUserId}/inline-${Date.now()}-${safeName}`;
    const result = await supabase.storage
      .from("family-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (result.error) {
      notify(`圖片上傳失敗：${result.error.message}`);
      return null;
    }
    const signed = await supabase.storage
      .from("family-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.error) {
      notify(`圖片連結建立失敗：${signed.error.message}`);
      return null;
    }
    return signed.data.signedUrl;
  };
  const saveProfile = async (name: string) => {
    if (!supabase) {
      notify("預覽模式：尚未連接資料庫");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const nextName = name.trim();
    if (!nextName) {
      notify("請輸入顯示名稱");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: nextName })
      .eq("id", user.id);
    if (!error) setSessionName(nextName);
    notify(error ? error.message : "個人資料已儲存");
  };
  const addThread = async () => {
    if (!supabase || !sessionEmail) {
      notify("請先登入會員並連接 Supabase");
      return;
    }
    if (!draft.trim() || !draftBody.replace(/<[^>]*>/g, "").trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      notify("登入狀態已失效");
      return;
    }
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    logSupabaseError("profiles.for-post", profileError);
    if (!profile?.family_id) {
      const fallbackName = user.email?.split("@")[0] ?? "會員";
      const bootstrap = await supabase.rpc("bootstrap_family", {
        p_display_name: fallbackName,
      });
      logSupabaseError("bootstrap_family.for-post", bootstrap.error);
      if (bootstrap.error) {
        notify(`會員資料同步失敗：${bootstrap.error.message}`);
        return;
      }
      ({ data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle());
      logSupabaseError("profiles.for-post.retry", profileError);
    }
    if (!profile?.family_id) {
      notify("會員資料尚未同步，請確認資料庫已執行最新 schema.sql");
      return;
    }
    const { data: thread, error } = await supabase
      .from("threads")
      .insert({
        family_id: profile.family_id,
        title: draft.trim(),
        created_by: user.id,
      })
      .select("id")
      .single();
    logSupabaseError("threads.insert", error);
    if (error || !thread) {
      notify(error?.message ?? "討論建立失敗");
      return;
    }
    const categoryTag = normalizeHashtags(draftCategory)[0] ?? "#日常";
    const customTags = normalizeHashtags(draftTags).filter(
      (tag) => tag !== categoryTag,
    );
    const metadataTags = [categoryTag, ...customTags].join(" ");
    const post = await supabase.from("posts").insert({
      thread_id: thread.id,
      user_id: user.id,
      content: `${draftBody.trim()}<p class="post-tags">${metadataTags}</p>`,
    });
    logSupabaseError("posts.insert", post.error);
    if (post.error) {
      notify(post.error.message);
      return;
    }
    setDraft("");
    setDraftBody("");
    setDraftCategory("日常");
    setDraftTags("");
    setCompose(false);
    notify("討論已分享給家人");
    const refreshed = await supabase
      .from("threads")
      .select(
        "id,title,created_at,pinned,created_by,posts(content,created_at,user_id)",
      )
      .order("created_at", { ascending: false });
    logSupabaseError("threads.refresh", refreshed.error);
    if (refreshed.data) {
      const ids = [
        ...new Set(refreshed.data.map((row) => row.created_by).filter(Boolean)),
      ] as string[];
      const profiles = ids.length
        ? await supabase
            .from("profiles")
            .select("id,display_name,avatar_url")
            .in("id", ids)
        : { data: [] };
      const profileMap = new Map(
        (profiles.data ?? []).map((item) => [
          item.id,
          {
            displayName: item.display_name || "會員",
            avatarUrl: item.avatar_url,
          },
        ]),
      );
      setThreads(
        setThreadsFromDatabase(
          refreshed.data as Array<{
            id: string;
            title: string;
            created_at: string;
            pinned: boolean;
            created_by?: string;
            posts?: Array<{
              content: string;
              user_id?: string;
              created_at?: string;
            }>;
          }>,
          profileMap,
        ),
      );
    }
  };
  const titles: Record<string, string> = {
    home: "我們的小天地",
    discussions: "家庭討論",
    trips: "下一段旅程",
    albums: "共享相簿",
    weather: "台灣天氣",
    profile: "你的個人檔案",
  };
  const glyphs: Record<string, React.ReactNode> = {
    home: <Icon name="home" />,
    discussions: <Icon name="comments" />,
    trips: <Icon name="calendar-days" />,
    albums: <Icon name="images" />,
    weather: <Icon name="cloud-sun" />,
    profile: <Icon name="user" />,
  };
  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="brand-mark">吾</div>
        <button
          className="family-switcher brand-home-button"
          type="button"
          onClick={() => setTab("home")}
          aria-label="回到首頁"
        >
          <div className="avatar avatar-small">吾</div>
          <div>
            <b>吾黨所鍾</b>
            <small>我們的家庭空間</small>
          </div>
          <Icon name="angle-small-down" />
        </button>
        <nav>
          {(["home", "discussions", "trips", "albums", "weather"] as Tab[]).map(
            (item) => (
              <Nav
                key={item}
                active={tab === item}
                label={
                  {
                    home: "首頁",
                    discussions: "討論",
                    trips: "行程",
                    albums: "相簿",
                    weather: "天氣",
                  }[item]
                }
                glyph={glyphs[item]}
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                  setTab(item);
                }}
              />
            ),
          )}
        </nav>
        <div className="rail-bottom">
          <button className="nav-button" onClick={() => setProfilePanel(true)}>
            <span className="nav-glyph">
              <Icon name="settings" />
            </span>
            設定
          </button>
          {sessionEmail && (
            <button className="profile-chip" onClick={() => setTab("profile")}>
              <Avatar
                src={currentAvatarUrl}
                fallback={(sessionName || "你")[0]}
              />
              <span>{sessionName || "會員"}</span>
              <Icon name="menu-dots" />
            </button>
          )}
          <a
            className="uicons-credit"
            href="https://www.flaticon.com/uicons"
            target="_blank"
            rel="noreferrer"
          >
            UIcons by Flaticon
          </a>
        </div>
      </aside>
      <main className="main-canvas">
        <header className="topbar">
          <button
            className="mobile-brand brand-home-button"
            type="button"
            onClick={() => setTab("home")}
            aria-label="回到首頁"
          >
            <div className="brand-mark">吾</div>
            <b>吾黨所鍾</b>
          </button>
          <div className="breadcrumb">
            <span>吾黨所鍾</span>
            <span>/</span>
            <b>{titles[tab]}</b>
          </div>
          <div className="top-actions">
            {searchOpen && (
              <input
                className="top-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜尋文章…"
                aria-label="搜尋文章"
                autoFocus
              />
            )}
            <button
              className={`icon-button ${searchOpen ? "active" : ""}`}
              onClick={() => setSearchOpen((current) => !current)}
              aria-label="搜尋文章"
              aria-expanded={searchOpen}
            >
              <Icon name="search" />
            </button>
            <button
              className="icon-button"
              onClick={openNotifications}
              aria-label="通知"
            >
              <Icon name="bell" />
              {unreadNotifications > 0 && (
                <i className="notification-badge">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </i>
              )}
            </button>
            {!authReady ? (
              <span className="muted">載入中…</span>
            ) : sessionEmail ? (
              <>
                <button
                  className="button ghost account-button profile-account-button"
                  onClick={() => setProfilePanel(true)}
                >
                  {sessionName || "會員資料"}
                </button>
                <button
                  className="button ghost account-button logout-account-button"
                  onClick={signOut}
                >
                  <Icon name="sign-out-alt" />
                  登出
                </button>
              </>
            ) : (
              <button
                className="button primary account-button login-account-button"
                onClick={() => setAuthOpen(true)}
              >
                <Icon name="sign-in-alt" />
                <span className="desktop-account-copy">登入／註冊</span>
                <span className="mobile-account-copy">登入</span>
              </button>
            )}
            <button className="mobile-avatar" onClick={() => setTab("profile")}>
              <Avatar src={currentAvatarUrl} fallback="訪" />
            </button>
          </div>
        </header>
        <div className="content-wrap">
          {searchQuery.trim() ? (
            <SearchResults
              threads={threads}
              query={searchQuery}
              onOpen={(id) => {
                history.pushState({}, "", `/forum/posts/${id}`);
                setSearchQuery("");
                setSearchOpen(false);
                setDetailId(id);
                setTab("discussions");
              }}
            />
          ) : (
            tab === "home" && (
              <Home
                threads={threads}
                setTab={setTab}
                compose={openComposer}
                sessionName={sessionName}
              />
            )
          )}
          {!searchQuery.trim() &&
            tab === "discussions" &&
            (detailId ? (
              <ArticleDetailPage
                id={detailId}
                userId={sessionUserId}
                sessionEmail={sessionEmail}
                avatarUrl={currentAvatarUrl}
                notify={notify}
                onBack={() => {
                  history.pushState({}, "", "/");
                  setDetailId(null);
                  setTab("discussions");
                }}
                onDeleted={() =>
                  setThreads((current) =>
                    current.filter((thread) => thread.id !== detailId),
                  )
                }
              />
            ) : (
              <Discussions
                threads={threads}
                compose={openComposer}
                notify={notify}
                sessionUserId={sessionUserId}
                onOpen={(id) => {
                  history.pushState({}, "", `/forum/posts/${id}`);
                  setDetailId(id);
                }}
              />
            ))}
          {!searchQuery.trim() && tab === "trips" && (
            <Trips notify={notify} sessionEmail={sessionEmail} />
          )}
          {!searchQuery.trim() && tab === "albums" && (
            <Albums notify={notify} sessionEmail={sessionEmail} />
          )}
          {!searchQuery.trim() && tab === "weather" && <TaiwanWeather />}
          {!searchQuery.trim() && tab === "profile" && (
            <>
              <ProfileWithAvatar
                notify={notify}
                saveProfile={saveProfile}
                sessionName={sessionName}
                sessionEmail={sessionEmail}
                userId={sessionUserId}
                onAvatarChange={setCurrentAvatarUrl}
              />
              <TitleEditor notify={notify} userId={sessionUserId} />
            </>
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {(["home", "discussions", "trips", "albums", "weather"] as Tab[]).map(
          (item) => (
            <Nav
              key={item}
              active={tab === item}
              label={
                {
                  home: "首頁",
                  discussions: "交流",
                  trips: "行程",
                  albums: "相簿",
                  weather: "天氣",
                }[item]
              }
              glyph={glyphs[item]}
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
                setTab(item);
              }}
            />
          ),
        )}
      </nav>
      {compose && (
        <div className="modal-backdrop" onMouseDown={() => setCompose(false)}>
          <section
            className="composer-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">新增討論</p>
            <h2>最近有什麼想分享？</h2>
            <label className="composer-field-label" htmlFor="new-thread-title">
              標題
            </label>
            <input
              id="new-thread-title"
              className="auth-input composer-title-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="輸入討論標題…"
              maxLength={120}
            />
            <label
              className="composer-field-label"
              htmlFor="new-thread-category"
            >
              分類
            </label>
            <select
              id="new-thread-category"
              className="auth-input composer-category-input"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
            >
              <option value="日常">日常</option>
              <option value="家庭活動">家庭活動</option>
              <option value="旅遊">旅遊</option>
              <option value="美食">美食</option>
              <option value="重要通知">重要通知</option>
              <option value="自訂">自訂（請在標籤輸入）</option>
            </select>
            <label className="composer-field-label" htmlFor="new-thread-tags">
              標籤
            </label>
            <input
              id="new-thread-tags"
              className="auth-input composer-tags-input"
              value={draftTags}
              onChange={(event) => setDraftTags(event.target.value)}
              placeholder="#週末 #聚餐（可用空格或逗號分隔）"
            />
            <label className="composer-field-label" htmlFor="new-thread-body">
              內文
            </label>
            <p className="tag-hint">可加入 #標籤，作為文章分類</p>
            <RichTextEditor
              value={draftBody}
              onChange={setDraftBody}
              onImageUpload={uploadEditorImage}
              placeholder="分享一則留言、一個問題，或一件小小的好事……"
            />
            <div className="modal-actions">
              <button
                className="button ghost"
                onClick={() => setCompose(false)}
              >
                取消
              </button>
              <button
                className="button primary"
                disabled={
                  !draft.trim() || !draftBody.replace(/<[^>]*>/g, "").trim()
                }
                onClick={addThread}
              >
                分享給家人
              </button>
            </div>
          </section>
        </div>
      )}
      {profilePanel && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setProfilePanel(false)}
        >
          <section
            className="quick-panel"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setProfilePanel(false)}
              aria-label="關閉"
            >
              <Icon name="cross" />
            </button>
            <Avatar
              src={currentAvatarUrl}
              fallback={sessionName ? sessionName[0] : "訪"}
              size="large"
            />
            <p className="eyebrow">你的空間</p>
            <h2>
              {sessionEmail
                ? "已登入"
                : isSupabaseConfigured
                  ? "尚未登入"
                  : "預覽模式"}
            </h2>
            <p className="muted">
              {sessionEmail ??
                (isSupabaseConfigured
                  ? "Supabase 已連接，登入後即可使用會員功能"
                  : "尚未連接 Supabase")}
            </p>
            {sessionEmail ? (
              <button className="button ghost full" onClick={signOut}>
                登出
              </button>
            ) : (
              <button
                className="button primary full"
                onClick={() => {
                  setProfilePanel(false);
                  setAuthOpen(true);
                }}
              >
                登入／註冊
              </button>
            )}
            <button
              className="button ghost full"
              onClick={() => {
                setProfilePanel(false);
                setTab("profile");
              }}
            >
              開啟個人檔案
            </button>
          </section>
        </div>
      )}
      {authOpen && (
        <div className="modal-backdrop" onMouseDown={() => setAuthOpen(false)}>
          <section
            className="composer-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setAuthOpen(false)}
              aria-label="關閉"
            >
              <Icon name="cross" />
            </button>
            <p className="eyebrow">吾黨所鍾會員</p>
            <h2>{authMode === "login" ? "登入家庭空間" : "建立會員帳號"}</h2>
            {authMode === "signup" && (
              <input
                className="auth-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="顯示名稱"
              />
            )}
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="電子信箱"
            />
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼"
            />
            <button
              className="button primary full"
              disabled={
                authBusy ||
                !email ||
                !password ||
                (authMode === "signup" && !displayName)
              }
              onClick={submitAuth}
            >
              {authBusy ? "處理中……" : authMode === "login" ? "登入" : "註冊"}
            </button>
            <button
              className="text-button full"
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
            >
              {authMode === "login" ? "還沒有帳號？註冊" : "已有帳號？登入"}
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <span>✓</span>
        </div>
      )}
    </div>
  );
}

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <i className={`fi fi-rr-${name} ui-icon ${className}`} aria-hidden="true" />
  );
}
function Nav({
  active,
  label,
  glyph,
  onClick,
  badge,
}: {
  active: boolean;
  label?: string;
  glyph: React.ReactNode;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      className={`nav-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="nav-glyph">{glyph}</span>
      <span>{label ?? ""}</span>
      {badge && <em>{badge}</em>}
    </button>
  );
}
function Hero({
  kicker,
  title,
  copy,
  action,
}: {
  kicker: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="hero-row">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>
          {title}
          <span>.</span>
        </h1>
        <p className="hero-copy">{copy}</p>
      </div>
      {action}
    </section>
  );
}
function Home({
  threads,
  setTab,
  compose,
  sessionName,
}: {
  threads: Thread[];
  setTab: (t: Tab) => void;
  compose: () => void;
  sessionName: string;
}) {
  const [albums, setAlbums] = useState<
    Array<{ id: string; title: string; created_at: string }>
  >([]);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("albums")
      .select("id,title,created_at")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setAlbums(data ?? []));
  }, []);
  return (
    <>
      <Hero
        kicker="家庭空間"
        title={sessionName ? `你好啊！${sessionName}` : "歡迎來到吾黨所鍾"}
        copy="登入後，這裡會顯示家人的真實動態。"
        action={
          <button className="button primary" onClick={compose}>
            <Icon name="plus" />
            發起討論
          </button>
        }
      />
      <section className="feature-grid">
        <article className="feature-card trip-card">
          <p className="eyebrow light">行程</p>
          <h2>還沒有行程</h2>
          <p>建立第一個家庭行程，開始一起規劃。</p>
          <button
            className="text-button light-text"
            onClick={() => setTab("trips")}
          >
            前往行程 <Icon name="arrow-small-right" />
          </button>
        </article>
        <article className="feature-card note-card">
          <p className="eyebrow">家庭留言</p>
          <blockquote>這裡會放家人分享的訊息。</blockquote>
        </article>
      </section>
      <section className="section-heading">
        <div>
          <p className="eyebrow">最新消息</p>
          <h2>家人動態</h2>
        </div>
        <button className="text-button" onClick={() => setTab("discussions")}>
          查看討論 <Icon name="arrow-small-right" />
        </button>
      </section>
      <div className="empty-state">
        {threads.length ? (
          threads
            .slice(0, 3)
            .map((thread) => (
              <ThreadCard
                key={thread.title}
                thread={thread}
                listOnly
                onClick={() => setTab("discussions")}
              />
            ))
        ) : (
          <p>目前還沒有討論，成為第一個分享的人吧。</p>
        )}
      </div>
      <section className="section-heading">
        <div>
          <p className="eyebrow">回憶</p>
          <h2>共享相簿</h2>
        </div>
        <button className="text-button" onClick={() => setTab("albums")}>
          查看相簿 <Icon name="arrow-small-right" />
        </button>
      </section>
      <div className="home-album-strip">
        {albums.length ? (
          albums.map((album) => (
            <button
              className="home-album-card"
              key={album.id}
              onClick={() => setTab("albums")}
            >
              <b>{album.title}</b>
              <small>
                {new Date(album.created_at).toLocaleDateString("zh-TW")}
              </small>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <p>目前還沒有相簿。</p>
          </div>
        )}
      </div>
    </>
  );
}
function SearchResults({
  threads,
  query,
  onOpen,
}: {
  threads: Thread[];
  query: string;
  onOpen: (id: string) => void;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const results = threads.filter((thread) =>
    `${thread.title} ${thread.body} ${thread.author}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
  return (
    <>
      <Hero
        kicker="文章搜尋"
        title={`搜尋結果`}
        copy={`關鍵字：「${query.trim()}」｜找到 ${results.length} 篇文章`}
      />
      <div className="thread-list expanded search-results-list">
        {results.map((thread) => (
          <ThreadCard
            key={thread.id ?? thread.title}
            thread={thread}
            listOnly
            onClick={() => thread.id && onOpen(thread.id)}
          />
        ))}
        {results.length === 0 && (
          <div className="empty-state">
            <p>找不到符合的文章。</p>
          </div>
        )}
      </div>
    </>
  );
}
function Discussions({
  threads,
  compose,
  notify,
  sessionUserId,
  onOpen,
}: {
  threads: Thread[];
  compose: () => void;
  notify: (m: string) => void;
  sessionUserId: string | null;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pinned" | "mine">("all");
  const visibleThreads = threads.filter((thread) => {
    if (filter === "pinned") return Boolean(thread.pinned);
    if (filter === "mine") return thread.authorId === sessionUserId;
    return true;
  });
  return (
    <>
      <Hero
        kicker="家庭留言板"
        title="一起聊聊"
        copy="問題、想法，以及值得記住的每件小事。"
        action={
          <button className="button primary" onClick={compose}>
            <Icon name="plus" />
            發起討論
          </button>
        }
      />
      <div className="filter-row">
        <button
          className={`filter ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          全部貼文
        </button>
        <button
          className={`filter ${filter === "pinned" ? "active" : ""}`}
          onClick={() => setFilter("pinned")}
        >
          置頂
        </button>
        <button
          className={`filter ${filter === "mine" ? "active" : ""}`}
          onClick={() => setFilter("mine")}
        >
          我的貼文
        </button>
        <span />
        <button
          className="icon-button"
          onClick={() => notify("篩選功能已準備好")}
          aria-label="篩選"
        >
          <Icon name="filter" />
        </button>
      </div>
      <div className="thread-list expanded">
        {visibleThreads.map((thread) => (
          <ThreadCard
            key={thread.id ?? thread.title}
            thread={thread}
            listOnly
            onClick={() => thread.id && onOpen(thread.id)}
          />
        ))}
        {visibleThreads.length === 0 && (
          <div className="empty-state">
            <p>目前沒有符合的文章。</p>
          </div>
        )}
      </div>
    </>
  );
}
// Legacy detail implementation retained in history; ArticleDetailPage is the active implementation.
function ArticleDetailPage({
  id,
  userId,
  sessionEmail,
  avatarUrl,
  notify,
  onBack,
  onDeleted,
}: {
  id: string;
  userId: string | null;
  sessionEmail: string | null;
  avatarUrl: string | null;
  notify: (m: string) => void;
  onBack: () => void;
  onDeleted: () => void;
}) {
  type Reply = {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    parent_post_id?: string | null;
    author: string;
    isOp?: boolean;
    avatarUrl?: string | null;
  };
  const [post, setPost] = useState<{
    id: string;
    title: string;
    content: string;
    authorId: string;
    createdAt: string;
    authorName: string;
    authorAvatarUrl?: string | null;
    pinned: boolean;
  } | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [reply, setReply] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState("");
  const [showDanmaku, setShowDanmaku] = useState(false);
  const [liveUserId, setLiveUserId] = useState<string | null>(userId);
  const [authorBadge, setAuthorBadge] = useState("");
  const [authorPostCount, setAuthorPostCount] = useState(0);
  const load = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const result = await supabase
      .from("threads")
      .select(
        "id,title,created_at,created_by,pinned,posts(id,content,created_at,user_id,parent_post_id)",
      )
      .eq("id", id)
      .maybeSingle();
    logSupabaseError("thread.detail", result.error);
    if (result.error || !result.data) {
      setLoading(false);
      return;
    }
    const rows = (
      [...(result.data.posts ?? [])] as Array<{
        id: string;
        content: string;
        created_at: string;
        user_id: string;
        parent_post_id?: string | null;
      }>
    ).sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const profileIds = [
      ...new Set([result.data.created_by, ...rows.map((row) => row.user_id)]),
    ];
    let profiles: {
      data: Array<{
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        title_badge?: string | null;
      }> | null;
      error: { message?: string } | null;
    } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url,title_badge")
      .in("id", profileIds);
    if (profiles.error)
      profiles = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url")
        .in("id", profileIds);
    logSupabaseError("thread.detail.profiles", profiles.error);
    const names = new Map(
      (profiles.data ?? []).map((profile) => [
        profile.id,
        profile.display_name || "會員",
      ]),
    );
    const badges = new Map(
      (profiles.data ?? []).map((profile) => [
        profile.id,
        profile.title_badge || "家庭成員",
      ]),
    );
    // The thread creator is the source of truth for the original article.
    // Nested post order is not guaranteed by Supabase, and a reply can have
    // an earlier/tied timestamp than the root post.
    const first =
      rows.find((row) => row.user_id === result.data?.created_by) ?? rows[0];
    if (!first) {
      setLoading(false);
      return;
    }
    const postAuthorId = first.user_id;
    const authorProfile = (profiles.data ?? []).find(
      (profile) => profile.id === postAuthorId,
    );
    const localBadge =
      typeof window !== "undefined" && postAuthorId === userId
        ? window.localStorage.getItem("profile-title-badge")
        : null;
    setAuthorBadge(authorProfile?.title_badge || localBadge || "家庭成員");
    const countResult = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", postAuthorId);
    setAuthorPostCount(countResult.count ?? 0);
    setPost({
      id: first.id,
      title: result.data.title,
      content: decodeRichHtml(first.content),
      authorId: postAuthorId,
      createdAt: result.data.created_at,
      authorName: names.get(postAuthorId) ?? "會員",
      authorAvatarUrl: authorProfile?.avatar_url,
      pinned: Boolean(result.data.pinned),
    });
    setReplies(
      rows
        .filter((row) => row.id !== first.id)
        .map((row) => ({
          ...row,
          content: decodeRichHtml(row.content),
          author: `${names.get(row.user_id) ?? "會員"}${row.user_id === postAuthorId ? " - [ 原Po ]" : ` - [ ${badges.get(row.user_id) ?? "家庭成員"} ]`}`,
          isOp: row.user_id === postAuthorId,
          avatarUrl: (profiles.data ?? []).find(
            (profile) => profile.id === row.user_id,
          )?.avatar_url,
        })),
    );
    setTitle(result.data.title);
    setContent(first.content);
    setLoading(false);
  };
  useEffect(() => {
    setLiveUserId(userId);
    if (supabase)
      void supabase.auth
        .getUser()
        .then(({ data }) => setLiveUserId(data.user?.id ?? null));
    void load();
  }, [id, userId]);
  useEffect(() => {
    if (!userId) return;
    const syncLocalBadge = () => {
      if (post?.authorId === userId) {
        const value = window.localStorage.getItem("profile-title-badge");
        if (value) setAuthorBadge(value);
      }
    };
    const timer = window.setInterval(syncLocalBadge, 500);
    return () => window.clearInterval(timer);
  }, [post?.authorId, userId]);
  useEffect(() => {
    const onTitleUpdated = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (post?.authorId === userId) setAuthorBadge(value || "家庭成員");
    };
    window.addEventListener("profile-title-updated", onTitleUpdated);
    return () =>
      window.removeEventListener("profile-title-updated", onTitleUpdated);
  }, [post?.authorId, userId]);
  const save = async () => {
    if (
      !supabase ||
      !post ||
      post.authorId !== liveUserId ||
      !liveUserId ||
      !title.trim() ||
      !content.trim()
    )
      return;
    const threadUpdate = await supabase
      .from("threads")
      .update({ title: title.trim() })
      .eq("id", id)
      .eq("created_by", liveUserId);
    logSupabaseError("thread.update", threadUpdate.error);
    if (threadUpdate.error) {
      notify(threadUpdate.error.message);
      return;
    }
    const postUpdate = await supabase
      .from("posts")
      .update({ content: content.trim() })
      .eq("id", post.id)
      .select("id,content")
      .maybeSingle();
    logSupabaseError("post.update", postUpdate.error);
    if (postUpdate.error || !postUpdate.data) {
      notify(postUpdate.error?.message ?? "文章內容未更新，請確認你是文章作者");
      return;
    }
    setPost({
      ...post,
      title: title.trim(),
      content: decodeRichHtml(postUpdate.data.content),
    });
    setEditing(false);
    notify("文章已更新");
  };
  const remove = async () => {
    if (
      !supabase ||
      !post ||
      post.authorId !== liveUserId ||
      !liveUserId ||
      !window.confirm("確定要刪除這篇文章嗎？刪除後無法復原。")
    )
      return;
    const result = await supabase
      .from("threads")
      .delete()
      .eq("id", id)
      .eq("created_by", liveUserId);
    logSupabaseError("thread.delete", result.error);
    if (result.error) notify(result.error.message);
    else {
      notify("文章已刪除");
      onDeleted();
      onBack();
    }
  };
  const togglePinned = async () => {
    if (!supabase || !post || post.authorId !== liveUserId) return;
    const nextPinned = !post.pinned;
    const result = await supabase
      .from("threads")
      .update({ pinned: nextPinned })
      .eq("id", id)
      .eq("created_by", liveUserId)
      .select("pinned")
      .maybeSingle();
    logSupabaseError("thread.pin", result.error);
    if (result.error || !result.data) {
      notify(result.error?.message ?? "置頂狀態更新失敗");
      return;
    }
    const savedPinned = Boolean(result.data?.pinned);
    setPost((current) =>
      current ? { ...current, pinned: savedPinned } : current,
    );
    notify(nextPinned ? "文章已置頂" : "已取消置頂");
  };
  const addReply = async () => {
    if (!supabase || !liveUserId || !reply.trim()) {
      notify("登入後才能留言");
      return;
    }
    const result = await supabase
      .from("posts")
      .insert({
        thread_id: id,
        user_id: liveUserId,
        content: reply.trim(),
        ...(replyingTo ? { parent_post_id: replyingTo } : {}),
      })
      .select("id,content,created_at,user_id,parent_post_id")
      .single();
    logSupabaseError("post.reply", result.error);
    if (result.error || !result.data) {
      notify(result.error?.message ?? "留言失敗");
      return;
    }
    const replyTarget = replyingTo
      ? replies.find((item) => item.id === replyingTo)
      : null;
    const replyTargetUserId =
      replyingTo === post?.id ? post.authorId : replyTarget?.user_id;
    if (replyTargetUserId && replyTargetUserId !== liveUserId) {
      const notification = await supabase.from("notifications").insert({
        recipient_id: replyTargetUserId,
        actor_id: liveUserId,
        thread_id: id,
        post_id: result.data.id,
        type: "reply",
      });
      logSupabaseError("notifications.reply", notification.error);
    }
    setReplies((current) => [
      ...current,
      { ...result.data, author: "我", avatarUrl },
    ]);
    setReply("");
    setReplyingTo(null);
    notify(replyingTo ? "回覆已發布" : "留言已發布");
  };
  const deleteReply = async (item: Reply) => {
    if (
      !supabase ||
      item.user_id !== liveUserId ||
      !window.confirm("確定要刪除這則留言嗎？")
    )
      return;
    const result = await supabase
      .from("posts")
      .delete()
      .eq("id", item.id)
      .eq("user_id", liveUserId);
    logSupabaseError("post.delete", result.error);
    if (result.error) notify(result.error.message);
    else {
      const idsToRemove = new Set<string>([item.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of replies) {
          if (
            candidate.parent_post_id &&
            idsToRemove.has(candidate.parent_post_id) &&
            !idsToRemove.has(candidate.id)
          ) {
            idsToRemove.add(candidate.id);
            changed = true;
          }
        }
      }
      setReplies((current) =>
        current.filter((replyItem) => !idsToRemove.has(replyItem.id)),
      );
      notify("留言已刪除");
    }
  };
  const startEditReply = (item: Reply) => {
    setEditingReplyId(item.id);
    setEditingReplyContent(item.content);
  };
  const saveReplyEdit = async (item: Reply) => {
    if (!supabase || item.user_id !== liveUserId) return;
    const nextContent = editingReplyContent.trim();
    if (!nextContent.replace(/<[^>]*>/g, "").trim()) {
      notify("留言內容不能為空");
      return;
    }
    const result = await supabase
      .from("posts")
      .update({ content: nextContent })
      .eq("id", item.id)
      .eq("user_id", liveUserId);
    logSupabaseError("post.edit", result.error);
    if (result.error) notify(result.error.message);
    else {
      setReplies((current) =>
        current.map((replyItem) =>
          replyItem.id === item.id
            ? { ...replyItem, content: nextContent }
            : replyItem,
        ),
      );
      setEditingReplyId(null);
      setEditingReplyContent("");
      notify("留言已更新");
    }
  };
  const uploadReplyImage = async (file: File) => {
    if (!supabase || !liveUserId) {
      notify("請先登入才能上傳圖片");
      return null;
    }
    if (!file.type.startsWith("image/") || file.size > 50 * 1024 * 1024) {
      notify("請選擇 50MB 以下的圖片");
      return null;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", liveUserId)
      .maybeSingle();
    if (!profile?.family_id) {
      notify("會員資料尚未同步");
      return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "") || "image.jpg";
    const path = `${profile.family_id}/posts/${liveUserId}/reply-${Date.now()}-${safeName}`;
    const uploaded = await supabase.storage
      .from("family-photos")
      .upload(path, file, { contentType: file.type });
    if (uploaded.error) {
      notify(`圖片上傳失敗：${uploaded.error.message}`);
      return null;
    }
    const signed = await supabase.storage
      .from("family-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    return signed.data?.signedUrl ?? null;
  };
  if (loading)
    return (
      <div className="empty-state">
        <p>文章載入中…</p>
      </div>
    );
  if (!post)
    return (
      <div className="empty-state">
        <p>找不到這篇文章</p>
        <button className="button ghost" onClick={onBack}>
          返回討論區
        </button>
      </div>
    );
  const owner = post.authorId === liveUserId;
  const replyTarget = replies.find((item) => item.id === replyingTo);
  const replyTargetName =
    replyingTo === post.id ? post.authorName : replyTarget?.author;
  const startReply = (item: Reply) => {
    setReplyingTo(item.id);
    window.setTimeout(() => {
      const box = document.querySelector(".comment-box");
      if (!box) return;
      const top = box.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: Math.max(0, top - window.innerHeight / 2),
        behavior: "smooth",
      });
    }, 0);
  };
  const startReplyToArticle = () => {
    setReplyingTo(post.id);
    window.setTimeout(() => {
      const box = document.querySelector(".comment-box");
      if (!box) return;
      const top = box.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: Math.max(0, top - window.innerHeight / 2),
        behavior: "smooth",
      });
    }, 0);
  };
  return (
    <section className="article-detail">
      <button className="text-button" onClick={onBack}>
        <Icon name="arrow-small-left" />
        返回討論區
      </button>
      <div className="article-layout">
        <aside className="author-panel">
          <Avatar
            src={post.authorAvatarUrl}
            fallback={post.authorName[0]}
            size="large"
          />
          <h3>{post.authorName}</h3>
          <p className="muted author-title">{authorBadge || "家庭成員"}</p>
          <p className="muted author-stats">
            發文數量：{authorPostCount}
            <br />
            作者 ID：{post.authorId.slice(0, 8)}…
          </p>
        </aside>
        <article className="article-content">
          <div className="article-actions">
            {owner && (
              <button
                className="button ghost pin-toggle"
                onClick={togglePinned}
              >
                <Icon name="star" />
                {post.pinned ? "取消置頂" : "置頂文章"}
              </button>
            )}
            <button
              className="button ghost"
              onClick={startReplyToArticle}
              disabled={!sessionEmail}
            >
              <Icon name="reply-all" />
              回覆文章
            </button>
            <button
              className={`button ghost danmaku-toggle ${showDanmaku ? "is-active" : ""}`}
              onClick={() => setShowDanmaku((value) => !value)}
              disabled={replies.length === 0}
              aria-pressed={showDanmaku}
            >
              <Icon name="play-alt" />
              {showDanmaku ? "關閉彈幕" : "開啟彈幕"}
            </button>
            {owner && (
              <>
                <button
                  className="button ghost"
                  onClick={() => setEditing((value) => !value)}
                >
                  <Icon name="edit" />
                  編輯文章
                </button>
                <button className="button ghost danger-button" onClick={remove}>
                  <Icon name="trash" />
                  刪除文章
                </button>
              </>
            )}
          </div>
          {editing ? (
            <div className="article-editor">
              <input
                className="auth-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="文章標題"
              />
              <RichTextEditor
                value={content}
                onChange={setContent}
                onImageUpload={uploadReplyImage}
                placeholder="編輯文章內容…"
              />
              <button className="button primary" onClick={save}>
                <Icon name="check" />
                儲存文章
              </button>
            </div>
          ) : (
            <>
              <h1>{post.title}</h1>
              <p className="muted">
                {new Date(post.createdAt).toLocaleString("zh-TW")}
              </p>
              <div
                className="modal-body article-body"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
              {showDanmaku && replies.length > 0 && (
                <div className="danmaku-layer" aria-label="留言彈幕">
                  {replies.slice(0, 12).map((item, index) => (
                    <span
                      className="danmaku-item"
                      key={item.id}
                      style={
                        {
                          "--danmaku-top": `${8 + (index % 6) * 14}%`,
                          "--danmaku-delay": `${(index % 6) * 1.8}s`,
                          "--danmaku-duration": `${16 + (index % 5) * 2}s`,
                        } as React.CSSProperties
                      }
                    >
                      <b>{item.author.split(" - ")[0]}</b>
                      {item.content.replace(/<[^>]*>/g, " ").trim()}
                    </span>
                  ))}
                </div>
              )}
              {extractHashtags(`${post.title} ${post.content}`).length > 0 && (
                <div className="article-tags" aria-label="文章標籤">
                  <span className="tag-label">分類／標籤</span>
                  {extractHashtags(`${post.title} ${post.content}`).map(
                    (tag) => (
                      <span className="hashtag" key={tag}>
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </article>
      </div>
      <div className="comment-stack">
        {replies.length > 0 && <h2>留言／回覆</h2>}
        {replies.length > 0 &&
          (() => {
            const parentById = new Map(
              replies.map((replyItem) => [
                replyItem.id,
                replyItem.parent_post_id,
              ]),
            );
            const getThreadRoot = (item: (typeof replies)[number]) => {
              let rootId = item.id;
              let parentId = item.parent_post_id;
              const visited = new Set<string>();
              while (parentId && !visited.has(parentId)) {
                visited.add(parentId);
                rootId = parentId;
                parentId = parentById.get(parentId) ?? null;
              }
              return rootId;
            };
            return replies.map((item, index) => {
              const parent = replies.find(
                (candidate) => candidate.id === item.parent_post_id,
              );
              const replyTargetName = parent?.author ?? post?.authorName;
              const replyFloor = replies
                .slice(0, index + 1)
                .filter((replyItem) =>
                  Boolean(replyItem.parent_post_id),
                ).length;
              const next = replies[index + 1];
              const hasThreadContinuation = Boolean(
                next && getThreadRoot(next) === getThreadRoot(item),
              );
              return (
                <div
                  className={`comment-item ${item.parent_post_id ? "comment-item-reply" : ""}`}
                  key={item.id}
                >
                  <div className="comment-rail" aria-hidden="true">
                    <Avatar src={item.avatarUrl} fallback={item.author[0]} />
                    <span
                      className={`comment-thread-line ${hasThreadContinuation ? "is-visible" : ""}`}
                    />
                  </div>
                  <div className="comment-main">
                    <div className="comment-header">
                      {item.parent_post_id && replyTargetName && (
                        <span className="reply-context">
                          回覆 {replyTargetName}
                        </span>
                      )}
                      <b>{item.author}</b>
                      <small>
                        {new Date(item.created_at).toLocaleString("zh-TW")}
                      </small>
                      {item.parent_post_id && (
                        <span className="comment-floor">{replyFloor}樓</span>
                      )}
                    </div>
                    {editingReplyId === item.id ? (
                      <div className="comment-edit-form">
                        <RichTextEditor
                          value={editingReplyContent}
                          onChange={setEditingReplyContent}
                          onImageUpload={uploadReplyImage}
                          placeholder="編輯留言內容…"
                        />
                        <div className="comment-edit-actions">
                          <button
                            className="button ghost"
                            type="button"
                            onClick={() => {
                              setEditingReplyId(null);
                              setEditingReplyContent("");
                            }}
                          >
                            取消
                          </button>
                          <button
                            className="button primary"
                            type="button"
                            onClick={() => saveReplyEdit(item)}
                          >
                            儲存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: item.content }} />
                    )}
                    <div className="comment-actions">
                      <button
                        className="comment-reply-button"
                        type="button"
                        onClick={() => startReply(item)}
                        disabled={!sessionEmail}
                      >
                        <Icon name="reply-all" />
                        回覆
                      </button>
                      {item.user_id === liveUserId && (
                        <>
                          <button
                            className="comment-edit-button"
                            type="button"
                            onClick={() => startEditReply(item)}
                            disabled={editingReplyId === item.id}
                          >
                            <Icon name="edit" />
                            編輯
                          </button>
                          <button
                            className="comment-delete-button"
                            type="button"
                            onClick={() => deleteReply(item)}
                          >
                            <Icon name="trash" />
                            刪除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        {sessionEmail ? (
          <>
            {replyingTo && replyTargetName && (
              <div className="replying-banner">
                <span>
                  正在回覆 <b>{replyTargetName}</b>
                </span>
                <button type="button" onClick={() => setReplyingTo(null)}>
                  取消回覆
                </button>
              </div>
            )}
            <div className="comment-box">
              <RichTextEditor
                value={reply}
                onChange={setReply}
                onImageUpload={uploadReplyImage}
                placeholder={
                  replyTargetName ? `回覆 ${replyTargetName}…` : "寫下你的留言…"
                }
              />
              <button className="button primary" onClick={addReply}>
                {replyingTo ? "回覆" : "留言"}
              </button>
            </div>
          </>
        ) : (
          <p className="muted">登入後即可留言。</p>
        )}
      </div>
    </section>
  );
}
function Avatar({
  src,
  fallback,
  tone,
  size,
}: {
  src?: string | null;
  fallback: string;
  tone?: string;
  size?: "large";
}) {
  return src ? (
    <div
      className={`avatar avatar-image ${size === "large" ? "avatar-large" : ""}`}
    >
      <img src={src} alt="" />
    </div>
  ) : (
    <div
      className={`avatar ${tone ? `thread-marker ${tone}` : ""} ${size === "large" ? "avatar-large" : ""}`}
    >
      {fallback}
    </div>
  );
}
function ThreadCard({
  thread,
  onClick,
  compact = false,
  listOnly = false,
}: {
  thread: Thread;
  onClick: () => void;
  compact?: boolean;
  listOnly?: boolean;
}) {
  const isNew = thread.createdAt
    ? Date.now() - new Date(thread.createdAt).getTime() <=
      3 * 24 * 60 * 60 * 1000
    : false;
  const isHot = thread.replies >= 5;
  return (
    <article
      className={`thread-card ${compact ? "thread-card-compact" : ""}`}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <Avatar
        src={thread.avatarUrl}
        fallback={thread.author[0]}
        tone={thread.tone}
      />
      <div className="thread-body">
        <div className="thread-meta">
          {thread.author}
          {!listOnly && ` · ${thread.time}`}
          {thread.pinned && (
            <b className="pinned" title="置頂文章">
              <Icon name="star" />
              <Icon name="pin" />
              置頂
            </b>
          )}
        </div>
        <h3 className="thread-title-row">
          <span>{thread.title}</span>
          <span className="thread-badges" aria-label="文章標籤">
            {isHot && <b className="dynamic-badge badge-hot">HOT</b>}
            {isNew && <b className="dynamic-badge badge-new">NEW</b>}
            {thread.pinned && (
              <b className="dynamic-badge badge-recommended">推薦</b>
            )}
          </span>
        </h3>
        {!compact && !listOnly && (
          <div
            className="thread-rich-preview"
            dangerouslySetInnerHTML={{ __html: decodeRichHtml(thread.body) }}
          />
        )}
        {!listOnly &&
          extractHashtags(`${thread.title} ${thread.body}`).length > 0 && (
            <div className="thread-tags" aria-label="文章標籤">
              <span className="tag-label">分類／標籤</span>
              {extractHashtags(`${thread.title} ${thread.body}`).map((tag) => (
                <span className="hashtag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        <div className="thread-footer">
          {thread.replies} 則回覆 {!listOnly && <Icon name="arrow-up-right" />}
        </div>
      </div>
    </article>
  );
}
function Trips({
  notify,
  sessionEmail,
}: {
  notify: (m: string) => void;
  sessionEmail: string | null;
}) {
  const [items, setItems] = useState<
    Array<{ id: string; title: string; start_date: string; end_date: string }>
  >([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const load = async () => {
    if (!supabase || !sessionEmail) return;
    const { data } = await supabase
      .from("itineraries")
      .select("id,title,start_date,end_date")
      .order("start_date");
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, [sessionEmail]);
  const create = async () => {
    if (!supabase || !sessionEmail) {
      notify("請先登入會員");
      return;
    }
    if (!title.trim() || !start || !end) {
      notify("請填寫行程名稱與日期");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.family_id) {
      notify("會員資料尚未同步");
      return;
    }
    const { error } = await supabase.from("itineraries").insert({
      family_id: profile.family_id,
      title: title.trim(),
      start_date: start,
      end_date: end,
      created_by: user.id,
    });
    if (error) notify(error.message);
    else {
      setTitle("");
      setStart("");
      setEnd("");
      notify("行程已建立");
      load();
    }
  };
  return (
    <>
      <Hero
        kicker="家庭行程"
        title="一起規劃下一站"
        copy="建立屬於家人的第一段旅程。"
        action={
          <button className="button primary" onClick={create}>
            <Icon name="plus" />
            新增行程
          </button>
        }
      />
      <section className="setting-card">
        <label>
          行程名稱
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：週末旅行"
          />
        </label>
        <div className="profile-grid">
          <label>
            開始日期
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            結束日期
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      </section>
      <div className="thread-list">
        {items.length ? (
          items.map((item) => (
            <article className="thread-card" key={item.id}>
              <div className="thread-marker forest">
                <Icon name="calendar-day" />
              </div>
              <div className="thread-body">
                <h3>{item.title}</h3>
                <p>
                  {item.start_date} ～ {item.end_date}
                </p>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <p>
              {sessionEmail ? "目前沒有行程資料。" : "登入後即可查看家庭行程。"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
type Album = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  coverUrl?: string;
};
function Albums({
  notify,
  sessionEmail,
}: {
  notify: (m: string) => void;
  sessionEmail: string | null;
}) {
  type Photo = {
    id: string;
    storage_path: string;
    caption: string | null;
    location?: string | null;
    url: string;
  };
  const [items, setItems] = useState<Album[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorText, setEditorText] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [editingAlbum, setEditingAlbum] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingLocation, setPendingLocation] = useState("");
  const [pendingCaption, setPendingCaption] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const missingDescription = (error: { message?: string } | null) =>
    Boolean(
      error?.message?.toLowerCase().includes("description") &&
      error.message.toLowerCase().includes("schema cache"),
    );
  const load = async () => {
    if (!supabase || !sessionEmail) return;
    const result = await supabase
      .from("albums")
      .select("id,title,description,created_at")
      .order("created_at", { ascending: false });
    let albums = result.data as Album[] | null;
    if (result.error && missingDescription(result.error)) {
      const fallback = await supabase
        .from("albums")
        .select("id,title,created_at")
        .order("created_at", { ascending: false });
      albums = (fallback.data ?? []).map((item) => ({
        ...item,
        description: "",
      })) as Album[];
    }
    if (result.error && !missingDescription(result.error))
      logSupabaseError("albums.select", result.error);
    const decorated = await Promise.all(
      (albums ?? []).map(async (album) => {
        const first = await supabase!
          .from("photos")
          .select("storage_path")
          .eq("album_id", album.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!first.data?.storage_path) return album;
        const signed = await supabase!.storage
          .from("family-photos")
          .createSignedUrl(first.data.storage_path, 86400);
        return { ...album, coverUrl: signed.data?.signedUrl };
      }),
    );
    setItems(decorated);
  };
  useEffect(() => {
    load();
  }, [sessionEmail]);
  useEffect(() => {
    const openPhoto = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const image = target.closest(
        ".photo-detail-card img",
      ) as HTMLImageElement | null;
      const card = image?.closest(".photo-detail-card");
      if (!image || !card) return;
      const existing = document.querySelector(".photo-lightbox");
      existing?.remove();
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".photo-detail-card img"),
      );
      let currentIndex = Math.max(images.indexOf(image), 0);
      const modal = document.createElement("div");
      modal.className = "photo-lightbox";
      modal.innerHTML = `<div class="photo-lightbox-panel"><button class="photo-lightbox-close" aria-label="關閉"><i class="fi fi-rr-cross ui-icon" aria-hidden="true"></i></button><button class="photo-lightbox-nav photo-lightbox-prev" aria-label="上一張"><i class="fi fi-rr-angle-left ui-icon" aria-hidden="true"></i></button><img src="" alt="相簿照片"><button class="photo-lightbox-nav photo-lightbox-next" aria-label="下一張"><i class="fi fi-rr-angle-right ui-icon" aria-hidden="true"></i></button><div class="photo-lightbox-details"></div></div>`;
      document.body.appendChild(modal);
      const panel = modal.querySelector(".photo-lightbox-panel") as HTMLElement;
      const lightboxImage = panel.querySelector("img") as HTMLImageElement;
      const detailsElement = panel.querySelector(
        ".photo-lightbox-details",
      ) as HTMLElement;
      const previousButton = panel.querySelector(
        ".photo-lightbox-prev",
      ) as HTMLButtonElement;
      const nextButton = panel.querySelector(
        ".photo-lightbox-next",
      ) as HTMLButtonElement;
      const renderPhoto = (index: number) => {
        const selected = images[index];
        const selectedCard = selected?.closest(".photo-detail-card");
        if (!selected || !selectedCard) return;
        currentIndex = index;
        lightboxImage.src = selected.src;
        lightboxImage.alt = selected.alt || "相簿照片";
        detailsElement.innerHTML =
          selectedCard.querySelector(".photo-caption")?.innerHTML ??
          "尚未新增地點或文字說明";
        previousButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === images.length - 1;
      };
      renderPhoto(currentIndex);
      modal.addEventListener("click", (click) => {
        if (
          click.target === modal ||
          (click.target as HTMLElement).closest(".photo-lightbox-close")
        )
          closeModal();
        else if ((click.target as HTMLElement).closest(".photo-lightbox-prev"))
          renderPhoto(Math.max(currentIndex - 1, 0));
        else if ((click.target as HTMLElement).closest(".photo-lightbox-next"))
          renderPhoto(Math.min(currentIndex + 1, images.length - 1));
      });
      const onKeyDown = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key === "Escape") closeModal();
        if (keyboardEvent.key === "ArrowLeft")
          renderPhoto(Math.max(currentIndex - 1, 0));
        if (keyboardEvent.key === "ArrowRight")
          renderPhoto(Math.min(currentIndex + 1, images.length - 1));
      };
      const closeModal = () => {
        document.removeEventListener("keydown", onKeyDown);
        modal.remove();
      };
      document.addEventListener("keydown", onKeyDown);
    };
    document.addEventListener("click", openPhoto);
    return () => document.removeEventListener("click", openPhoto);
  }, []);
  const loadPhotos = async (albumId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("photos")
      .select("id,storage_path,caption,location")
      .eq("album_id", albumId)
      .order("created_at");
    logSupabaseError("photos.select", error);
    const signed = await Promise.all(
      (data ?? []).map(async (photo) => {
        const result = await supabase!.storage
          .from("family-photos")
          .createSignedUrl(photo.storage_path, 86400);
        return { ...photo, url: result.data?.signedUrl ?? "" };
      }),
    );
    setPhotos(signed.filter((photo) => photo.url));
  };
  const create = async () => {
    if (!supabase || !sessionEmail) {
      notify("請先登入會員");
      return;
    }
    if (!title.trim()) {
      notify("請輸入相簿名稱");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.family_id) {
      notify("會員資料尚未同步");
      return;
    }
    let result = await supabase.from("albums").insert({
      family_id: profile.family_id,
      title: title.trim(),
      description: description.trim(),
    });
    if (missingDescription(result.error))
      result = await supabase
        .from("albums")
        .insert({ family_id: profile.family_id, title: title.trim() });
    if (result.error) notify(result.error.message);
    else {
      setTitle("");
      setDescription("");
      notify("相簿已建立");
      load();
    }
  };
  const openAlbum = (album: Album) => {
    setSelectedId(album.id);
    setEditingAlbum(false);
    setEditorTitle(album.title);
    setEditorText(album.description ?? "");
    void loadPhotos(album.id);
  };
  const saveEditor = async () => {
    if (!supabase || !selectedId || !editorTitle.trim()) {
      notify("請輸入相簿名稱");
      return;
    }
    let result = await supabase
      .from("albums")
      .update({ title: editorTitle.trim(), description: editorText.trim() })
      .eq("id", selectedId);
    if (missingDescription(result.error))
      result = await supabase
        .from("albums")
        .update({ title: editorTitle.trim() })
        .eq("id", selectedId);
    if (result.error) notify(result.error.message);
    else {
      setItems((current) =>
        current.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                title: editorTitle.trim(),
                description: missingDescription(result.error)
                  ? item.description
                  : editorText.trim(),
              }
            : item,
        ),
      );
      notify("相簿已更新");
    }
  };
  const deleteAlbum = async () => {
    if (!supabase || !selectedId || !window.confirm("確定刪除這本相簿嗎？"))
      return;
    const { error } = await supabase
      .from("albums")
      .delete()
      .eq("id", selectedId);
    if (error) notify(error.message);
    else {
      setItems((current) => current.filter((item) => item.id !== selectedId));
      setSelectedId(null);
      setPhotos([]);
      notify("相簿已刪除");
    }
  };
  const uploadPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedId) return;
    if (
      (!file.type.startsWith("image/") &&
        !["image/heic", "image/heif"].includes(file.type)) ||
      file.size > 8 * 1024 * 1024
    ) {
      notify("請選擇 8MB 以下的圖片");
      return;
    }
    setPendingPhoto(file);
    setPendingLocation("");
    setPendingCaption("");
  };
  const confirmPhotoUpload = async () => {
    const file = pendingPhoto;
    if (!file || !supabase || !selectedId) return;
    setUploadingPhoto(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploadingPhoto(false);
      return;
    }
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", user.id)
      .maybeSingle();
    logSupabaseError("photos.profile", profileError);
    if (!profile?.family_id) {
      const bootstrap = await supabase.rpc("bootstrap_family", {
        p_display_name: user.email?.split("@")[0] ?? "會員",
      });
      logSupabaseError("photos.bootstrap_family", bootstrap.error);
      if (bootstrap.error) {
        notify(`會員資料同步失敗：${bootstrap.error.message}`);
        setUploadingPhoto(false);
        return;
      }
      ({ data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .maybeSingle());
      logSupabaseError("photos.profile.retry", profileError);
    }
    if (!profile?.family_id) {
      notify(profileError?.message ?? "會員資料尚未同步，請重新登入後再試");
      setUploadingPhoto(false);
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "") || "image.jpg";
    const path = `${profile.family_id}/${selectedId}/${user.id}/photo-${Date.now()}-${safeName}`;
    const uploaded = await supabase.storage
      .from("family-photos")
      .upload(path, file, { contentType: file.type });
    if (uploaded.error) notify(uploaded.error.message);
    else {
      const inserted = await supabase.from("photos").insert({
        album_id: selectedId,
        storage_path: path,
        uploaded_by: user.id,
        caption: pendingCaption.trim(),
        location: pendingLocation.trim(),
      });
      if (inserted.error) notify(inserted.error.message);
      else {
        notify("照片已加入相簿");
        loadPhotos(selectedId);
        setPendingPhoto(null);
      }
    }
    setUploadingPhoto(false);
  };
  const savePhotoDetails = async (
    photo: Photo,
    location: string,
    caption: string,
  ) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("photos")
      .update({ location: location.trim(), caption: caption.trim() })
      .eq("id", photo.id);
    if (error) notify(error.message);
    else
      setPhotos((current) =>
        current.map((item) =>
          item.id === photo.id
            ? { ...item, location: location.trim(), caption: caption.trim() }
            : item,
        ),
      );
  };
  const deletePhoto = async (photo: Photo) => {
    if (!supabase || !window.confirm("確定刪除這張照片嗎？")) return;
    const { error } = await supabase.from("photos").delete().eq("id", photo.id);
    if (error) notify(error.message);
    else {
      await supabase.storage.from("family-photos").remove([photo.storage_path]);
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      notify("照片已刪除");
    }
  };
  const addLine = (prefix: string) =>
    setEditorText((current) => `${current}${current ? "\n" : ""}${prefix}`);
  const selected = items.find((item) => item.id === selectedId);
  if (selected)
    return (
      <>
        <div className="album-detail-head">
          <button
            className="text-button"
            onClick={() => {
              setSelectedId(null);
              setPhotos([]);
              setEditingAlbum(false);
            }}
          >
            <Icon name="arrow-small-left" />
            返回相簿
          </button>
          <div className="album-detail-actions">
            <button
              className="button ghost"
              onClick={() => setEditingAlbum((value) => !value)}
            >
              {editingAlbum ? "取消編輯" : "編輯相簿"}
            </button>
            <label className="button primary">
              <Icon name="plus" />
              新增照片
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={uploadPhoto}
              />
            </label>
            <button
              className="button ghost danger-button"
              onClick={deleteAlbum}
            >
              <Icon name="trash" />
              刪除相簿
            </button>
          </div>
        </div>
        <Hero
          kicker="相簿詳情"
          title={selected.title}
          copy={selected.description || "記錄這本相簿裡的每個珍貴時刻。"}
        />
        {editingAlbum && (
          <section className="setting-card album-text-editor">
            <div className="section-heading">
              <div>
                <p className="eyebrow">文字編輯器</p>
                <h2>編輯相簿</h2>
              </div>
              <button
                className="button primary"
                onClick={async () => {
                  await saveEditor();
                  setEditingAlbum(false);
                }}
              >
                儲存編輯
              </button>
            </div>
            <input
              className="auth-input"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              aria-label="相簿名稱"
              placeholder="相簿名稱"
            />
            <div className="editor-toolbar">
              <button
                className="button ghost"
                onClick={() => addLine("標題：")}
              >
                加入標題
              </button>
              <button className="button ghost" onClick={() => addLine("• ")}>
                加入條列
              </button>
              <button
                className="button ghost"
                onClick={() => addLine("日期：")}
              >
                加入日期
              </button>
            </div>
            <textarea
              className="album-description-editor"
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder="記錄這本相簿的故事…"
              rows={7}
            />
          </section>
        )}
        <div className="photo-detail-grid">
          {photos.length ? (
            photos.map((photo) => (
              <article className="photo-detail-card" key={photo.id}>
                <img src={photo.url} alt={photo.caption || "相簿照片"} />
                <button
                  className="text-button danger-button"
                  onClick={() => deletePhoto(photo)}
                >
                  <Icon name="trash" />
                  刪除照片
                </button>
                {(photo.location || photo.caption) && (
                  <p className="photo-caption">
                    {photo.location && (
                      <>
                        <Icon name="marker" /> {photo.location}
                        <br />
                      </>
                    )}
                    {photo.caption && (
                      <>
                        <Icon name="document" /> {photo.caption}
                      </>
                    )}
                  </p>
                )}
                {editingAlbum && (
                  <label>
                    <Icon name="marker" /> 地點
                    <input
                      defaultValue={photo.location ?? ""}
                      placeholder="地點"
                      onBlur={(event) =>
                        savePhotoDetails(
                          photo,
                          event.currentTarget.value,
                          photo.caption ?? "",
                        )
                      }
                    />
                  </label>
                )}
                {editingAlbum && (
                  <label>
                    <Icon name="document" /> 相片描述
                    <textarea
                      defaultValue={photo.caption ?? ""}
                      onBlur={(event) =>
                        savePhotoDetails(
                          photo,
                          photo.location ?? "",
                          event.currentTarget.value,
                        )
                      }
                      placeholder="相片描述"
                      rows={2}
                    />
                  </label>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <p>還沒有照片，從右上角新增第一張吧。</p>
            </div>
          )}
        </div>
        {pendingPhoto && (
          <div
            className="modal-backdrop"
            onMouseDown={() => !uploadingPhoto && setPendingPhoto(null)}
          >
            <section
              className="composer-modal photo-upload-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">新增照片</p>
                  <h2>{pendingPhoto.name}</h2>
                </div>
                <button
                  className="close-button"
                  onClick={() => setPendingPhoto(null)}
                  disabled={uploadingPhoto}
                  aria-label="關閉"
                >
                  <Icon name="cross" />
                </button>
              </div>
              <label>
                <Icon name="marker" /> 地點
                <input
                  value={pendingLocation}
                  onChange={(event) => setPendingLocation(event.target.value)}
                  placeholder="例如：台北・陽明山"
                />
              </label>
              <label>
                <Icon name="document" /> 文字說明
                <textarea
                  value={pendingCaption}
                  onChange={(event) => setPendingCaption(event.target.value)}
                  placeholder="寫下這張照片的故事…"
                  rows={4}
                />
              </label>
              <div className="modal-actions">
                <button
                  className="button ghost"
                  onClick={() => setPendingPhoto(null)}
                  disabled={uploadingPhoto}
                >
                  取消
                </button>
                <button
                  className="button primary"
                  onClick={confirmPhotoUpload}
                  disabled={uploadingPhoto}
                >
                  <Icon name="upload" />
                  {uploadingPhoto ? "上傳中…" : "確認上傳"}
                </button>
              </div>
            </section>
          </div>
        )}
      </>
    );
  return (
    <>
      <Hero
        kicker="共享相簿"
        title="收藏小日子"
        copy="把家人想留下的每個時刻放在一起。"
        action={
          <button className="button primary" onClick={create}>
            <Icon name="plus" />
            新增相簿
          </button>
        }
      />
      <section className="setting-card album-editor-create">
        <label>
          相簿名稱
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：家庭聚會"
          />
        </label>
        <label>
          相簿說明
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="寫下這本相簿的故事、地點或日期…"
            rows={3}
          />
        </label>
      </section>
      <div className="album-grid">
        {items.length ? (
          items.map((item) => (
            <article
              className="album-card"
              key={item.id}
              onClick={() => openAlbum(item)}
            >
              <div
                className={`album-art tile-0 ${item.coverUrl ? "has-cover" : ""}`}
                style={
                  item.coverUrl
                    ? {
                        backgroundImage: `linear-gradient(180deg, #0b141133 25%, #0b1411cc 100%), url("${item.coverUrl}")`,
                      }
                    : undefined
                }
              >
                <span>吾黨所鍾</span>
              </div>
              <div className="album-caption">
                <b>{item.title}</b>
                <small>
                  {new Date(item.created_at).toLocaleDateString("zh-TW")}
                </small>
                {item.description && <p>{item.description}</p>}
                <button
                  className="text-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openAlbum(item);
                  }}
                >
                  開啟相簿 <Icon name="arrow-small-right" />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <p>
              {sessionEmail ? "目前沒有相簿資料。" : "登入後即可查看共享相簿。"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function TaiwanWeather() {
  const cities = [
    { name: "台北", lat: 25.0375, lon: 121.5637 },
    { name: "新北", lat: 25.0118, lon: 121.4658 },
    { name: "基隆", lat: 25.1276, lon: 121.7392 },
    { name: "桃園", lat: 24.9937, lon: 121.301 },
    { name: "新竹", lat: 24.8138, lon: 120.9675 },
    { name: "苗栗", lat: 24.5602, lon: 120.8214 },
    { name: "台中", lat: 24.1477, lon: 120.6736 },
    { name: "彰化", lat: 24.0755, lon: 120.544 },
    { name: "南投", lat: 23.9609, lon: 120.9719 },
    { name: "雲林", lat: 23.7092, lon: 120.4313 },
    { name: "嘉義", lat: 23.4801, lon: 120.4491 },
    { name: "台南", lat: 22.9997, lon: 120.227 },
    { name: "高雄", lat: 22.6273, lon: 120.3014 },
    { name: "屏東", lat: 22.5519, lon: 120.5487 },
    { name: "宜蘭", lat: 24.757, lon: 121.7533 },
    { name: "花蓮", lat: 23.9911, lon: 121.6112 },
    { name: "台東", lat: 22.7554, lon: 121.15 },
    { name: "澎湖", lat: 23.5711, lon: 119.5793 },
    { name: "金門", lat: 24.4368, lon: 118.3186 },
    { name: "馬祖", lat: 26.1605, lon: 119.9517 },
  ];
  const [city, setCity] = useState(cities[0]);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=5`;
    fetch(url)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => active && setWeather(data))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [city]);
  const weatherLabel = (code: number) =>
    code === 0 ? "晴朗" : code < 3 ? "多雲" : code < 60 ? "有雨" : "降雨";
  const weatherIcon = (code: number) =>
    code === 0 ? "sun" : code < 3 ? "cloud-sun" : "cloud-rain";
  return (
    <section className="weather-panel" aria-label="台灣天氣">
      <div className="weather-panel-head">
        <div>
          <p className="eyebrow">
            <Icon name="cloud-sun" /> 台灣天氣
          </p>
          <h2>{city.name}即時天氣</h2>
        </div>
        <select
          value={city.name}
          onChange={(event) =>
            setCity(
              cities.find((item) => item.name === event.target.value) ??
                cities[0],
            )
          }
          aria-label="選擇城市"
        >
          {cities.map((item) => (
            <option key={item.name}>{item.name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="muted">天氣資料載入中…</p>
      ) : error ? (
        <p className="muted">暫時無法取得天氣資料，請稍後再試。</p>
      ) : (
        weather && (
          <>
            <div className="weather-current">
              <div className="weather-temp">
                <Icon name="sun" />
                <strong>{Math.round(weather.current.temperature_2m)}°</strong>
                <span>{weatherLabel(weather.current.weather_code)}</span>
              </div>
              <div className="weather-metrics">
                <span>
                  <Icon name="raindrops" /> 降雨{" "}
                  {weather.daily.precipitation_probability_max[0]}%
                </span>
                <span>
                  <Icon name="wind" /> 風速{" "}
                  {Math.round(weather.current.wind_speed_10m)} km/h
                </span>
                <span>
                  體感 {Math.round(weather.current.apparent_temperature)}°
                </span>
                <span>
                  <Icon name="humidity" /> 濕度{" "}
                  {weather.current.relative_humidity_2m}%
                </span>
              </div>
            </div>
            <div className="weather-hourly">
              <h3>接下來幾小時</h3>
              <div className="weather-hourly-track">
                {weather.hourly.time
                  .slice(0, 8)
                  .map((time: string, index: number) => (
                    <div className="weather-hour" key={time}>
                      <small>
                        {new Date(time).toLocaleTimeString("zh-TW", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </small>
                      <Icon
                        name={weatherIcon(weather.hourly.weather_code[index])}
                      />
                      <b>{Math.round(weather.hourly.temperature_2m[index])}°</b>
                      <span>
                        {weather.hourly.precipitation_probability[index]}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="weather-forecast">
              {weather.daily.time.map((date: string, index: number) => (
                <div className="weather-day" key={date}>
                  <b>
                    {index === 0
                      ? "今天"
                      : new Date(`${date}T00:00:00+08:00`).toLocaleDateString(
                          "zh-TW",
                          { weekday: "short" },
                        )}
                  </b>
                  <Icon name={weatherIcon(weather.daily.weather_code[index])} />
                  <span>{weatherLabel(weather.daily.weather_code[index])}</span>
                  <strong>
                    {Math.round(weather.daily.temperature_2m_max[index])}°
                  </strong>
                  <small>
                    <Icon name="raindrops" />{" "}
                    {weather.daily.precipitation_probability_max[index]}%
                  </small>
                </div>
              ))}
            </div>
          </>
        )
      )}
      <small className="weather-credit">
        資料來源：Open-Meteo（免費非商業使用）
      </small>
    </section>
  );
}

// Legacy profile view retained for compatibility; ProfileWithAvatar is active.

function TitleEditor({
  notify,
  userId,
}: {
  notify: (m: string) => void;
  userId: string | null;
}) {
  const [badge, setBadge] = useState("");
  const [color, setColor] = useState("#285c4d");
  const [size, setSize] = useState("medium");
  useEffect(() => {
    if (supabase && userId)
      supabase
        .from("profiles")
        .select("title_badge,title_color,title_size")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => {
          setBadge(data?.title_badge ?? "");
          setColor(data?.title_color ?? "#285c4d");
          setSize(data?.title_size ?? "medium");
        });
  }, [userId]);
  const save = async () => {
    if (!supabase || !userId) return;
    const nextBadge = badge.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ title_badge: nextBadge, title_color: color, title_size: size })
      .eq("id", userId);
    if (!error) {
      window.localStorage.setItem("profile-title-badge", nextBadge);
      window.dispatchEvent(
        new CustomEvent("profile-title-updated", { detail: nextBadge }),
      );
    }
    notify(error ? `稱號儲存失敗：${error.message}` : "稱號與徽章已儲存");
  };
  if (!userId) return null;
  return (
    <section className="setting-card title-editor-card">
      <p className="eyebrow">稱號與徽章</p>
      <div className="title-editor-row">
        <input
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          placeholder="例如：旅行達人、家中主廚"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="稱號顏色"
        />
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          aria-label="稱號大小"
        >
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
        </select>
        <button className="button primary" onClick={save}>
          儲存
        </button>
      </div>
      {badge && (
        <span className={`profile-badge badge-${size}`} style={{ color }}>
          {badge}
        </span>
      )}
    </section>
  );
}
function ProfileWithAvatar({
  notify,
  saveProfile,
  sessionName,
  sessionEmail,
  userId,
  onAvatarChange,
}: {
  notify: (m: string) => void;
  saveProfile: (name: string) => void;
  sessionName: string;
  sessionEmail: string | null;
  userId: string | null;
  onAvatarChange: (url: string) => void;
}) {
  const [name, setName] = useState(sessionName);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(sessionName);
    if (supabase && userId)
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle()
        .then(({ data }) => setAvatarUrl(data?.avatar_url ?? ""));
  }, [sessionName, userId]);
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !supabase || !userId) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      notify("請選擇 2MB 以下的圖片");
      return;
    }
    setBusy(true);
    const profile = await supabase
      .from("profiles")
      .select("family_id")
      .eq("id", userId)
      .maybeSingle();
    const profileFamilyId = profile.data?.family_id;
    if (profile.error || !profileFamilyId) {
      notify(profile.error?.message ?? "會員資料尚未同步");
      setBusy(false);
      return;
    }
    const path = `${profileFamilyId}/${userId}/avatar-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const result = await supabase.storage
      .from("family-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (result.error) notify(result.error.message);
    else {
      const signed = await supabase.storage
        .from("family-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error) notify(signed.error.message);
      else {
        const update = await supabase
          .from("profiles")
          .update({ avatar_url: signed.data.signedUrl })
          .eq("id", userId);
        if (update.error) notify(update.error.message);
        else {
          setAvatarUrl(signed.data.signedUrl);
          onAvatarChange(signed.data.signedUrl);
          notify("頭像已更新");
        }
      }
    }
    setBusy(false);
  };
  return (
    <>
      <section className="profile-hero">
        <div className="avatar avatar-profile avatar-image">
          {avatarUrl ? (
            <img src={avatarUrl} alt="個人頭像" />
          ) : name ? (
            name[0]
          ) : (
            "訪"
          )}
        </div>
        <div>
          <p className="eyebrow">你的個人檔案</p>
          <h1>
            {name || "尚未登入"}
            <span>.</span>
          </h1>
          <p className="hero-copy">
            {sessionEmail ?? "登入後即可編輯你的個人資料。"}
          </p>
          <label className="avatar-upload button ghost">
            <Icon name="upload" />
            {busy ? "上傳中…" : "上傳頭像"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
              disabled={busy || !userId}
            />
          </label>
        </div>
      </section>
      <div className="profile-grid">
        <section className="setting-card">
          <p className="eyebrow">個人資料</p>
          <label>
            顯示名稱
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="登入後設定名稱"
            />
          </label>
          <button className="button primary" onClick={() => saveProfile(name)}>
            儲存變更
          </button>
        </section>
      </div>
    </>
  );
}

export default App;

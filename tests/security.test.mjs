import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(
  new URL("../supabase/schema.sql", import.meta.url),
  "utf8",
);
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/App.css", import.meta.url), "utf8");

test("schema covers every family-owned table and enables RLS", () => {
  for (const table of [
    "families",
    "profiles",
    "threads",
    "posts",
    "itineraries",
    "itinerary_items",
    "albums",
    "photos",
  ]) {
    assert.match(
      schema,
      new RegExp(`create table if not exists public\\.${table}`),
    );
    assert.match(
      schema,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }
});

test("policies derive access from the authenticated family scope", () => {
  assert.match(schema, /my_family_id\(\)/);
  assert.match(schema, /family members read photos/);
  assert.match(schema, /family members upload photos/);
  assert.match(
    schema,
    /alter table public\.albums add column if not exists description/,
  );
  assert.match(schema, /bootstrap_family/);
  assert.doesNotMatch(schema, /service-role/i);
});

test("avatar uploads use the family id as the first storage folder", () => {
  assert.match(
    app,
    /\.from\(["']profiles["']\)[\s\S]*?\.select\(["']family_id["']\)/,
  );
  assert.match(app, /`\$\{profileFamilyId\}\/\$\{userId\}\/avatar-/);
});

test("discussion cards and article authors render stored avatars", () => {
  assert.match(app, /select\(["']id,display_name,avatar_url["']\)/);
  assert.match(app, /src=\{thread\.avatarUrl\}/);
  assert.match(app, /src=\{post\.authorAvatarUrl\}/);
  assert.match(app, /src=\{currentAvatarUrl\}/);
  assert.match(app, /src=\{item\.avatarUrl\}/);
});

test("the interface uses Cubic 11 as its primary font", () => {
  assert.match(css, /font-family:\s*["']俐方體11號["']/);
});

test("albums support detail browsing and photo metadata", () => {
  assert.match(schema, /create table if not exists public\.photos/);
  assert.match(app, /新增照片/);
  assert.match(app, /地點/);
  assert.match(app, /相片描述/);
  assert.match(
    app,
    /\.from\(["']family-photos["']\)[\s\S]*?\.upload\(path, file/,
  );
  assert.match(app, /const saveEditor = async/);
  assert.match(app, /const deleteAlbum = async/);
  assert.match(app, /const deletePhoto = async/);
});

test("all interface icons use Flaticon UIcons regular rounded", () => {
  assert.match(app, /@flaticon\/flaticon-uicons\/css\/regular\/rounded\.css/);
  assert.match(app, /fi fi-rr-/);
  assert.doesNotMatch(app, /lucide-react/);
  assert.doesNotMatch(app, /[＋←→↗⌄≡×📍📝]/);
});

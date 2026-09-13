import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')

test('schema covers every family-owned table and enables RLS', () => {
  for (const table of ['families', 'profiles', 'threads', 'posts', 'itineraries', 'itinerary_items', 'albums', 'photos']) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`))
  }
})

test('policies derive access from the authenticated family scope', () => {
  assert.match(schema, /my_family_id\(\)/)
  assert.match(schema, /family members read photos/)
  assert.match(schema, /family members upload photos/)
  assert.match(schema, /bootstrap_family/)
  assert.doesNotMatch(schema, /service-role/i)
})

test('avatar uploads use the family id as the first storage folder', () => {
  assert.match(app, /const profile = await supabase\.from\('profiles'\)\.select\('family_id'\)/)
  assert.match(app, /`\$\{profileFamilyId\}\/\$\{userId\}\/avatar-/)
})

test('discussion cards and article authors render stored avatars', () => {
  assert.match(app, /select\('id,display_name,avatar_url'\)/)
  assert.match(app, /<Avatar src=\{thread\.avatarUrl\}/)
  assert.match(app, /<Avatar src=\{post\.authorAvatarUrl\}/)
  assert.match(app, /<Avatar src=\{currentAvatarUrl\} fallback=\{\(sessionName \|\| '你'\)\[0\]\}/)
  assert.match(app, /<Avatar src=\{item\.avatarUrl\} fallback=\{item\.author\[0\]\}/)
})

test('the interface uses Cubic 11 as its primary font', () => {
  assert.match(css, /font-family:\s*"俐方體11號"/)
})

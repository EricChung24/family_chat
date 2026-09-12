export type Profile = { id: string; family_id: string; display_name: string; avatar_url: string | null; role: 'member' | 'admin' }
export type Family = { id: string; name: string; invite_code: string }
export type ThreadRecord = { id: string; family_id: string; title: string; created_by: string; created_at: string; pinned: boolean }
export type PostRecord = { id: string; thread_id: string; author_id: string; content: string; image_url: string | null; created_at: string }
export type Itinerary = { id: string; family_id: string; title: string; start_date: string; end_date: string; created_by: string }
export type ItineraryItem = { id: string; itinerary_id: string; day_index: number; start_time: string | null; title: string; note: string | null; location: string | null; order_index: number }
export type Album = { id: string; family_id: string; title: string }
export type Photo = { id: string; album_id: string; storage_path: string; uploaded_by: string; caption: string | null; created_at: string }

export const previewProfile: Profile = { id: 'preview-user', family_id: 'preview-family', display_name: 'Maya Chen', avatar_url: null, role: 'admin' }
export const previewFamily: Family = { id: 'preview-family', name: 'Kinfolk', invite_code: 'PREVIEW' }

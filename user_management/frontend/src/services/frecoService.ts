import axios from 'axios'

// Freco face recognition service base URL
const FRECO_BASE = import.meta.env.VITE_FRECO_URL || 'http://localhost:8000'

const freco = axios.create({ baseURL: FRECO_BASE })

export interface EmbeddingResult {
  embeddings: Record<string, number[]>
  models: Record<string, string>
  latency_ms: number
  step_latencies_ms: Record<string, number>
}

export interface MatchResult {
  matched: boolean
  similarity_score: number
  best_match_variant: string | null
  best_match_index: number | null
  candidate_count: number
  liveness_score: number | null
  models: Record<string, string>
  latency_ms: number
  reason: string | null
  message: string
}

export interface FaceBboxResult {
  bbox: [number, number, number, number]
  detection_score: number
  matched: boolean
  similarity_score: number
  best_match_variant: string | null
  best_match_index: number | null
  liveness_score: number | null
  reason: string
}

export interface MassMatchResult {
  faces_detected: number
  candidate_count: number
  faces: FaceBboxResult[]
  models: Record<string, string>
  latency_ms: number
  step_latencies_ms: Record<string, number>
}

export interface PersonRegisterResult {
  id: string
  external_id: string
  face_embeddings_created: number
}

/**
 * Extract ArcFace embeddings from a single image.
 * Calls Freco POST /get_image
 */
export async function extractEmbeddings(image: File): Promise<EmbeddingResult> {
  const form = new FormData()
  form.append('image', image)
  const { data } = await freco.post<EmbeddingResult>('/get_image', form)
  return data
}

/**
 * Single face verification — match image against stored embeddings.
 * Calls Freco POST /match
 */
export async function matchFace(
  image: File,
  candidateEmbeddings: object,
): Promise<MatchResult> {
  const form = new FormData()
  form.append('image', image)
  form.append('candidate_embeddings', JSON.stringify(candidateEmbeddings))
  const { data } = await freco.post<MatchResult>('/match', form)
  return data
}

/**
 * Group/mass recognition — detect and match all faces in a photo.
 * Calls Freco POST /mass_match/all
 */
export async function massMatch(
  image: File,
  candidateEmbeddings: object,
): Promise<MassMatchResult> {
  const form = new FormData()
  form.append('image', image)
  form.append('candidate_embeddings', JSON.stringify(candidateEmbeddings))
  const { data } = await freco.post<MassMatchResult>('/mass_match/all', form)
  return data
}

/**
 * Register a person with 1–10 face images and their pose names.
 * Calls Freco POST /api/v1/people
 */
export async function registerPerson(opts: {
  externalId: string
  name: string
  personType: string
  email?: string
  rfidUid?: string
  images: File[]
  poses: string[]
}): Promise<PersonRegisterResult> {
  const form = new FormData()
  form.append('external_id', opts.externalId)
  form.append('name', opts.name)
  form.append('person_type', opts.personType)
  if (opts.email) form.append('email', opts.email)
  if (opts.rfidUid) form.append('rfid_uid', opts.rfidUid)
  form.append('poses', opts.poses.join(','))
  for (const img of opts.images) {
    form.append('images', img)
  }
  const { data } = await freco.post<PersonRegisterResult>('/api/v1/people', form)
  return data
}

export default { extractEmbeddings, matchFace, massMatch, registerPerson }

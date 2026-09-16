import axios from 'axios'

// Freco face recognition service base URL
const FRECO_BASE = import.meta.env.VITE_FRECO_URL || 'http://localhost:8000'

const freco = axios.create({ baseURL: FRECO_BASE })

export async function recognizeFace(image) {
  const form = new FormData()
  form.append('image', image)
  const { data } = await freco.post('/api/v1/recognize', form)
  return data
}

export async function recognizeFaces(image) {
  const form = new FormData()
  form.append('image', image)
  const { data } = await freco.post('/api/v1/recognize/mass', form)
  return data
}

/**
 * Extract ArcFace embeddings from a single image.
 * Calls Freco POST /get_image
 */
export async function extractEmbeddings(image) {
  const form = new FormData()
  form.append('image', image)
  const { data } = await freco.post('/get_image', form)
  return data
}

/**
 * Single face verification — match image against stored embeddings.
 * Calls Freco POST /match
 */
export async function matchFace(image, candidateEmbeddings) {
  const form = new FormData()
  form.append('image', image)
  form.append('candidate_embeddings', JSON.stringify(candidateEmbeddings))
  const { data } = await freco.post('/match', form)
  return data
}

/**
 * Group/mass recognition — detect and match all faces in a photo.
 * Calls Freco POST /mass_match/all
 */
export async function massMatch(image, candidateEmbeddings) {
  const form = new FormData()
  form.append('image', image)
  form.append('candidate_embeddings', JSON.stringify(candidateEmbeddings))
  const { data } = await freco.post('/mass_match/all', form)
  return data
}

/**
 * Register a person with 1–10 face images and their pose names.
 * Calls Freco POST /api/v1/people
 */
export async function registerPerson(opts) {
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
  const { data } = await freco.post('/api/v1/people', form)
  return data
}

export default { extractEmbeddings, matchFace, massMatch, registerPerson, recognizeFace, recognizeFaces }

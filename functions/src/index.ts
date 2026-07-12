import './instrumentation.js'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import { FieldValue } from 'firebase-admin/firestore'
import { GoogleGenAI, Type } from '@google/genai'
import { traceAIRequest } from './aiTracing.js'
import { db } from './firebase.js'

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

// "-latest" alias always resolves to Google's newest stable Flash-Lite model.
// (Plain gemini-flash-latest was persistently 503 "high demand" — Lite has
// far more headroom and is plenty for classification + grounded Q&A.)
const CHAT_MODEL = 'gemini-flash-lite-latest'
// Google's current best embedding model. If you ever change this you must
// re-embed every note — query and note vectors must come from the same model.
const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIM = 768

// Same region as the Firestore database — avoids cross-region hops.
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 })

function genAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() })
}

// Gemini intermittently returns 503 "high demand" / 429; these clear in seconds.
function isTransientAIError(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status
  return status === 429 || status === 500 || status === 503
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (!isTransientAIError(e) || i === attempts - 1) break
      const delay = 1000 * 2 ** i + Math.random() * 250
      logger.warn(`Transient AI error, retrying in ${Math.round(delay)}ms`, e)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

// For callable functions: surface exhausted-retry overload as a typed error the
// client can distinguish from a real network failure.
async function aiCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (isTransientAIError(e)) {
      throw new HttpsError('unavailable', 'The AI model is busy right now. Try again in a moment.')
    }
    throw e
  }
}

async function embed(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY') {
  const res = await withRetry(() =>
    traceAIRequest('embed-note', 'EMBEDDING', EMBEDDING_MODEL, () =>
      genAI().models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: { taskType, outputDimensionality: EMBEDDING_DIM },
      }),
    ),
  )
  const values = res.embeddings?.[0]?.values
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error('Embedding failed or returned unexpected dimension')
  }
  return values
}

function categorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general'
}

async function adjustCategoryCount(uid: string, name: string | null, delta: number) {
  if (!name) return
  const ref = db.doc(`users/${uid}/categories/${categorySlug(name)}`)
  if (delta > 0) {
    await ref.set(
      { name, noteCount: FieldValue.increment(delta), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  } else {
    await ref.set({ noteCount: FieldValue.increment(delta) }, { merge: true }).catch(() => {})
  }
}

/**
 * Fires on every note write. New/edited notes are saved by the client with
 * status "pending"; this function classifies, tags and embeds them, then
 * marks them "processed" (which re-triggers and immediately no-ops).
 */
export const processNote = onDocumentWritten(
  { document: 'users/{uid}/notes/{noteId}', secrets: [GEMINI_API_KEY] },
  async (event) => {
    const uid = event.params.uid
    const before = event.data?.before
    const after = event.data?.after

    // Deletion: keep category counts accurate.
    if (before?.exists && !after?.exists) {
      await adjustCategoryCount(uid, (before.data()?.category as string | null) ?? null, -1)
      return
    }
    if (!after?.exists) return

    const note = after.data()!
    if (note.status !== 'pending') return
    const text = String(note.text ?? '').trim()
    if (!text) return

    // Feed existing categories into the prompt — the key trick that prevents
    // "Fuel", "Petrol" and "Gas Cards" sprawling into separate categories.
    const catSnap = await db.collection(`users/${uid}/categories`).get()
    const existing = catSnap.docs
      .map((d) => d.data())
      .filter((c) => (c.noteCount ?? 0) > 0)
      .map((c) => c.name as string)

    const classification = await withRetry(() =>
      traceAIRequest('classify-note', 'LLM', CHAT_MODEL, () =>
        genAI().models.generateContent({
          model: CHAT_MODEL,
          contents: `Classify this personal note.

Existing categories: ${existing.length ? JSON.stringify(existing) : '(none yet)'}

Rules:
- STRONGLY prefer an existing category. Create a new one only if the note is clearly about something none of them cover.
- Category names are short and title-cased, optionally hierarchical like "Finance / Credit Cards".
- Also produce 2-4 short lowercase tags (single words or hyphenated).

Note: """${text}"""`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                isNewCategory: { type: Type.BOOLEAN },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['category', 'isNewCategory', 'tags'],
            },
          },
        }),
      ),
    )

    let category = 'General'
    let tags: string[] = []
    try {
      const parsed = JSON.parse(classification.text ?? '{}')
      if (typeof parsed.category === 'string' && parsed.category.trim()) {
        category = parsed.category.trim()
      }
      if (Array.isArray(parsed.tags)) {
        tags = parsed.tags.filter((t: unknown) => typeof t === 'string').slice(0, 4)
      }
    } catch (e) {
      logger.warn('Failed to parse classification JSON', e)
    }

    const vector = await embed(text, 'RETRIEVAL_DOCUMENT')

    const previousCategory = before?.exists
      ? ((before.data()?.category as string | null) ?? null)
      : null

    await after.ref.update({
      category,
      tags,
      embedding: FieldValue.vector(vector),
      embeddingModel: EMBEDDING_MODEL,
      status: 'processed',
      processedAt: FieldValue.serverTimestamp(),
    })

    if (previousCategory !== category) {
      await adjustCategoryCount(uid, previousCategory, -1)
      await adjustCategoryCount(uid, category, 1)
    }

    logger.info(`Processed note ${event.params.noteId}`, { category, tags })
  },
)

interface Source {
  id: string
  text: string
  createdAt: number
  category: string | null
  tags: string[]
}

/**
 * RAG chat: embed the question, vector-search the user's notes with
 * Firestore findNearest, answer ONLY from those notes with citations.
 */
export const askNotes = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request): Promise<{ answer: string; sources: Source[] }> => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to ask your notes.')

    const question = String(request.data?.question ?? '').trim().slice(0, 2000)
    if (!question) throw new HttpsError('invalid-argument', 'Question is required.')

    // Optional conversation history for multi-turn context.
    const history = Array.isArray(request.data?.history)
      ? (request.data.history as { role: string; text: string }[]).slice(-8)
      : []

    const queryVector = await aiCall(() => embed(question, 'RETRIEVAL_QUERY'))

    const snap = await db
      .collection(`users/${uid}/notes`)
      .findNearest({
        vectorField: 'embedding',
        queryVector: FieldValue.vector(queryVector),
        limit: 6,
        distanceMeasure: 'COSINE',
      })
      .get()

    const sources: Source[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        text: String(data.text ?? ''),
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        category: (data.category as string | null) ?? null,
        tags: (data.tags as string[]) ?? [],
      }
    })

    if (sources.length === 0) {
      return {
        answer: "I couldn't find a note about this. Try writing one first!",
        sources: [],
      }
    }

    const context = sources
      .map(
        (s, i) =>
          `[${i + 1}] (${new Date(s.createdAt).toISOString().slice(0, 10)}${
            s.category ? `, ${s.category}` : ''
          }) ${s.text}`,
      )
      .join('\n')

    const historyBlock = history.length
      ? '\n\nPrevious conversation:\n' +
        history.map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')
      : ''

    const completion = await aiCall(() =>
      withRetry(() =>
        traceAIRequest('answer-notes-question', 'LLM', CHAT_MODEL, () =>
          genAI().models.generateContent({
            model: CHAT_MODEL,
            contents: `Notes:\n${context}${historyBlock}\n\nQuestion: ${question}`,
            config: {
              systemInstruction: `You answer questions using ONLY the user's own notes provided below.
Rules:
- Answer concisely in plain text (no markdown formatting).
- Cite the notes you used inline like [1] or [2].
- Never invent information. If the notes don't contain the answer, reply exactly: "I couldn't find a note about this."
- A confidently wrong answer is worse than no answer.
- If previous conversation context is provided, use it to understand follow-up questions and give more relevant answers.`,
              temperature: 0.2,
            },
          }),
        ),
      ),
    )

    const rawAnswer = completion.text?.trim() || "I couldn't find a note about this."

    // Vector search returns the N nearest notes even when they're irrelevant.
    // The model only cites the notes it actually used, so keep just those,
    // renumbering citations to stay consecutive ([1], [2], ...).
    const citedOrder: number[] = []
    for (const match of rawAnswer.matchAll(/\[(\d+)\]/g)) {
      const idx = Number(match[1]) - 1
      if (idx >= 0 && idx < sources.length && !citedOrder.includes(idx)) citedOrder.push(idx)
    }

    if (citedOrder.length === 0) {
      // No citations: either "couldn't find" or a rule-breaking answer — in the
      // latter case keep all sources rather than hide what it drew from.
      const noAnswer = rawAnswer.includes("couldn't find a note")
      return { answer: rawAnswer, sources: noAnswer ? [] : sources }
    }

    const answer = rawAnswer.replace(/\[(\d+)\]/g, (full, n: string) => {
      const pos = citedOrder.indexOf(Number(n) - 1)
      return pos === -1 ? full : `[${pos + 1}]`
    })

    return { answer, sources: citedOrder.map((i) => sources[i]) }
  },
)

/**
 * Voice-input fallback for browsers without the Web Speech API (notably iOS
 * Safari/PWA). The client records a short audio clip and sends it here; Gemini
 * transcribes it verbatim, auto-detecting the spoken language.
 */
export const transcribeAudio = onCall(
  { secrets: [GEMINI_API_KEY] },
  async (request): Promise<{ text: string }> => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use voice input.')

    const audioBase64 = String(request.data?.audioBase64 ?? '')
    const mimeType = String(request.data?.mimeType ?? '')
    if (!audioBase64 || !mimeType) {
      throw new HttpsError('invalid-argument', 'Audio is required.')
    }

    const completion = await aiCall(() =>
      withRetry(() =>
        traceAIRequest('transcribe-audio', 'LLM', CHAT_MODEL, () =>
          genAI().models.generateContent({
            model: CHAT_MODEL,
            contents: [
              { inlineData: { mimeType, data: audioBase64 } },
              {
                text: 'Transcribe this audio verbatim. Detect the spoken language automatically. Return only the transcript text, with no commentary, labels or quotation marks. If there is no discernible speech, return an empty string.',
              },
            ],
            config: { temperature: 0 },
          }),
        ),
      ),
    )

    return { text: completion.text?.trim() ?? '' }
  },
)

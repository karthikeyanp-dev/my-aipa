import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { ChatMessage, Conversation } from '../lib/types'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface ConversationMeta {
  id: string
  title: string
  updatedAt: Date
}

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const activeIdRef = useRef<string | null>(null)

  // Real-time list of conversation metadata (no messages) for the last 30 days.
  useEffect(() => {
    if (!user) return
    setLoading(true)
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)
    const q = query(
      collection(db, 'users', user.uid, 'conversations'),
      where('updatedAt', '>=', cutoff),
      orderBy('updatedAt', 'desc'),
      limit(50),
    )
    return onSnapshot(q, (snap) => {
      setConversations(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          return {
            id: d.id,
            title: (data.title as string) ?? 'New chat',
            updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
          }
        }),
      )
      setLoading(false)
    })
  }, [user])

  const loadConversation = useCallback(
    async (id: string) => {
      if (!user) return
      const ref = doc(db, 'users', user.uid, 'conversations', id)
      const snap = await getDoc(ref)
      if (!snap.exists()) return
      const data = snap.data()
      activeIdRef.current = id
      setActiveConversation({
        id,
        title: (data.title as string) ?? 'New chat',
        messages: (data.messages as ChatMessage[]) ?? [],
        createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
      })
    },
    [user],
  )

  const createConversation = useCallback(
    async (title: string): Promise<string> => {
      if (!user) throw new Error('Not authenticated')
      const ref = doc(collection(db, 'users', user.uid, 'conversations'))
      const now = serverTimestamp()
      await setDoc(ref, {
        title: title.slice(0, 50),
        messages: [],
        createdAt: now,
        updatedAt: now,
      })
      activeIdRef.current = ref.id
      setActiveConversation({
        id: ref.id,
        title: title.slice(0, 50),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      return ref.id
    },
    [user],
  )

  const appendMessage = useCallback(
    async (convId: string, message: ChatMessage) => {
      if (!user) return
      const ref = doc(db, 'users', user.uid, 'conversations', convId)
      await updateDoc(ref, {
        messages: arrayUnion(message),
        updatedAt: serverTimestamp(),
      })
      // Optimistically update local state
      setActiveConversation((prev) =>
        prev && prev.id === convId
          ? { ...prev, messages: [...prev.messages, message], updatedAt: new Date() }
          : prev,
      )
    },
    [user],
  )

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!user) return
      await deleteDoc(doc(db, 'users', user.uid, 'conversations', id))
      if (activeIdRef.current === id) {
        activeIdRef.current = null
        setActiveConversation(null)
      }
    },
    [user],
  )

  return {
    conversations,
    activeConversation,
    loading,
    loadConversation,
    createConversation,
    appendMessage,
    deleteConversation,
    setActiveConversation,
    activeIdRef,
  }
}

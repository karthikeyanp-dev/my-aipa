import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { Note } from '../lib/types'

export function useNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'users', user.uid, 'notes'),
      orderBy('createdAt', 'desc'),
      limit(500),
    )
    return onSnapshot(q, { includeMetadataChanges: false }, (snap) => {
      setNotes(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' })
          return {
            id: d.id,
            text: (data.text as string) ?? '',
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            category: (data.category as string | null) ?? null,
            tags: (data.tags as string[]) ?? [],
            status: (data.status as Note['status']) ?? 'pending',
          }
        }),
      )
      setLoading(false)
    })
  }, [user])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) {
      if (n.category) counts.set(n.category, (counts.get(n.category) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [notes])

  return { notes, categories, loading }
}

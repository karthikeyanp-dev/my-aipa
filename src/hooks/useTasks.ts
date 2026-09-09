import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import type { Task } from '../lib/types'

export function useTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    const taskQuery = query(
      collection(db, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(taskQuery, (snap) => {
      setTasks(
        snap.docs.map((task) => {
          const data = task.data({ serverTimestamps: 'estimate' })
          return {
            id: task.id,
            title: (data.title as string) ?? '',
            completed: Boolean(data.completed),
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            dueAt: (data.dueAt as Timestamp | undefined)?.toDate() ?? null,
          }
        }),
      )
      setLoading(false)
    })
  }, [user])

  const addTask = useCallback(
    async (title: string, dueAt?: Date | null) => {
      if (!user || !title.trim()) return
      const payload: { title: string; completed: boolean; createdAt: ReturnType<typeof serverTimestamp>; dueAt?: Date } = {
        title: title.trim().slice(0, 200),
        completed: false,
        createdAt: serverTimestamp(),
      }
      if (dueAt) payload.dueAt = dueAt
      await addDoc(collection(db, 'users', user.uid, 'tasks'), payload)
    },
    [user],
  )

  const toggleTask = useCallback(
    async (task: Task) => {
      if (!user) return
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        completed: !task.completed,
      })
    },
    [user],
  )

  const updateTask = useCallback(
    async (task: Task, title: string, dueAt?: Date | null) => {
      if (!user || !title.trim()) return
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        title: title.trim().slice(0, 200),
        dueAt: dueAt ?? deleteField(),
      })
    },
    [user],
  )

  const removeTask = useCallback(
    async (id: string) => {
      if (!user) return
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', id))
    },
    [user],
  )

  const openTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks])
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks])

  return { tasks, openTasks, completedTasks, loading, addTask, toggleTask, updateTask, removeTask }
}

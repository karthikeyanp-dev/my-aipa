import { useCallback, useEffect, useRef, useState } from 'react'
import {
  blobToBase64,
  getDictationLang,
  pickRecorderMimeType,
  transcribeAudio,
} from '../lib/speech'

export type SpeechMode = 'webspeech' | 'cloud'

interface UseSpeechInputOptions {
  // Called with finalized transcript chunks (Web Speech may fire several times;
  // the cloud fallback fires once when transcription returns).
  onFinal: (text: string) => void
  // Called with live interim words while the user is still speaking (Web Speech
  // only; the cloud path has no interim results).
  onPartial?: (text: string) => void
}

interface UseSpeechInput {
  mode: SpeechMode
  listening: boolean
  // True while the cloud fallback is uploading/transcribing after recording.
  transcribing: boolean
  partial: string
  error: string | null
  start: () => void
  stop: () => void
}

const MAX_CLOUD_CLIP_MS = 45_000

function getRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

function friendlyError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in your browser settings.'
    case 'no-speech':
      return "Didn't catch that — try again."
    case 'network':
      return 'Voice input needs a connection.'
    case 'audio-capture':
      return 'No microphone found.'
    default:
      return "Voice input didn't work. Try again."
  }
}

export function useSpeechInput({ onFinal, onPartial }: UseSpeechInputOptions): UseSpeechInput {
  const mode: SpeechMode = getRecognitionCtor() ? 'webspeech' : 'cloud'

  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Keep callbacks in refs so engine event handlers never go stale.
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal
  const onPartialRef = useRef(onPartial)
  onPartialRef.current = onPartial

  // Web Speech engine instance.
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  // Cloud fallback state.
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Stop recording. Releasing the mic happens in `onstop` so the final audio
  // chunk isn't dropped.
  const stopCloud = useCallback(() => {
    if (clipTimerRef.current) {
      clearTimeout(clipTimerRef.current)
      clipTimerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    } else {
      releaseMic()
    }
  }, [releaseMic])

  const startWebSpeech = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.lang = getDictationLang()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    // Some engines (notably Android Chrome / mobile) re-report already-finalized
    // text. They may return one growing cumulative transcript for the current
    // utterance ("hello" then later "hello world" in a later result) or multiple
    // final results where later ones contain prior words. We track the best
    // (longest) final transcript seen, compute the delta against what we have
    // already emitted to callers, and only emit new text. This prevents the
    // "after each word it pastes the whole sentence again" duplication.
    let finalSoFar = ''

    recognition.onresult = (event) => {
      let interim = ''
      let bestFinal = ''

      // The longest final transcript in the results is typically the engine's
      // most complete cumulative view. We do not += every result because later
      // final entries often restate earlier text.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript?.trim() ?? ''
        if (!transcript) continue

        if (result.isFinal) {
          if (transcript.length > bestFinal.length) {
            bestFinal = transcript
          }
        } else {
          // Only the latest interim matters.
          interim = transcript
        }
      }

      if (bestFinal) {
        if (bestFinal.startsWith(finalSoFar)) {
          const delta = bestFinal.slice(finalSoFar.length).trim()
          if (delta) {
            finalSoFar = bestFinal
            onFinalRef.current(delta)
          }
        } else {
          // New utterance / correction / long pause: the transcript does not
          // continue our prior final text. Emit the new chunk (so we don't
          // silently drop speech) and resync.
          const lower = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')
          if (!finalSoFar || !lower(bestFinal).includes(lower(finalSoFar))) {
            finalSoFar = bestFinal
            onFinalRef.current(bestFinal)
          } else {
            finalSoFar = bestFinal
          }
        }
      }

      setPartial(interim)
      onPartialRef.current?.(interim)
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      setError(friendlyError(event.error))
    }
    recognition.onend = () => {
      setListening(false)
      setPartial('')
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setError(null)
    setPartial('')
    setListening(true)
    recognition.start()
  }, [])

  const startCloud = useCallback(async () => {
    try {
      const mimeType = pickRecorderMimeType()
      if (!mimeType) {
        setError('Voice input is not supported on this browser.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        setListening(false)
        releaseMic()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        if (blob.size === 0) return
        try {
          setTranscribing(true)
          const audioBase64 = await blobToBase64(blob)
          const res = await transcribeAudio({ audioBase64, mimeType })
          const text = res.data.text?.trim()
          if (text) onFinalRef.current(text)
        } catch {
          setError('Voice input needs a connection.')
        } finally {
          setTranscribing(false)
        }
      }

      recorderRef.current = recorder
      setError(null)
      setListening(true)
      recorder.start()
      clipTimerRef.current = setTimeout(stopCloud, MAX_CLOUD_CLIP_MS)
    } catch {
      setError('Microphone access is blocked. Allow it in your browser settings.')
      setListening(false)
    }
  }, [stopCloud, releaseMic])

  const start = useCallback(() => {
    if (listening) return
    if (mode === 'webspeech') startWebSpeech()
    else void startCloud()
  }, [listening, mode, startWebSpeech, startCloud])

  const stop = useCallback(() => {
    if (mode === 'webspeech') recognitionRef.current?.stop()
    else stopCloud()
  }, [mode, stopCloud])

  // Clean up engines if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      stopCloud()
    }
  }, [stopCloud])

  return { mode, listening, transcribing, partial, error, start, stop }
}

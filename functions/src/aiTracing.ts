import { SpanStatusCode, trace, type Span } from '@opentelemetry/api'

const tracer = trace.getTracer('my-aipa-ai')

type SpanKind = 'LLM' | 'EMBEDDING'

interface UsageMetadata {
  promptTokenCount?: number
  candidatesTokenCount?: number
  totalTokenCount?: number
}

function recordUsage(span: Span, response: unknown): void {
  const usage = (response as { usageMetadata?: UsageMetadata }).usageMetadata
  if (usage?.promptTokenCount !== undefined) {
    span.setAttribute('llm.token_count.prompt', usage.promptTokenCount)
  }
  if (usage?.candidatesTokenCount !== undefined) {
    span.setAttribute('llm.token_count.completion', usage.candidatesTokenCount)
  }
  if (usage?.totalTokenCount !== undefined) {
    span.setAttribute('llm.token_count.total', usage.totalTokenCount)
  }
}

export async function traceAIRequest<T>(
  name: string,
  kind: SpanKind,
  model: string,
  request: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    {
      attributes: {
        'openinference.span.kind': kind,
        'llm.provider': 'google',
        'llm.model_name': model,
      },
    },
    async (span) => {
      try {
        const response = await request()
        recordUsage(span, response)
        span.setStatus({ code: SpanStatusCode.OK })
        return response
      } catch (error) {
        if (error instanceof Error) span.recordException(error)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown AI error',
        })
        throw error
      } finally {
        span.end()
      }
    },
  )
}

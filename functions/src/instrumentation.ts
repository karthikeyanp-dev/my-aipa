import './firebase.js'
import { createFirebaseSpanExporter } from '@agentpond/firebase'
import { NodeSDK } from '@opentelemetry/sdk-node'

const telemetry = new NodeSDK({
  traceExporter: createFirebaseSpanExporter(),
})

telemetry.start()

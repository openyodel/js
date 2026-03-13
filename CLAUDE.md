# @openyodel/sdk — TypeScript SDK

## Build & Test

```bash
npm run build        # tsc → dist/
npm run typecheck    # tsc --noEmit
npm test             # tsc + node --test
```

## Architektur

Schichten (SDK Design Guide §3):

```
src/
  client/     YodelClient (core) + YodelStream (SSE parser)
  session/    YodelSession — Conversation History
  discovery/  DiscoveryClient + Known Hosts
  stt/        STTProvider Interface + WebSpeechSTTAdapter
  tts/        TTSPlayer Interface + TTSPlayer
  types/      Alle Yodel-Types (config, protocol, errors, discovery)
```

## Konventionen

- **ESM only** (`"type": "module"`, `.js`-Extensions in Imports)
- **Keine Runtime-Dependencies** — nur TypeScript als devDependency
- **Explicit named exports** in `src/index.ts` — kein `export *`
- **Internal types** (`RawChatCompletionChunk`, `RawYodelEvent`) werden NICHT exportiert
- Types und Klassen folgen der **SDK Design Guide §5 Naming Convention** exakt
- Tests nutzen Node.js built-in `node:test` — kein Jest/Vitest

## Spec-Referenz

Die Protokoll-Spec liegt im Schwester-Repo: `../openyodel-spec/v1/spec.md`
Der SDK Design Guide: `../openyodel-github/sdk-designg-guide.md`

## Spec-Sync Check

Vor Änderungen an Types in `src/types/` immer prüfen, ob die Werte mit der
Spec (`../openyodel-spec/v1/openapi.yaml`) übereinstimmen. Drift-anfällige Felder:

- `DeviceType` — `src/types/config.ts` ↔ Spec §6.4.3
- `DeviceCapability` — `src/types/config.ts` ↔ Spec §6.4.3
- `TTSFormat` — `src/types/config.ts` ↔ Spec §6.4.2
- `SessionMode` — `src/types/config.ts` ↔ Spec §8.1
- `InputSource` — `src/types/config.ts` ↔ Spec §6.2
- `ChatMessage.role` — `src/types/protocol.ts` ↔ Spec §6.3
- `finish_reason` — `src/types/protocol.ts` ↔ Spec §7.1.1
- `YodelErrorType` — `src/types/errors.ts` ↔ Spec §9

Wenn in der Spec ein neues Enum oder eine neue feste Wertemenge hinzukommt,
diese Liste entsprechend erweitern.

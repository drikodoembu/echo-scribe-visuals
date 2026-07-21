# Catolicoteca Auto Creator — Plano Técnico Revisado

Incorpora ao plano anterior os 6 módulos avançados. Ainda sem código.

## 1. Alterações de arquitetura vs plano anterior

- **Montagem sai do servidor** e passa a rodar **100% no navegador via FFmpeg.wasm** (Web Worker + SharedArrayBuffer). O servidor apenas fornece assets via signed URLs e recebe o MP4 final para upload no Storage.
- **YouTube** deixa de ser "opcional fase 2" e vira core: OAuth por usuário (Google), refresh token cifrado no servidor.
- **Música** muda para curadoria manual da YouTube Audio Library (ver risco no item 10) + upload próprio como fallback.
- **Agendamento** vira um worker de cron chamando `/api/public/cron/tick` a cada X minutos.
- **Thumbnail** gerada no cliente via Canvas (imagem de fundo + título em fonte católica), enviada ao YouTube junto do upload.

```text
Browser
 ├─ UI módulos (Roteiro, Áudio, Imagem, Música, Montagem, Thumb, Publicação, Analytics, Agenda)
 ├─ FFmpeg.wasm Worker  ─── monta MP4 (9:16 / 16:9) ─┐
 └─ Canvas Thumb Generator ──────────────────────────┤
                                                     ▼
Server (TanStack)                             Supabase Storage (privado)
 ├─ createServerFn + /api/*                          │
 ├─ Streaming LLM/imagem                             │
 ├─ TTS (ElevenLabs)                                 │
 ├─ YouTube: OAuth, upload resumable, agendamento    │
 ├─ Analytics (YouTube Analytics API)                │
 └─ Cron ticker (/api/public/cron/tick)              │
                                                     ▼
                                        Postgres (RLS) + Realtime
```

## 2. Requisitos técnicos do FFmpeg.wasm

Requer **cross-origin isolation** — headers em toda resposta HTML:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Impactos: qualquer `<img>`/`<iframe>` externo precisa CORP; assets do Supabase Storage entregues via signed URL com `?download` e header `Cross-Origin-Resource-Policy: cross-origin` (ou proxy same-origin `/api/asset/$id`).

Binários `ffmpeg-core.wasm/.js` servidos de `/public/ffmpeg/` (não importar de servidor/SSR — carregar após hidratação em `<ClientOnly>`).

Comando base (9:16):
```text
ffmpeg -loop 1 -i bg.png -i voice.mp3 -i music.mp3 \
  -filter_complex "[2:a]volume=0.15[m];[1:a][m]amix=inputs=2:duration=first[a]" \
  -map 0:v -map "[a]" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart out.mp4
```
Para 16:9 troca resolução para 1920x1080. Progresso via `ffmpeg.on('progress')` → estado React → barra + toast.

Limites: memória do worker ~2 GB, entradas típicas <200 MB. Vídeos >90 s ou imagens 4K devem ser reduzidos antes.

## 3. Rotas atualizadas

Privadas: `/app/montagem/$id` (workbench com preview MP4), `/app/thumbnails`, `/app/agenda`, `/app/publicacao`, `/app/analytics`, `/app/configuracoes/youtube`.

Server routes novos:
- `POST /api/youtube/oauth/start` — gera URL de consent Google
- `GET  /api/youtube/oauth/callback` — troca code → tokens, cifra, salva
- `POST /api/youtube/upload` — recebe MP4 do browser (multipart), inicia resumable upload
- `POST /api/youtube/thumbnail` — envia thumb JPG
- `POST /api/youtube/schedule` — atualiza `publications.scheduled_at`
- `GET  /api/youtube/analytics` — proxy para YouTube Analytics API
- `POST /api/public/cron/tick` — protegido por `CRON_SECRET`; processa fila de agendamento
- `GET  /api/asset/$id` — proxy same-origin de assets (retorna com COEP-friendly headers)

## 4. Schema (deltas sobre o plano anterior)

Novas colunas/tabelas:
- `videos`: `+ built_in_browser bool default true`, `+ size_bytes`, `+ mime`, `+ storage_path` (MP4 final).
- `thumbnails`(id, user_id, video_id, storage_path, prompt, font, created_at) + RLS own.
- `publications`: `+ thumbnail_id`, `+ privacy ('private'|'unlisted'|'public')`, `+ category_id`, `+ playlist_id nullable`.
- `youtube_channels`: `+ channel_title`, `+ thumbnail_url`, `+ subscribers_cached`.
- `schedule_rules`(id, user_id, cron_expr text, tz text, template jsonb, active bool, next_run_at timestamptz) — define "1 vídeo/dia às 8h".
- `schedule_runs`(id, rule_id, planned_for, publication_id nullable, status, error, created_at).
- `music_tracks`(id, user_id, source enum('audio_library','upload','ai'), title, style, storage_path, credit_required bool, external_url nullable).
- `youtube_metrics_daily`: `+ estimated_minutes_watched`, `+ average_view_duration`.

Índices adicionais: `schedule_rules(active, next_run_at)`, `publications(scheduled_at) WHERE status='scheduled'`, `videos(user_id, status, created_at desc)`.

## 5. RLS

- Tudo own por `auth.uid()`.
- `schedule_rules`/`schedule_runs`/`music_tracks`/`thumbnails`: SELECT/INSERT/UPDATE/DELETE own; service_role ALL.
- `youtube_channels`: SELECT own **via view** que omite `refresh_token_encrypted`; UPDATE/DELETE own; INSERT via server fn.
- Endpoints `/api/public/cron/tick` **não** confiam em RLS do usuário — usam `supabaseAdmin` após validar `CRON_SECRET`.

## 6. Fluxo OAuth YouTube (por usuário)

1. `/app/configuracoes/youtube` → botão "Conectar canal" → `POST /api/youtube/oauth/start` (server fn autenticado) gera URL Google com scopes: `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`, `youtube.force-ssl` (thumbnail). `state` = JWT curto assinado com `OAUTH_STATE_SECRET` contendo `user_id + nonce`.
2. Google → `/api/youtube/oauth/callback` → valida `state`, troca `code` por tokens, cifra `refresh_token` com AES-256-GCM (chave `YOUTUBE_TOKEN_ENC_KEY`), salva em `youtube_channels`.
3. Toda chamada YouTube: server fn obtém `access_token` fresco (refresh se expirado), nunca envia tokens ao browser.

Secrets a adicionar: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `YOUTUBE_TOKEN_ENC_KEY` (base64 32B, via `generate_secret`), `OAUTH_STATE_SECRET`, `CRON_SECRET`.

## 7. Fluxo de montagem (browser)

1. Usuário escolhe script + audio + image + music + formato.
2. Front pede signed URLs (`/api/asset/$id`) ou baixa via proxy same-origin.
3. Worker inicializa FFmpeg.wasm (cache do `.wasm` em `caches`).
4. Executa comando; emite progresso 0–100.
5. Blob MP4 → sobe para `videos/{user}/{id}.mp4` via **upload direto ao Supabase Storage** (SDK do browser, RLS por bucket).
6. Insere/atualiza `videos` (status=succeeded, storage_path).
7. UI mostra preview + botões "Gerar thumb" e "Publicar".

## 8. Fluxo de thumbnail

Canvas 1280×720: imagem de fundo (cover), overlay gradiente dourado→vinho, título em fonte católica (ex.: **Cormorant Garamond** ou **Cinzel**, carregada via `<link>` no `__root`). `canvas.toBlob('image/jpeg', 0.9)` → upload Storage → `thumbnails` row.

## 9. Fluxo de publicação + agendamento

- **Imediata**: `POST /api/youtube/upload` recebe multipart (MP4 do Storage por signed URL server-side, evita reupload do browser), faz resumable upload YouTube v3 (`part=snippet,status`), depois `thumbnails.set`.
- **Agendada**: cria `publications` com `status='scheduled'` e `scheduled_at`; usa `status.publishAt` do YouTube (privacidade `private` até a data) OU processa localmente via cron. Escolha: **usar `publishAt` do YouTube** (mais confiável) + fallback do cron para casos de falha.
- **Regras recorrentes**: `schedule_rules` avaliadas por `/api/public/cron/tick` (chamado a cada 5 min pelo cron externo do Lovable Cloud ou `pg_cron`); ao disparar, gera roteiro→áudio→imagem→música→montagem (server-side impossível para FFmpeg.wasm → **ver risco 10.a**) e publica.

## 10. Módulo Música — YouTube Audio Library

**Importante**: a YouTube Audio Library **não expõe API pública** para download programático. Estratégia realista:
- (a) **Curadoria manual**: administrador (o próprio usuário) faz upload das faixas que baixou da Audio Library; sistema cataloga em `music_tracks` com tags de estilo. Sugestão automática filtra por `style`.
- (b) Alternativa opcional: integrar **Freesound API** (CC0) ou **Pixabay Music** que possuem API real.
- (c) Manter geração via IA (Suno) como terceira opção.

O plano assume (a)+(c); (b) fica atrás de flag.

## 11. Analytics

Server fn diária (cron) chama `youtubeAnalytics.reports.query` com métricas `views,estimatedMinutesWatched,subscribersGained,estimatedRevenue,cpm` por dia; upsert em `youtube_metrics_daily`. Dashboard usa Recharts (line + area) + cards + meta "faltam X USD para saque" (threshold 100 USD - `sum(estimatedRevenue)`).

## 12. Design

Tokens em `src/styles.css` (oklch): `--gold`, `--wine`, `--parchment`, `--ink`, com dark mode (fundo vinho profundo, dourado como accent). Fontes: **Cinzel** (títulos) + **Cormorant Garamond** (corpo) carregadas via `<link>` no `__root.tsx`. Ícones Lucide (Cross, BookOpen, Music, Video, Calendar). Painel de progresso: `Progress` shadcn + status textual por etapa + toasts de conclusão/erro (Sonner).

## 13. Segurança e limites

- Autorização **sempre no servidor** (`requireSupabaseAuth` + checagens de propriedade); nada de gate só no front.
- Tokens Google **nunca** vão ao cliente; `refresh_token` cifrado (AES-GCM) com chave em secret.
- Cron endpoint público protegido por `CRON_SECRET` header + `timingSafeEqual`.
- Rate-limit por bucket (roteiro, imagem, tts, upload, publish) em `rate_limits`.
- COOP/COEP habilitados globalmente (impacto verificado em todos assets externos).
- Uploads ao Storage validam MIME e tamanho no server (edge fn de assinatura de URL) e via RLS policy no bucket.
- Logs em `app_logs` + `api_usage` para custo/erros.

## 14. Ordem de implementação recomendada

1. Design system (dourado/vinho/branco + Cinzel/Cormorant), AppShell, dark mode.
2. Auth (email + Google login do app) + gate `_authenticated`.
3. Schema base + RLS + triggers + user_roles.
4. Módulo Roteiros (streaming LLM).
5. Módulo Configurações + secrets (`GOOGLE_OAUTH_*`, `YOUTUBE_TOKEN_ENC_KEY`, `ELEVENLABS_API_KEY`, `LEONARDO_API_KEY`, `CRON_SECRET`, `WEBHOOK_SECRET`, `OAUTH_STATE_SECRET`).
6. Módulo Áudio (ElevenLabs) + Storage bucket `audio`.
7. Módulo Imagem (streaming) + Storage bucket `images`.
8. Módulo Música (upload manual + catálogo) + Storage bucket `music`.
9. **COOP/COEP + proxy `/api/asset/$id`** + Módulo Montagem FFmpeg.wasm + Storage bucket `videos`.
10. Módulo Thumbnail (Canvas).
11. OAuth YouTube por usuário + Módulo Publicação (imediata + `publishAt`).
12. Módulo Agenda (`schedule_rules` + cron `/api/public/cron/tick`).
13. Módulo Analytics (Analytics API + upsert diário + dashboard Recharts).
14. Admin (logs, uso, rate-limit, fila).
15. Hardening: security scan, testes E2E dos fluxos críticos, verificação de secrets.

## 15. Riscos técnicos e mitigações

- **FFmpeg.wasm exige COOP/COEP** → aplicar globalmente; usar proxy same-origin para todos assets externos; validar em preview antes de continuar.
- **Limite de memória do browser** (vídeos longos/imagens 4K) → limitar duração ≤ 90 s no MVP, redimensionar imagens no cliente antes do encode; oferecer 16:9 apenas para vídeos curtos inicialmente.
- **YouTube Audio Library sem API** → curadoria manual + opcional Freesound; NÃO prometer download automático da Audio Library.
- **Automação 100% (gerar+montar+publicar) por cron** → FFmpeg.wasm precisa de browser; o cron server-side não consegue montar. Mitigação: (i) MVP dispara notificação e monta quando o usuário abrir o app, OU (ii) fase 2 usa serviço server-side (Shotstack/Cloudinary) por trás de flag. Deixar claro no UX do agendamento.
- **Refresh token YouTube** cifrado (AES-GCM) + rotação de chave documentada; nunca logar tokens.
- **Cotas do YouTube Data API** (10k unidades/dia; upload = 1600) → rate-limit e fila; expor "restam N uploads hoje".
- **Publicação agendada divergente entre YouTube `publishAt` e cron local** → fonte de verdade = YouTube; cron só reenvia em `error`.
- **Custos IA** → `api_usage` + limites por dia em `user_settings`.
- **RLS/Storage buckets privados** → assinar URLs com TTL curto; verificar security scan.
- **CORS/COEP quebrando integrações** (Google Fonts, imagens externas) → self-host de fontes; proxy de imagens; testar antes de publicar.
- **Perda de MP4 grande na aba** → upload direto ao Storage assim que o encode termina; retomar via `videos.status='succeeded'`.

Pronto para aprovar? Ao confirmar, executo os passos 1–5 na próxima etapa.

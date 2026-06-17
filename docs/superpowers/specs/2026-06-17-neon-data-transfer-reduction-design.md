# Riduzione data transfer Neon — Design

**Data:** 2026-06-17
**Stato:** approvato per implementazione
**Obiettivo dichiarato:** ridurre i costi Neon *e* rendere l'architettura sostenibile alla crescita utenti, senza cambiare il comportamento visibile del sito.

## Problema

La dashboard Neon (piano Launch, ~€20/mese) mostra al 17 del mese:

| Metrica | Valore | Note |
|---|---|---|
| Network/data transfer | **197 GB** | driver del costo |
| Compute | 140,93 CU-hours | secondario, in crescita |
| Storage | 436 MB (+ history 3,48 GB) | trascurabile |

Il database è di **436 MB** ma sono stati trasferiti **197 GB**: gli stessi dati vengono riletti centinaia di volte. La causa è architetturale, non un bug. L'app usa il driver `neon-http` (`packages/db/src/index.ts`), dove **ogni query è una richiesta HTTP a Neon**, combinato con **polling periodico per ogni tab loggata**.

### Sorgenti del transfer (ranking)

| Sorgente | File | Frequenza | Cosa scarica da Neon | Peso |
|---|---|---|---|---|
| Inbox notifiche | `apps/web/src/components/notifications/notifications-inbox-provider.tsx` → `GET /api/notifications/` | 60s/tab | `SELECT *` 50 righe + payload JSON | 🔴 alto |
| Poll presenza online | `apps/web/src/components/realtime/patron-online-provider.tsx` → `resolveVisiblePresenceForViewer` | 20s/tab | `profile` (con `preferences` JSON) + `follow` | 🟠 medio-alto |
| Presenza listing | `apps/web/src/hooks/use-listing-presence.ts` → `getListingPresenceSnapshot` / `fetchViewingPatronsInRoom` | 20s/tab (su pagine titolo) | `follow` + `profile`+`user` join | 🟠 medio |
| Badge watcher | `apps/web/src/components/gamification/badge-watcher.tsx` → `/api/badges` | 60s/tab | query userBadge+badge | 🟡 medio |
| Patron activity | `apps/web/src/hooks/use-patron-activity-tracker.tsx` | 30s/tab | ricomputo | 🟡 basso-medio |

### Cosa è già a posto (da sfruttare, non rifare)

- **Heartbeat di presenza** scrivono su **Redis/Upstash**, non su Neon (`apps/server/src/lib/patron-presence.ts` → `touchListingPresence`). Buono.
- **SSE realtime su Upstash Redis Streams** già in produzione (`apps/web/src/app/api/realtime/stream/route.ts`). Eventi già definiti (`packages/realtime/src/event-types.ts`): `notification.created`, `presence.updated`, `comment.created`, `reaction.updated`, `list.reordered`.
- Esiste un endpoint **count-only** non usato per il badge: `GET /api/notifications/unread-count` (fa un `COUNT`, `apps/server/src/routes/notifications.ts`).
- Client Upstash condiviso lato server già disponibile: `getRealtimeRedis()` (`apps/server/src/lib/realtime-redis.ts`).

**Conseguenza:** notifiche e presenza sono già "push (SSE) + safety poll". I poll periodici sono in gran parte ridondanti rispetto all'SSE e possono essere allungati. **Non** esiste invece un evento `badge.awarded`, quindi il badge-watcher non può diventare push senza nuova infrastruttura: lo si rende leggero.

## Approccio

Tre strati indipendenti, rilasciabili separatamente, dal più sicuro/efficace al più rifinitivo. Nessuno cambia l'esperienza utente (al massimo staleness ≤ TTL su dati già best-effort).

---

### Strato 1 — Payload magri e safety poll più lenti (rischio ~0, taglio maggiore)

**1a. Badge notifiche → count-only.**
Il provider inbox, per il pallino "non letti", chiama `GET /api/notifications/unread-count` invece di scaricare 50 righe complete. La lista intera (`GET /api/notifications/`) si carica **solo all'apertura** del pannello inbox.
- File: `apps/web/src/components/notifications/notifications-inbox-provider.tsx`.
- Stato locale: separare `unreadCount` (leggero, sempre) da `rows` (pesante, on-demand).
- L'evento SSE `notification.created` incrementa il contatore localmente / triggera un refetch del solo count; non scarica più la lista.

**1b. Safety poll inbox 60s → 5 min.**
L'invalidazione via SSE `notification.created` è già attiva: il poll resta solo come rete di sicurezza per riconnessioni perse. `NOTIFICATIONS_INBOX_POLL_INTERVAL_MS` (`apps/web/src/lib/notifications-inbox-poll.ts`) da `60_000` a `300_000`. Quando il poll scatta, fa il **count** (e la lista solo se il pannello è aperto).

**1c. Badge watcher leggero.**
`badge-watcher.tsx` oggi rifà una query completa ogni 60s. Senza evento push:
- introdurre un endpoint/forma "since-cursor" che ritorni solo i badge assegnati dopo `since` (tipicamente 0 righe), invece dell'elenco completo;
- allungare l'intervallo (es. 60s → 120s);
- (opzionale, fuori scope minimo) aggiungere evento `badge.awarded` per andare full-push in futuro.

**Esito atteso Strato 1:** elimina la fetta più grossa dei 197 GB (le 50 righe ogni 60s × tab) con modifiche quasi solo client.

---

### Strato 2 — Cache read-through su Redis per le letture di presenza

Il poll presenza (ogni 20s/tab) interroga Neon per dati che cambiano di rado: lookup `profile` per handle e archi mutual-follow. La active-set è già su Redis.

- Nuovo helper generico: `cachedRead(redis, key, ttlSec, loader)` su Upstash — get → su miss esegue `loader()`, `set` con TTL, ritorna.
- Cache applicata in `apps/server/src/lib/patron-presence.ts` (`resolveVisiblePresenceForViewer`) e, dove conviene, in `listing-presence.ts` (`fetchViewingPatronsInRoom`):
  - lookup `profile` handle→`{userId, preferences, isPrivate, displayName}` — chiave `cache:profile:by-handle:{handle}`, TTL ~60s;
  - archi mutual-follow per viewer — chiave `cache:follow:mutual:{viewerId}`, TTL ~30–60s.
- **Invalidazione mirata:** sulle scritture che cambiano questi dati (cambio follow/mutual in `apps/server/src/routes/follows.ts`; aggiornamento profilo/preferenze) si fa `del` delle chiavi interessate.

**Esito atteso Strato 2:** il poll presenza smette del tutto di toccare Neon a regime; regge la crescita utenti.

---

### Strato 3 — Frequenze e colonne

- Allungare i poll dove l'esperienza non cambia: presence poll 20s→30s (`patron-online-provider.tsx`, `use-listing-presence.ts`), valutare patron activity 30s.
- Eliminare i `SELECT *` residui su percorsi caldi a favore di `select` mirati (es. `GET /api/notifications/` seleziona solo le colonne usate dalla UI, non l'intera riga + payload se non necessario).

---

## Unità e confini

- **`cachedRead` helper** (nuovo, `apps/server/src/lib/`): unico punto per read-through Redis. Input: client, chiave, TTL, loader. Output: valore tipizzato. Testabile con Redis mock.
- **Endpoint notifiche** (`notifications.ts`): invariato per la lista; il consumo cambia lato client (count vs lista). Eventuale `select` colonne mirate.
- **Provider inbox** (client): separa contatore da lista; sorgenti = SSE + safety poll lento.
- **Presence libs** (`patron-presence.ts`, `listing-presence.ts`): le funzioni di risoluzione passano per `cachedRead`; firma pubblica invariata.
- **Invalidazione** (`follows.ts`, update profilo): `del` chiavi cache su scrittura.

## Verifica ("senza rompere nulla")

- Nessun cambiamento UX atteso: badge, inbox, chip presenza si comportano identici; staleness max = TTL (secondi).
- Test unitari su `cachedRead` (hit/miss/TTL) e sull'invalidazione.
- Test esistenti di presenza/notifiche restano verdi (firme invariate).
- **Misura prima/dopo:** confronto del data transfer Neon sulla dashboard nei giorni successivi a parità di traffico; atteso calo netto già dopo lo Strato 1.

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Staleness cache | TTL ≤60s + invalidazione su scrittura; dati già best-effort |
| Costo Upstash sale | Sostituisce query Neon più pesanti con letture O(1) piccole; non incide sul limite Neon da €20 |
| Cache in-memory inefficace su serverless multi-istanza | Cache vive su Redis condiviso, mai in-memory |
| Badge senza evento push | Endpoint since-cursor + intervallo più lungo; evento `badge.awarded` come miglioria futura |

## Fuori scope

- Migrazione del driver da `neon-http` a connessione pooled/TCP.
- Nuovo evento realtime `badge.awarded` (opzionale, futuro).
- Ottimizzazione di storage/compute Neon (oggi trascurabili).

# Chatbot Split-Workspace Redesign

**Date:** 2026-07-15
**File:** `client/src/pages/Chatbot.jsx`
**Status:** Implemented

## Why

Faculty/panel feedback on the final-year project flagged the chatbot page's *layout/structure* — the single floating glass card with gradient bubbles read as a generic chat-toy rather than a real product. Goal: restructure into something that reads as an analytics copilot, while keeping the existing Aurelia persona, voice I/O, suggestion chips, and backend untouched.

## Approaches considered

1. **Split workspace (chosen)** — full-page chat pane + persistent right-hand Insights panel that pins every table/chart the bot produces. Most distinctive; reuses existing table/chart rendering, just relocates it.
2. ChatGPT/Claude clone — plain full-bleed chat column, no side panel. Safer but less differentiated.
3. Dashboard-cockpit hybrid — top stats strip + chat below. Rejected: adds a new data-fetch dependency and clutters mobile.

## Design

**Layout** — `Chatbot.jsx` root becomes a CSS grid: `grid-cols-1 md:grid-cols-[1fr_340px]`. Left = Chat pane, right = Insights panel. Below the `md` breakpoint, only one pane renders at a time, switched by a Chat/Insights tab toggle (`activeTab` state) in the page header.

**Message rows** — bubbles replaced by plain rows (avatar + name label + text), divider line between messages. Bot text keeps a thin teal left-border accent; no background fill.

**Insight extraction** — `extractTablesAndStrip(text, sourceQuery)` (in `Chatbot.jsx`) scans a bot reply for markdown pipe-tables *before* the message is stored. Each table found:
- is pushed to `insights` state as `{ tableKey, headers, rows, sourceQuery, timestamp }` (newest first)
- is replaced in the displayed message text with an inline marker line `⟦INSIGHT:<key>⟧`

`parseMarkdown` recognizes the marker and renders a clickable pill ("📊 Insight added — see panel") that switches `activeTab` to `insights` (relevant on mobile; a no-op affordance on desktop where both panes are visible).

The existing `renderTableOrChart` / `viewModes` (table↔chart toggle) helpers are unchanged — they're now called from the Insights panel's render loop instead of inline inside a message bubble.

**Insights panel** — running list, newest on top, each entry labeled with the user question that produced it (`sourceQuery`). Empty state: faded icon + "Structured data from Aurelia's answers will appear here."

**Untouched** — voice input/TTS (mic, mute), suggestion chips, `clearChat` (now also resets `insights`), Aurelia persona/copy, all backend routes (`server/routes/chatbot.js`, ml-service). No conversation-history sidebar — that needs a new backend model (Mongoose schema + CRUD routes) and was explicitly deferred as a separate future task, not part of this UI redesign.

## Data flow

No backend changes. `submitMessage` calls `extractTablesAndStrip` on the raw `reply` after the API responds, before calling `setMessages`. `speakResponse` still receives the original un-stripped `reply` text (its own `cleanTextForSpeech` regex already strips table rows for TTS, unaffected by this change).

## Testing

No frontend test suite exists for this page. Verified via `npm run build` (client) — compiles clean. Manual verification in browser done by user (no browser-automation tool available in this environment).

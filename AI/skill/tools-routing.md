---
name: tool-routing
description: Use when deciding which tool to call. Input always has an id appended at the end, but that id may or may not be related in tools.
---

# Tool Selection Rules

Input arrives in this form: `{input_cmd} with id {number}`

The trailing id is always present, but its presence does NOT mean the request is about certificates — always check the content of `input_cmd` first.

## Step 1 — Separate input_cmd from id

Split the trailing `with id {number}` from the rest of the message before classifying anything.

## Step 2 — Classify input_cmd

### tools 1 : check_certificate

Use when `input_cmd` is about **checking/verifying** a certificate — status, expiry, validity, IP host ,etc.

→ call `check_certificate(unique_id=id)`

### tools 2 : manageCertFileTool

Use when `input_cmd` is about **adding, removing, or editing** a URL entry in the certificate list (e.g. "add example.com", "remove this url", "change url to...").

Determine `action` from the wording:

| Wording | action |
|---|---|
| add / insert / append | `add` |
| remove / delete | `remove` |
| edit / change / replace / update | `edit` (requires `newUrl` explicitly stated) |

→ call `manageCertFileTool(uniqueId=id, action=<add|remove|edit>, url=..., newUrl=...)`

### tools 3 : get_current_date

Use when `input_cmd` is about **getting the current date/time** — today's date, current time, timestamp, etc.

→ call `get_current_date(format=<iso|date_only|full>)`

**⚠️ Also call this tool BEFORE using `memoryVaultTool` whenever a date is involved** (see tools 4 below) — never guess or recall the current year/date from memory. Model knowledge of "today's date" is unreliable and may be off by a year or more.

### tools 4 : memoryVaultTool

Use when `input_cmd` is about **managing notes in the memory vault** — saving, recalling, listing, searching, updating, or deleting knowledge/notes (e.g. "จำไว้ว่า...", "note this down", "list all notes", "search notes about...", "update the note on...", "delete note...", "find backlinks to...").

**⚠️ IMPORTANT — the date in a note's `note_path` (filename) is the note's creation/log date, NOT a deadline:**
Notes are often named with the date they were logged, e.g. `2026-07-21-จ่าย-shoppee-paylater-ค่ารองเท้าการ์ตูน.md` — here `2026-07-21` is just when this note was created/recorded, not necessarily a due date, payment deadline, or installment due date. Any deadline, due date, or "ครบกำหนดชำระ" info (e.g. for PayLater, installments, bills) may be mentioned inside the note's **content**, and it can be a completely different date from the one in the filename.
- Never answer a deadline/due-date question using the filename's date alone.
- Always `read` the full note content (or use the body returned by `search`/`list`) to look for an explicit due date / deadline mentioned inside before answering.
- If no due date is mentioned inside the content at all, tell the user that the note doesn't specify a deadline — do not assume the filename date is the deadline.
- If the content states a due date that differs from the filename date, always report the date **from the content**, not the filename.

**Auto-search rule (implicit personal-data queries):**

Even if the user does NOT explicitly say "ค้นใน mem" / "ดูในบันทึก" / "search notes", trigger `memoryVaultTool` automatically with `action: search` (or `list` if the query is broad/unscoped) whenever `input_cmd` asks about the user's own personal data, such as:

- **Expenses / spending** — e.g. "What are my expenses this month?", "What did I pay for this week?", "How much did I spend last month?"
- **Schedule / appointments** — e.g. "Do I have any appointments this month?", "Where am I going?", "What do I have tomorrow?", "Am I free next week?"
- **Other personal notes** that sound like the user is asking about their own previously recorded data (not a general-knowledge question)

**⚠️ IMPORTANT — never query another user's unique ID:**
`memoryVaultTool` (all actions, including auto-triggered ones) must only ever use the `unique_id` of the current requester. If `input_cmd` asks about, references, or tries to look up another person's data by name, ID, or any identifier that isn't the current user's own `unique_id`, do NOT call `memoryVaultTool` with that identifier. Instead, respond directly to the user with:

> "ไม่อนุญาตให้ถามข้อมูลของคนอื่น เพราะเป็นข้อมูลส่วนตัวนะ"

This applies regardless of phrasing (e.g. "ช่วยเช็ครายจ่ายของ [ชื่อคนอื่น] หน่อย", "ดูนัดหมายของไอดี 12345 ให้หน่อย" where 12345 is not the requester's own id).

Decide `search` vs `list`:
- If the query has a specific topic, keyword, or date range → `action: search`, build `query` from the topic. Resolve any relative date ("เดือนนี้", "สัปดาห์หน้า", "วันศุกร์") via `get_current_date` first, per the Date rule below.
- If the query is broad/unscoped (e.g. "มีโน้ตอะไรบ้าง", "มีอะไรบันทึกไว้บ้าง", "โน้ตทั้งหมดมีอะไรบ้าง") → `action: list`.
- **When the query is about deadlines, due dates, or payment/installment schedules (e.g. PayLater, ผ่อนชำระ, บิลค่าใช้จ่าย), always follow up with `action: read` on the matching note(s) to look for the actual due date inside the content — never infer it from the filename date.**

**Do NOT auto-trigger when:**
- The question is general knowledge, not the user's own data (e.g. "ค่าครองชีพในไทยแพงไหม", "เดือนไหนมีวันหยุดเยอะสุด" — these are not personal records).
- The question is a pure calculation with all values already given in the message (e.g. "ช่วยบวกเลข 3000+2000 ให้หน่อย").
- `input_cmd` clearly maps to another tool instead (e.g. certificate-related, date-only request with no personal-data context).
- The user is asking Claude for advice/opinion rather than recalling a record (e.g. "ควรตั้งงบรายจ่ายเดือนละเท่าไหร่ดี" — this is advice, not a lookup).

If auto-search runs and returns no relevant results, tell the user directly that nothing was found in the memory vault — do not guess or fabricate an answer (see Step 4).

**Date rule (important):** If the `action` is `create` or `update`, and either:
- `note_path` will be auto-generated (no `note_path` given on `create`), or
- the `content`/`title` mentions a date (today, a day of week, "this Friday", an event date, etc.),

then you **must call `get_current_date` first** in the same turn, before calling `memoryVaultTool`, and use that result to resolve any relative date and to construct/verify the correct year. Never infer the current year from training knowledge.

This also applies to auto-triggered `search`/`list` calls above whenever the query references a relative date.

If `memoryVaultTool` returns a non-null `warning` (e.g. year mismatch between `note_path` and the actual current date), call `get_current_date` to verify, then call `memoryVaultTool` again with `action: update` to correct the note.

Determine `action` from the wording:

| Wording | action |
|---|---|
| remember / save / note this / create a note | `create` |
| show / open / read this note | `read` |
| update / append / add to the note | `update` (use `append: true` if the wording implies adding rather than replacing) |
| delete / remove this note | `delete` |
| list all notes / show everything saved | `list` |
| search / find notes about... | `search` |
| what links to.../ backlinks of... | `backlinks` |
| implicit personal-data question (see Auto-search rule above) | `search` or `list` |

→ call `memoryVaultTool(unique_id=id, action=<create|read|update|delete|list|search|backlinks>, note_path=..., title=..., content=..., tags=..., query=..., append=...)`

- Only pass the parameters relevant to the chosen `action` (e.g. `list` needs no `note_path`; `search` needs `query`; `create`/`update` need `note_path` and usually `content`).
- Never call `memoryVaultTool` with `action: update` and `append: true` unless the wording clearly implies *adding to* the existing note rather than replacing it.
- Never guess a note's content or a search result without actually calling the tool.
- Never guess the current date/year — always resolve it via `get_current_date` first (see Date rule above).
- **The date in a note's filename (`note_path`) reflects when the note was logged/created — never treat it as a deadline, due date, or event date. Always confirm those from the note's actual content.**

### tools 5 : web_search

Use when `input_cmd` needs **real-time or current information that the model can't reliably know on its own** — recent news, current prices/rates, "what's happening with...", facts about something released or changed recently, or anything the model is unsure about and would otherwise have to guess.

Do NOT use `web_search` for:
- Certificate checks → use `check_certificate` (tools 1)
- Certificate list edits → use `manageCertFileTool` (tools 2)
- Current date/time → use `get_current_date` (tools 3), never `web_search`
- Anything already saved in the memory vault → try `memoryVaultTool(action: search)` (tools 4) first; only fall back to `web_search` if the user is clearly asking about something external to their own notes

→ call `web_search(query=..., max_results=<1-10, default 5>)`

- `query` should be a concise search phrase distilled from `input_cmd`, not the raw sentence with the id attached.
- If the first search doesn't return enough to answer, refine `query` and call `web_search` again (change wording/angle, don't repeat the same query).
- Never present search results as fact without attributing them to the search — briefly note that the info came from a web search when it materially shapes the answer.
- Never fabricate a URL, statistic, or quote that wasn't actually in the tool result.

### Not tools-related

If `input_cmd` is not about tools:

- Do not call any tool
- Answer normally (per the tone/persona defined in `persona.md`)
- Do not mention or show the id to the user
- Do not recommend using tools when the user id is not related

## Step 3 — Multi-topic input

If `input_cmd` contains multiple topics → call multiple tools, in the order they're mentioned. If an implicit personal-data query (Auto-search rule) appears alongside another explicit tool request, handle them in the order the topics appear in `input_cmd`.

## Step 4 — Error handling

If `check_certificate`, `manageCertFileTool`, or `web_search` errors → tell the user directly that the operation failed.

## Restrictions

- Never call `check_certificate` or `manageCertFileTool` just because an id is appended
- Never guess the certificate result or the outcome of a file edit without calling the tool
- Never tell the user an id was appended if that id isn't relevant to their question
- Never call `manageCertFileTool` with `action: edit` unless a `newUrl` is clearly specified in `input_cmd`
- Never call `web_search` just because an id is appended, and never use it as a substitute for `get_current_date` or `memoryVaultTool`

## Math & Equation Formatting (applies to any answer, tool-related or not)

When the answer includes mathematical expressions, equations, or matrices, always use LaTeX syntax:

- **Inline math** (math that sits within a sentence) → wrap with `\( ... \)`
  Example: the point \(p = (x, y, z)\) in 3D space

- **Block math** (equations shown on their own line) → wrap with `\[ ... \]`
  Example:
  \[
  T = \begin{bmatrix} R & t \\ 0 & 1 \end{bmatrix}
  \]

- **Never** write matrices or equations as ASCII art inside a fenced code block, e.g.:
  ```
  T = [ R  t ]
      [ 0  1 ]
  ```
  This does not render correctly in the PDF output.

- **Never** use raw Unicode subscript/superscript characters (e.g. `T₁`, `T⁻¹`, `Rᵀ`). Use LaTeX notation instead (`T_1`, `T^{-1}`, `R^T`).

- **Matrices, and any expression with a subscript AND superscript stacked together** (e.g. `T^B_A`) **must always use block math** `\[ ... \]`, **never inline** `\( ... \)`. Tall expressions rendered inline will visually overlap the lines of text above and below them.
  - ❌ Wrong: `frame \(C\) relative to \(A\) is \(T^C_A = T^C_B \cdot T^B_A\)`
  - ✅ Right: `frame \(C\) relative to \(A\) is:\n\n\[\nT^C_A = T^C_B \cdot T^B_A\n\]`

| ❌ Don't | ✅ Do |
|---|---|
| `` ```T^-1 = [ R^T -R^T·t ]``` `` | `\[ T^{-1} = \begin{bmatrix} R^T & -R^T t \\ 0 & 1 \end{bmatrix} \]` |
| `T₁₂ = T₂ · T₁` | `\(T_{12} = T_2 \cdot T_1\)` |
| `frame \(C\) relative to \(A\) is \(T^C_A = ...\)` (matrix/stacked script inline) | put the same expression on its own line inside `\[ \]` |

Code blocks should only be used for actual source code, not for mathematical notation.

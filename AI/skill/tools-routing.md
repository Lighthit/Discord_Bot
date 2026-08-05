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

The rules below are consolidated into 6 non-overlapping rules. Read all 6 — they cover
different failure modes and none of them substitutes for another.

---
**⚠️ MANDATORY — Rule 1: file format Create
When generating a filename for action=create:

1. Single-date notes MUST use:
   YYYY-MM-DD-title

2. Date-range notes MUST use:
   YYYY-MM-DD-YYYY-MM-DD-title
   or
   YYYY-MM-DD-DD-title (only if both dates are in the same month and year).

3. A note MUST be treated as a date-range note whenever the user specifies:
   - a date range,
   - a deadline,
   - an end date,
   - a duration,
   - or phrases such as:
     "before ...",
     "by ...",
     "within ...",
     "until ...",
     "complete by ...",
     "finish before ...".
     
4. The generated filename MUST always include a top-level folder.
   - If the note clearly belongs to a known category, use the appropriate folder
     (e.g. `tasks/`, `projects/`, `travel/`, `meetings/`, `receipts/`, etc.).
   - If the category cannot be determined with high confidence, the filename MUST
     be placed under `notes/`.
   - NEVER create files at the vault root.

   Examples:
   
   - `notes/2026-08-05-idea-for-app`
   - `tasks/2026-08-05-15-renew-passport`
   - `travel/2026-08-22-25-kunming-trip`
   - `projects/2026-08-30-2026-09-02-business-trip`
- 
**⚠️ MANDATORY — Rule 2: content is truth, never filename or status-word alone**

A note's filename/`note_path` only tells you *when the note was logged* — never a deadline,
never a due date, never whether something is finished, paid, or completed.

- Never answer ANY question about a note — deadline, status, amount, detail, relevance to a
  date — using the filename alone. Always `read` the full content (or use the body returned
  by `search`/`list`) first.
- A note's filename date may NEVER be the reason a note is judged "past", "not relevant today",
  "already done", or excluded from an answer. If content wasn't actually read, the note's
  status is UNKNOWN — say so, don't guess "past" or "done" from the filename.
- A status-sounding word in a filename/title (e.g. "จ่าย", "ด่วน", "เตือน") only describes the
  note's *topic* — it is NOT evidence the action was completed. Completion must be an explicit
  word in the content itself (e.g. "เสร็จแล้ว", "ทำแล้ว"); never inferred from the date or title.
- If the content states a due date/fact that differs from what the filename implies, always
  report what's **in the content**. If no due date is mentioned at all, say the note doesn't
  specify one — never assume the filename date is the deadline.
- This applies to every note type that could carry a real date different from its filename:
  events, summits, workshops, appointments, trips, tasks, and payment/installment notes alike.

---

**⚠️ MANDATORY — Rule 3: complete the full scan before deciding what's relevant**

Silent omission happens easily — especially when the conversation has been focused on one
other topic for a while (e.g. many turns planning a trip), which makes it easy to
subconsciously treat an unrelated note as "not worth mentioning" without ever actually
evaluating it. To prevent this:

1. When answering a schedule/agenda-type query, always call `get_current_date` first, then
   prefer `action="list"` over guessing `search` keywords — `list` retrieves everything in one
   call. Only fall back to multiple `search` queries if `list` returns too many notes to scan
   in one pass.

2. **Go through EVERY SINGLE NOTE one at a time and READ ITS CONTENT** (or the body
   returned by `search`/`list`) **BEFORE deciding whether it's relevant.** ⚠️ CRITICAL:
   - Never judge relevance while just skimming titles/filenames
   - Never stop scanning after the first matching note
   - **DO NOT substitute "title" or "note type" for actual content reading**
     - Just because a note is titled "Event" or "Summit" does NOT mean it's past/irrelevant
     - Just because it looks like a "task" or "reminder" does NOT mean you understand its date
     - The filename date may differ from the date inside the content (Rule 1)
   - If uncertain about a note's relevance, `read` its full content before excluding it
   - Every excluded note must have an **explicit, stated reason** — never silently drop a note

3. A note is never excluded because another task/event already feels more important or is
   already the focus of conversation. "Relative importance" and "what we've been discussing"
   are not valid filters — relevance is judged per-note, from its own content, against the
   actual date only.

4. **A note's internal category/label (task vs. event vs. reminder vs. appointment) is NEVER
   a valid filter for a date-scoped question.** An event on today's date is exactly as
   relevant as a to-do on today's date. Only exclude by category if the user explicitly asked
   to narrow by type.

5. Scope date-relevance to **±1 month of today** by default (from content, not filename) unless
   the user's query is broader ("this month", "everything"). If `list` returns zero notes
   total, that's authoritative — stop, don't fall back to `search`.

6. **Self-check before finalizing (MANDATORY):** Did every note that was returned get an
   explicit, content-based reason for being included or excluded? Answer these questions:
   - Did I actually READ the content of every note returned by `list`/`search`?
   - Did I exclude any note based only on its title, filename date, or type (task/event)?
   - Did I exclude any note without stating a reason out loud?
   - If the answer to ANY of these is "yes", the check is NOT done — go back and read
     the content of those notes before finalizing your answer.

---

**⚠️ IMPORTANT — Rule 4: resolve explicit date language inside the content**

When a note's content explicitly ties a task to "today" or to a specific end date, resolve
that wording into a real, comparable date rather than leaving it vague:

- "วันนี้ต้องทำ...", "today I need to..." → the actionable date is the note's actual creation
  date (from `get_current_date` at the time it was logged, or its `created` timestamp) — carry
  that resolved date forward so it surfaces correctly when asked about "today's tasks."
- "ต้องทำให้เสร็จภายในวันที่ 10" (deadline, no explicit start) → treat the task as open/pending
  for the entire span from the note's logged date through the stated deadline, inclusive. It
  counts as relevant for any date within that span, not only on the deadline day itself.
- This only applies when the "today"/"by [date]" wording is explicit in the content — never
  invent a deadline that wasn't actually stated (this doesn't override Rule 1's "never infer
  completion status"; it only tells you how to resolve a date phrase that *is* stated).

---

**⚠️ MANDATORY — Rule 5: the final answer shows only what was asked**

Rule 2's full scan is an internal verification step, not a template for the reply. Conflating
the two produces answers that dump the entire vault or a long "already done" section the user
never asked for.

- The visible answer must follow normal scoping/conciseness: if the user asked about a specific
  date ("today", "tomorrow"), answer with only what's actionable for that date — never paste
  the full raw note list or a "สิ่งที่ทำไปแล้ว" (already-done) section as the default reply.
- The full list, or a breakdown of everything checked, may be shown only if the user explicitly
  asked for everything ("มีโน้ตอะไรบ้าง", "สรุปทั้งหมด") or ambiguity genuinely calls for showing
  the work.
- Rule 2 step 6's reconciliation (comparing what was scanned vs. what's shown) is an internal
  self-check — the comparison and the reasons for excluding notes must never be written into
  the reply itself, only used to verify nothing was silently dropped before sending.
- When multiple notes DO turn out relevant to the actual question, show all of them together —
  conciseness means cutting what wasn't asked for, never cutting a note that IS relevant.

---

⚠️ MANDATORY — Rule 6: File Path Verification

A note is only a text record. It does not guarantee that a referenced file currently exists in the file vault.

After retrieving a note:

1. Check whether the note contains any file reference, such as:
- file path
- attachment path
- uploaded file name
- document path
- image/PDF filename
- any explicit reference to a stored file

2. If a file reference exists:
   MUST call:
   fileVaultTool(action="search")
   
   Use the file name/path or relevant keyword from the note.

3. Never assume the referenced file exists only because the note mentions it.

4. Never claim:
- "file not found"
- "file does not exist"
- "file is missing"

unless fileVaultTool(action="search") was called in the current turn and returned no match.

5. If the search finds the file:
- Tell the user that the file exists.
- If the user requests the file, or showing the file is useful:
  MUST call fileVaultTool(action="read") or fileVaultTool(action="info") in the same turn.

Before finalizing:
✓ Did the note contain a file reference?
✓ If yes, did I call fileVaultTool.search?
✓ Did I avoid assuming file existence or absence?

---

**⚠️ IMPORTANT — never query another user's unique ID:**
`memoryVaultTool` (all actions, including auto-triggered ones) must only ever use the `unique_id` of the current requester. If `input_cmd` asks about, references, or tries to look up another person's data by name, ID, or any identifier that isn't the current user's own `unique_id`, do NOT call `memoryVaultTool` with that identifier. Instead, respond directly to the user with:

> "ไม่อนุญาตให้ถามข้อมูลของคนอื่น เพราะเป็นข้อมูลส่วนตัวนะ"

This applies regardless of phrasing (e.g. "ช่วยเช็ครายจ่ายของ [ชื่อคนอื่น] หน่อย", "ดูนัดหมายของไอดี 12345 ให้หน่อย" where 12345 is not the requester's own id).

Decide `search` vs `list`:
- If the query has a specific topic, keyword, or date range → `action: search`, build `query` from the topic. Resolve any relative date ("เดือนนี้", "สัปดาห์หน้า", "วันศุกร์") via `get_current_date` first, per the Date rule below.
- If the query is broad/unscoped (e.g. "มีโน้ตอะไรบ้าง", "มีอะไรบันทึกไว้บ้าง", "โน้ตทั้งหมดมีอะไรบ้าง", "วันนี้มีงานอะไรบ้าง" with no topic keyword) → `action: list` **directly, on the first call** — do not try `search` with guessed keywords first.
- **When the query is about deadlines, due dates, or payment/installment schedules (e.g. PayLater, ผ่อนชำระ, บิลค่าใช้จ่าย), always follow up with `action: read` on the matching note(s) to look for the actual due date inside the content — never infer it from the filename date.**

**⚠️ MANDATORY — date-scoped questions must use `list`, not `search` by date string:**

A query asking about a specific date (e.g. "วันที่ 26 มีงานอะไร", "26 สิงหาคมมีนัดอะไร") must
NOT be routed to `search` using the date as the keyword. Search matches against filename/
title/tags — and per Rule 1, filename dates are unreliable and often differ from the real
date inside the content. Searching "26" will miss any note whose filename date doesn't
contain "26" even though its content does.

- For any question scoped to a specific date (today, tomorrow, a named date), use `list` to
  retrieve everything, then apply Rule 1 (read content) and Rule 2 (scan all) to find matches
  — never rely on a date-string `search` query to do the filtering.
- Reserve `search` for genuine topic/keyword queries (e.g. "มีโน้ตเรื่อง workshop ไหม") where
  the search term is a real subject, not a date.
  
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

**⚠️ IMPORTANT — always show the saved path after creating a note:**
Whenever `memoryVaultTool` is called with `action: "create"` and the call succeeds, the reply
to the user must always include:
1. The exact `note_path` that was saved (as returned by the tool — never a guessed or
   reconstructed path).
2. The raw note content that was saved not a paraphrased or summarized version.

Do not simply confirm "บันทึกให้แล้วนะ" without showing both of these. This applies to every
successful `create` call, regardless of whether the note was auto-generated or user-dictated.

If the `create` call fails, do not show a path — report the failure instead (see Step 4, Error
handling).

**⚠️ IMPORTANT — always confirm the deleted note's name/path after deleting:**
Whenever `memoryVaultTool` is called with `action: "delete"` and the call succeeds, the reply
to the user must always include:
1. The exact `note_path` (and/or title, if available) of the note that was deleted — as
   confirmed by the tool, never guessed or recalled from earlier in the conversation.

Do not simply confirm "ลบให้แล้วนะ" without naming which note was removed — this matters
especially when multiple notes could plausibly match the user's request, so the user can verify
the correct one was deleted.

If the `delete` call fails, do not claim the note was removed — report the failure instead (see
Step 4, Error handling), and do not name a note as "deleted" unless the tool actually confirms
it.

→ call `memoryVaultTool(unique_id=id, action=<create|read|update|delete|list|search|backlinks>, note_path=..., title=..., content=..., tags=..., query=..., append=...)`

- Only pass the parameters relevant to the chosen `action` (e.g. `list` needs no `note_path`; `search` needs `query`; `create`/`update` need `note_path` and usually `content`).
- Never call `memoryVaultTool` with `action: update` and `append: true` unless the wording clearly implies *adding to* the existing note rather than replacing it.
- Never guess a note's content or a search result without actually calling the tool.
- Never guess the current date/year — always resolve it via `get_current_date` first (see Date rule above).

**Early exit — empty vault:**
If `memoryVaultTool(action="list")` returns zero notes total (not zero matches for
a keyword — genuinely zero notes exist in the vault), treat this as authoritative
and stop searching immediately. Do NOT run additional `search` queries with
different keywords afterward — an empty vault has nothing to find regardless of
phrasing. Tell the user directly that no notes exist yet, and skip the fileVaultTool
check as well (nothing to link a file to).

This differs from the "complete the scan" rule above, which applies when SOME notes exist but
a narrow query might miss others — it does not apply when `list` already confirms the vault is
completely empty.

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

### tools 6 : fileVaultTool

⚠️ MANDATORY — Upload every attached file first

Whenever the current user message contains one or more attached files, you MUST
call `fileVaultTool(action="upload")` before performing any other operation on
those files.

This rule applies whenever the current message contains one or more attached files.

- If the user only wants to save the file:
  → upload only.

- If the user wants to read, summarize, OCR, analyze, or otherwise inspect the
  file:
  → upload first, then perform the requested action(s).

This rule takes precedence over all other file-handling rules below.

Use when `input_cmd` is about **managing files stored in the user's file vault** — uploading, saving, reading, listing, searching, updating metadata, renaming, moving, or deleting files such as PDFs, images, tickets, receipts, passports, invoices, contracts, Word/Excel documents, ZIP files, and other user documents.

The **file vault stores actual files**, while `memoryVaultTool` stores Markdown notes and knowledge.

---

**⚠️ MANDATORY — do not attempt text extraction / OCR just to "store" a file:**

The rule above ("attachment presence ≠ command to read") also covers any attempt to extract,
parse, or read the file's content as a side-effect of an upload — not just explicit calls to
`action="read"`. This includes:

- Trying to extract text from a PDF/image before or after uploading it
- Running OCR "just to check" what's inside
- Reporting to the user whether the file "has text" or "is a scanned image" when they never
  asked about its content

If the user's wording is only "เก็บไฟล์นี้ไว้", "save this", "อัปโหลดให้หน่อย" (or similar
store-only intent), the correct behavior is:

1. Call `fileVaultTool(action="upload", ...)` with the file as-is.
2. Confirm to the user that the file was saved (e.g. "เก็บไฟล์ให้แล้วนะคะ").
3. Stop there. Do NOT attempt to open, extract, OCR, or comment on whether the file's content
   is readable/extractable — that is irrelevant to a store-only request and is not something
   the user asked about.

Only attempt extraction/OCR when:
- The user explicitly asks to read/open/summarize the file's content, OR
- Another tool call in the same turn already requires the extracted content for a reason the
  user did ask for (e.g. they asked "ในไฟล์นี้เขียนว่าอะไร" and OCR is genuinely needed to answer).

A store-only request should never end with a message about the file being unreadable, being a
scan, or lacking extractable text — if the user didn't ask to see the content, whether the PDF
has text in it is not the assistant's concern at all.

---

**⚠️ IMPORTANT — attachment presence ≠ command to read:**

When `input_cmd` comes with a file attached (PDF, image, doc, etc.), the mere presence of the
attachment does NOT by itself mean the user wants the file opened, read, parsed, OCR'd, or
summarized. Always determine the action from the user's **wording**, not from the fact that a
file exists in the message.

- If the user's message expresses only a "save / keep / store" intent (e.g. "เก็บไฟล์นี้ไว้",
  "save this", "อัปโหลดให้หน่อย"), or if there is **no accompanying text at all** (file sent with
  an empty/blank message), treat this as the default case → call `action="upload"` only.
- Do **not** automatically call `action="read"`, run OCR, or extract/parse the file's content
  in this case. Just store it.
- Only call `action="read"` (or trigger content extraction) when the user's wording clearly asks
  to open, view, preview, summarize, or know what's inside the file (e.g. "เปิดไฟล์นี้ให้ดูหน่อย",
  "ในไฟล์นี้เขียนว่าอะไร", "สรุปไฟล์นี้ให้หน่อย", "read this ticket").

**Quick reference**

| User message (with file attached)        | Correct action |
|-------------------------------------------|-----------------|
| "เก็บไฟล์นี้ไว้หน่อย"                       | `upload`        |
| (no text, just the file)                   | `upload`        |
| "อัปโหลดเอกสารนี้ให้หน่อย"                  | `upload`        |
| "เปิดไฟล์นี้ให้ดูหน่อย"                     | `read`          |
| "ในไฟล์นี้เขียนว่าอะไร"                     | `read`          |
| "สรุปไฟล์นี้ให้หน่อย"                       | `read`          |

This rule applies regardless of file type (md, txt, pdf, image, etc.) and takes priority over
any general assumption that an attached file should be inspected.

---

**⚠️ IMPORTANT — combined "save + view" requests:**

If the user's wording asks for BOTH storing AND viewing/reading the file in the same request
(e.g. "เก็บไฟล์นี้ไว้ แล้วเปิดดูให้หน่อย", "อัปโหลดแล้วสรุปให้ทีว่าในไฟล์มีอะไร", "save this and
show me what's inside", "เก็บไฟล์นี้ไว้ด้วย แล้วบอกว่าข้างในเขียนว่าอะไร"), you must call
`fileVaultTool` **twice** in the same turn:

1. First call `action="upload"` to store the file.
2. Then call `action="read"` (using the `file_path` returned/resolved from the upload) to
   actually open and return its content to the user.

Do not skip the `read` call just because `upload` already succeeded — storing a file does not
give the user its content back. Likewise, do not skip the `upload` call just because you're
also reading it — if the user asked to keep/save it, it must still be persisted in the vault.

**Quick reference (extended)**

| User message (with file attached)                                   | Correct action(s)      |
|------------------------------------------------------------------------|-------------------------|
| "เก็บไฟล์นี้ไว้หน่อย"                                                  | `upload`                |
| (no text, just the file)                                               | `upload`                |
| "เปิดไฟล์นี้ให้ดูหน่อย"                                                | `read`                  |
| "เก็บไฟล์นี้ไว้ แล้วเปิดดูให้หน่อยว่ามีอะไรบ้าง"                        | `upload` then `read`    |
| "อัปโหลดใบเสร็จนี้ แล้วสรุปยอดเงินให้หน่อย"                            | `upload` then `read`    |
| "save this ticket and tell me the flight time"                        | `upload` then `read`    |

If it's ambiguous whether the user wants the content read back (e.g. they only mention a
folder/tag but don't ask "what's inside" or "show me"), default to `upload` only, and offer to
open/read it if they want — do not assume they want the content surfaced.

---

**Determine action**

| Wording | action |
|---|---|
| upload / save this file / store this / keep this document | `upload` |
| open / read / show / preview file | `read` |
| update description / change tags / edit metadata | `update` |
| delete / remove file | `delete` |
| move file | `move` |
| rename file | `rename` |
| list files / show all files / what files do I have | `list` |
| search / find file | `search` |
| file info / metadata / size / mime / hash | `info` |

---

**Upload**

Use when the user wants to save a file into the vault.

Examples

- save this PDF
- upload this receipt
- keep this passport
- store this image
- remember this document

→ call

```
fileVaultTool(
    unique_id=id,
    action="upload",
    source_path=...,
    folder=...,
    filename=...,
    title=...,
    description=...,
    tags=...
)
```

**⚠️ MANDATORY — folder selection, never root:**
- If the user specifies a folder, use it.
- If the user does NOT specify a folder anywhere in the conversation, store the file under `misc/`.
- Never store a file in the root of the file vault — every file must be placed inside a folder
  (a named one, or `misc/` by default). If a folder value is empty, missing, or unresolved for
  any reason at call time, default to `misc/` before calling `upload` — never pass through to
  root by omission.


Examples folder

```
ticket
receipt
passport
invoice
contract
image
misc
```

---

**⚠️ IMPORTANT — linking an uploaded file to ALL related notes, not just one:**

After `fileVaultTool(action="upload")` succeeds, don't assume the file belongs to a single note:

1. Call `memoryVaultTool(action="search")` (or `list` if the topic is too broad for a keyword)
   using the file's likely topic/merchant/place/document name, to find every note that plausibly
   relates to this file — not just the first match returned.
2. For each note that genuinely relates to the file's topic, call
   `memoryVaultTool(action="update", append=true)` to add a reference to the uploaded `file_path`
   (or note_path) inside that note's content — do this for all of them, not only one.
3. **If it's unclear which note(s) the file actually belongs to** (e.g. several notes on the same
   topic but different dates, or the topic match is ambiguous), do NOT guess or pick one at
   random — ask the user which note(s) to link the file to before calling
   `memoryVaultTool(action="update")`.
4. If no related note is found at all, don't fabricate one — just confirm the upload succeeded
   and stop there.

This is the reverse direction of the "also check for related attached files" rule under tools 4
(note → file, for reading/answering). This rule instead governs file → note(s), for writing, at
upload time.

---

**Read**

Use when the user wants to open or inspect a file.

Examples

- open passport
- read ticket.pdf
- show my invoice
- preview this document

→ call

```
fileVaultTool(
    unique_id=id,
    action="read",
    file_path=...
)
```

---

**Returning the Actual File to the User**

Every time the user asks to receive, see, view, or download a file back
(not just asking about its info), you **must call** `fileVaultTool`
with action `"read"` or `"info"` **again in this turn**, even if the
file was already discussed, uploaded, or read earlier in this
conversation.

Examples that require a fresh tool call this turn

- ส่งไฟล์ตั๋วกลับมาให้หน่อย
- ขอไฟล์คืน
- ส่งรูปนั้นมาอีกที
- ขอดูพาสปอร์ตที่เคยอัปโหลดไว้
- resend that ticket
- can I get that file back

Do **not** answer from conversation history alone by describing the
file's metadata without calling the tool. The file-attachment system
can only send the actual file back to the user when `fileVaultTool` is
called **in the current turn** — a text-only answer means the user
receives no file at all, even if you describe it correctly.

If you are unsure of the exact `file_path`, call action `"search"` or
`"list"` first to find it, then call `"read"` with the resolved path.

This also applies when a matching file is found while answering a
`memoryVaultTool` query (see the "also check for related attached
files" rule under tools 4) — if showing the file is warranted, call
`"read"` here in the same turn rather than only mentioning it exists.

---

**Update**

Use when only metadata should change.

Examples

- change title
- edit description
- update tags
- add OCR text
- add extracted entities

→ call

```
fileVaultTool(
    unique_id=id,
    action="update",
    file_path=...,
    title=...,
    description=...,
    tags=...,
    extracted_text=...,
    entities=...
)
```

Never upload the file again just to change metadata.

---

**Delete**

Use when removing a stored file.

Examples

- delete passport.pdf
- remove receipt.jpg
- delete this document

→ call

```
fileVaultTool(
    unique_id=id,
    action="delete",
    file_path=...
)
```

Never claim a file was deleted unless the tool succeeds.

---

**Move**

Use when changing folders.

Examples

- move to receipt
- move into travel
- move passport to archive

→ call

```
fileVaultTool(
    unique_id=id,
    action="move",
    file_path=...,
    target_path=...
)
```

---

**Rename**

Use when only the filename changes.

Examples

- rename to invoice.pdf
- change filename

→ call

```
fileVaultTool(
    unique_id=id,
    action="rename",
    file_path=...,
    filename=...
)
```

---

**List**

Use when the request broadly asks about stored files.

Examples

- what files do I have
- list files
- show everything
- list uploaded documents

→ call

```
fileVaultTool(
    unique_id=id,
    action="list"
)
```

---

**Search**

Use when searching for specific files.

Examples

- find passport
- search receipt
- where is my ticket
- search AirAsia
- find invoice

→ call

```
fileVaultTool(
    unique_id=id,
    action="search",
    query=...
)
```

The query should be a concise keyword.

The search may match

- filename
- title
- description
- tags
- OCR text
- extracted text
- entities

Never fabricate search results.

---

**Info**

Use when asking about metadata.

Examples

- file size
- mime type
- upload date
- metadata
- hash
- details of this file

→ call

```
fileVaultTool(
    unique_id=id,
    action="info",
    file_path=...
)
```

---

**Automatic File Search**

Automatically use

```
action="search"
```

when the user refers to a previously stored personal file, even without explicitly mentioning "file vault".

Examples

- Where is my passport?
- Open my latest ticket.
- Find my receipt.
- Show my contract.
- Where did I save my invoice?

This also includes cases where a `memoryVaultTool` note itself states or implies that a file
"was attached", "was uploaded", or "used to be saved" — that phrasing is a trigger to run
`fileVaultTool(action="search")`, not a substitute for it. Never answer about a file's current
existence based on note text alone.

---

**File vs Memory**

Use **fileVaultTool** for

- PDF
- Image
- Word
- Excel
- ZIP
- Audio
- Video
- Any uploaded document

Use **memoryVaultTool** for

- Notes
- Memories
- Knowledge
- Markdown documents
- Personal records

---

**Multi-tool usage**

If the request involves both notes and files, call both tools.

Example

User:

> Save this boarding pass and remember that it's for my Japan trip.

Tool order

1.

```
fileVaultTool(action="upload")
```

2.

```
memoryVaultTool(action="create")
```

---

**Automatic Metadata Update**

If another tool (such as OCR or Vision) extracts text or structured information from a stored file, update the existing metadata instead of uploading the file again.

Example

```
fileVaultTool(
    action="update",
    file_path="ticket/airasia.pdf",
    extracted_text=...,
    entities=...
)
```

---

**Privacy**

Never access another user's file vault.

If the request refers to another person's unique id or files, do NOT call the tool.

Instead respond:

> "ไม่อนุญาตให้เข้าถึงไฟล์ของคนอื่น เพราะเป็นข้อมูลส่วนตัวนะ"

---

**Restrictions**

- Never fabricate file metadata.
- Never fabricate search results.
- Never claim a file exists without calling the tool.
- Never claim a file was deleted, renamed, or moved unless the tool succeeds.
- **Never claim a file does NOT exist, is missing, or is "no longer in the vault" without
  having called `fileVaultTool` (`search`/`list`/`info`) in the current turn and confirmed no
  match — a note merely mentioning a past attachment is not proof either way.**
- Never confuse `memoryVaultTool` with `fileVaultTool`.
- Never upload a file again when only metadata needs updating.
- Never access another user's vault.
- Always use the current requester's `unique_id`.
- Never describe a previously uploaded file's contents or offer to
  "send it back" without calling `fileVaultTool` (`read`/`info`) again
  in the same turn — history alone does not trigger file delivery.

### Path Synchronization with Memory Vault
If a file's path changes (for example, after a **move**, **rename**, or **delete**
operation via `fileVaultTool`), you must synchronize all references in
`memoryVaultTool`:

1. Move, rename, or delete the file using `fileVaultTool` — `fileVaultTool` is the
   source of truth for the file's current path/filename (or its removal).
   Capture the exact OLD filename/path as it existed immediately before the
   operation.
2. Call `memoryVaultTool(action="search")` (or `list` if scope is unclear) to
   search across ALL notes for any reference matching the file's OLD
   filename/path.
3. Match strictly by the filename/path itself (not just topic or keyword) — use
   the exact old filename as returned by `fileVaultTool` before the operation as
   the matching criterion, to avoid false matches on unrelated notes that merely
   mention a similar topic.
4. For every note with a match, handle it according to the operation type:
   - **Move/rename**: call `memoryVaultTool(action="update")` and replace the
     old path with the NEW path/filename exactly as returned by `fileVaultTool`
     after the move — `fileVaultTool`'s current value always wins; never guess
     or reconstruct the new path yourself.
   - **Delete**: classify the reference before acting —
     a. If the note exists *solely* to reference that file (e.g. a pointer/index
        note with no other independent content) → remove the reference via
        `memoryVaultTool(action="update")`, or delete the note via
        `memoryVaultTool(action="delete")` if removing the reference leaves it
        empty.
     b. If the note contains other independent content and only *mentions* the
        file → call `memoryVaultTool(action="update")` and strip out just the
        stale path/filename reference, leaving the rest intact.
     c. If it's unclear whether the reference is a historical record (e.g. an
        audit trail or changelog entry) versus a live pointer → do NOT delete
        or edit automatically. Flag it for the user to decide.
5. Never leave a stale file path reference in `memoryVault`. If a note references
   a file that no longer matches any current `fileVaultTool` entry, flag it
   rather than silently leaving the broken reference — and never silently delete
   a note without going through step 4's classification first.
6. After processing, report back a summary: which notes were updated, which were
   deleted, and which were flagged for manual review.

### Evidence Linking with Memory Vault

When `memoryVaultTool` returns a note whose topic plausibly has a related file (an expense/bill
note, a trip/ticket note, a document reference, etc.), and the user's question is about that
topic, also call `fileVaultTool(action="search")` to check for a related file before finishing
your answer — do not report only the note content in isolation when a file may also exist.

**This applies even when the note's own text claims the file is missing, was removed, or "is no
longer in the vault." A note is a static text record and cannot know the current state of the
file vault — only a live `fileVaultTool` call can confirm whether a file exists. Treat any such
claim inside a note as unverified and always run the search before repeating it to the user.**

If a match is found and showing it is warranted (the user is asking to confirm something, see a
document, or would reasonably want the file), call `fileVaultTool(action="read")` (or `"info"`
if only metadata is needed) in the same turn to actually deliver the file — see "Returning the
Actual File to the User" above.

Never fabricate the existence of an attached file. Only report or return a file as attached if
`fileVaultTool` actually returns a match. Likewise, never report a file as absent unless
`fileVaultTool` actually returns no match.


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

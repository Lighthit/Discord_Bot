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

**Date rule (important):** If the `action` is `create` or `update`, and either:
- `note_path` will be auto-generated (no `note_path` given on `create`), or
- the `content`/`title` mentions a date (today, a day of week, "this Friday", an event date, etc.),

then you **must call `get_current_date` first** in the same turn, before calling `memoryVaultTool`, and use that result to resolve any relative date and to construct/verify the correct year. Never infer the current year from training knowledge.

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

→ call `memoryVaultTool(unique_id=id, action=<create|read|update|delete|list|search|backlinks>, note_path=..., title=..., content=..., tags=..., query=..., append=...)`

- Only pass the parameters relevant to the chosen `action` (e.g. `list` needs no `note_path`; `search` needs `query`; `create`/`update` need `note_path` and usually `content`).
- Never call `memoryVaultTool` with `action: update` and `append: true` unless the wording clearly implies *adding to* the existing note rather than replacing it.
- Never guess a note's content or a search result without actually calling the tool.
- Never guess the current date/year — always resolve it via `get_current_date` first (see Date rule above).


### Not tools-related

If `input_cmd` is not about toold :

- Do not call any tool
- Answer normally (per the tone/persona defined in `persona.md`)
- Do not mention or not show the id to the user
- Do not recommended to use tools when the user id is not related

## Step 3 — Multi-topic input

If `input_cmd` contains multiple topics → call multiple tools, in the order they're mentioned.

## Step 4 — Error handling

If `check_certificate` or `manageCertFileTool` errors → tell the user directly that the operation failed.

## Restrictions

- Never call `check_certificate` or `manageCertFileTool` just because an id is appended
- Never guess the certificate result or the outcome of a file edit without calling the tool
- Never tell the user an id was appended if that id isn't relevant to their question
- Never call `manageCertFileTool` with `action: edit` unless a `newUrl` is clearly specified in `input_cmd`

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
---
name: tool-routing
description: Use when deciding which tool to call. Input always has an id appended at the end, but that id may or may not be related to certificates.
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

### Not tools-related
If `input_cmd` is not about toold :
- Do not call any tool
- Answer normally
- Do not mention the id to the user

## Step 3 — Multi-topic input

If `input_cmd` contains multiple topics → call multiple tools, in the order they're mentioned.

## Step 4 — Error handling

If `check_certificate` or `manageCertFileTool` errors → tell the user directly that the operation failed.

## Restrictions

- Never call `check_certificate` or `manageCertFileTool` just because an id is appended
- Never guess the certificate result or the outcome of a file edit without calling the tool
- Never tell the user an id was appended if that id isn't relevant to their question
- Never call `manageCertFileTool` with `action: edit` unless a `newUrl` is clearly specified in `input_cmd`
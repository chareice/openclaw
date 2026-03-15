---
name: personal-assistant-product
description: "Use the personal assistant product tools for topic channels and short-term weather. Use when: the user asks to create a topic/channel, or asks for today's/tomorrow's weather. NOT for: historical climate analysis or severe weather alerts."
metadata: { "openclaw": { "always": true } }
---

# Personal Assistant Product Tools

Use these tools when the user is asking for product-native actions.

Knowledge notes live in the app's built-in vault and use an Obsidian-like markdown structure.

## `create_channel`

- Use this only when the user clearly and explicitly asks to create, open, or split out a new topic or channel.
- Do not use this tool just because the user mentions a new subject, asks you to remember something, or starts discussing a different topic.
- Keep the channel name short and literal.
- If the user also names a category, pass it as `category_name`.
- If the tool reports that the channel already exists, tell the user you switched to it.
- Do not claim success unless the tool succeeds.

## `move_channel_to_category`

- Use this only when the user explicitly asks to group, sort, organize, or move an existing topic into a category.
- Pass `channel_name` when the user names a specific topic. If the user is clearly talking about the current topic, you can omit `channel_name`.
- Pass the destination category as `category_name`.
- The tool may create the category if it does not exist yet.
- Do not claim success unless the tool succeeds.

## `get_weather`

- Use this for today's or tomorrow's weather.
- If the user already gave a city, pass it as `location`.
- If the user did not give a city, omit `location` so the tool can try the app's current location.
- If the tool says location is unavailable, ask the user to allow location permission or tell you which city to check.
- Do not use this tool for severe weather alerts, historical data, or climate analysis.

## Knowledge tools

Use these tools for the user's built-in knowledge vault.

### `search_knowledge`

- Use this before reading or appending to an existing note when you do not already know the note id.
- Search with concrete nouns from the user's request.
- If nothing matches, tell the user plainly instead of pretending the note exists.

### `read_knowledge_note`

- Use this after `search_knowledge` or when the user clearly identifies the note.
- Read the note before editing it if the user refers to an existing note's current contents.

### `create_knowledge_note`

- Use this only when the user explicitly asks you to save, capture, create, or start a note.
- Pick a short literal title.
- Use `folder_path` only when the user clearly wants a folder or the location is obvious from context.
- Do not silently create notes just because a message seems useful.

### `append_knowledge_note`

- Use this only when the user explicitly asks to add something to an existing note or save more into a note you already identified.
- Search first if you do not already know the note id.
- Do not claim success unless the tool succeeds.

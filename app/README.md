# Aether

**Aether is a private AI assistant for Android.**

It helps you chat, think, write, research, understand images, and work with files while keeping the core experience local to your phone.

After a one-time model download, normal chat runs on-device. You do not need an account or a backend server to use Aether.

## What Aether Is For

Aether is built for people who want a capable AI assistant without sending every conversation to the cloud.

Use it to:

- Ask questions and get clear answers.
- Draft messages, notes, plans, captions, and code.
- Think through decisions with a patient assistant.
- Analyze photos and documents.
- Research current information when you choose to go online.
- Keep useful personal context on your own device.

## Main Features

### Local AI Chat

Chat with an on-device model that streams replies as it writes. Once a model is downloaded, everyday chat can work offline.

### Fast and Thinking Modes

Choose **Fast** for quick everyday replies or **Thinking** for deeper answers that need more reasoning.

### Image Understanding

Attach a photo from the camera, photo library, or clipboard and ask Aether what is visible. Supported LiteRT models include vision in the same model file.

### File Attachments

Attach supported files so Aether can use them as context in the conversation.

Supported today:

- Images
- PDFs with readable text
- Word `.docx` files
- Plain text, Markdown, CSV, JSON, and XML files

### Research Mode

Turn on **Research** when you want current information. Aether can search the public web, read sources, and write an answer with citations.

Research needs an internet connection. Normal local chat does not.

### Task Mode

Use **Task** for larger requests like making a plan, comparing options, researching a topic, or refining a draft. Aether keeps a simple receipt of what it did so the result is easier to trust.

### Voice Dictation

Use the microphone to dictate your message through the phone's speech recognition service.

### Core Memory

Core can remember useful details from conversations so future replies feel more personal and less repetitive.

You stay in control:

- Core memory is stored locally.
- You can review memories.
- You can edit or delete them.
- You can turn Core off.

### Clarifying Questions

When a request could go several ways, Aether can ask a short question with tappable options before answering.

### Copy Blocks

Code, emails, captions, commands, and other reusable text can appear in dedicated copy blocks for quick copying.

## Privacy

Aether is local-first by design.

- Model inference runs on the phone.
- Conversations are stored on the device.
- Core memory is stored on the device.
- No account is required.
- Web access is used for Research and online Task actions only.

## Requirements

- Android phone
- 8 GB RAM or more recommended
- Around 3 GB free space for a model
- Internet connection for the first model download
- Internet connection for Research and online Task actions

## Current App

- Version: `2.1.0`
- Active model engine: LiteRT `.litertlm`
- Latest APK in this workspace: `../releases/Aether-2.1.0-latest.apk`

Do not bring back the old `llama.rn`, GGUF, separate `mmproj`, or separate vision-pack setup. Aether's active mobile engine is LiteRT.

# Current Phase Plan (LDA) — Phase 2: Agent Core

> **Current Version**: LDA.1.5.0 (Phase 1 Complete)
> **Next Milestone**: LDA.2.1.0

## Goal
Transition from infrastructure setup to core agent capabilities. This phase focuses on building the "Brain" of the Level Design Agent using the `langchain` / `langgraph` framework.

## Phase 2 Roadmap

- [ ] **LDA.2.1.0: Agent Skeleton**
    - [ ] Initialize `agent` package (TypeScript).
    - [ ] Install `langgraph`, `langchain`, `@langchain/openai`.
    - [ ] Create basic "ReAct" style agent loop.
    - [ ] Hardcoded "Hello World" tool.

- [ ] **LDA.2.2.0: Knowledge Base Integration**
    - [ ] Tool: `search_knowledge_base` (RAG stub or simple embedding search).
    - [ ] Connect to `shared` types for domain models.

- [ ] **LDA.2.3.0: Level Generation (Mock)**
    - [ ] Tool: `generate_level_layout`.
    - [ ] Define standardized JSON schema for Levels.

- [ ] **LDA.2.4.0: Image Generation Integration**
    - [ ] Tool: `generate_texture` (using Fal.ai / Meshy / Rodin secrets).
    - [ ] Connect to `worker` for async generation tasks.

- [ ] **LDA.2.5.0: Web Chat Interface**
    - [ ] Add Chat UI to `web` (React).
    - [ ] WebSocket / SSE connection to `api` for streaming agent responses.

## Key Technical Decisions
- **Framework**: LangGraph for stateful, multi-turn agent orchestration.
- **State Persistence**: Use Postgres (`agent_state` table) to persist conversation history.
- **Model**: start with `gpt-4o` or `gemini-1.5-pro`.

## Definition of Done (Phase 2)
- [ ] Agent can hold a conversation about level design.
- [ ] Agent can invoke tools to "generate" (mock) data.
- [ ] Agent state is persisted across server restarts.
- [ ] A web interface exists to chat with the agent.

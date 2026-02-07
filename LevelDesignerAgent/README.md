# Level Design Agent (LDA)

The Level Design Agent is an AI-powered tool for generating game levels, assets, and narratives. It features a node-based flow editor, execution engine, and asset library.

## Features
- **Flow Editor**: Visual interface to design generation pipelines.
- **Execution Engine**: Robust worker for running flows with branching and loops.
- **Asset Library**: Browse and manage generated assets (Text, Images, 3D Models).
- **AI Integration**: Support for OpenAI, Fal.ai, and Meshy.

## Architecture
- **Web**: React + Vite frontend.
- **API**: Fastify + Node.js backend.
- **Worker**: Node.js background worker for heavy tasks.
- **Shared**: Common types and utilities.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL (Neon or local)

### Setup
1.  **Install Dependencies**
    ```bash
    pnpm install
    ```

2.  **Environment Variables**
    cp .env.example .env
    # Fill in DATABASE_URL, OPENAI_API_KEY, etc.

3.  **Run Development**
    ```bash
    pnpm dev
    ```
    - Web: http://localhost:5173
    - API: http://localhost:3001

## Documentation
- [API Documentation](api/README.md)
- [Worker Documentation](worker/README.md)

## License
MIT

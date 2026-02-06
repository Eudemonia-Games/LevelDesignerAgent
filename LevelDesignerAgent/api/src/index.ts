import { buildServer } from './server';
import { runMigrations } from './db/migrations';

const start = async () => {
    // Run DB migrations
    await runMigrations();

    const server = await buildServer();
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

    try {
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`API server listening on port ${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();

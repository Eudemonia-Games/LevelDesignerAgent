import { FastifyInstance } from 'fastify';
import { SecretsService } from '../secrets/service';

interface SetSecretBody {
    value: string;
}

interface SetSecretParams {
    key: string;
}

export async function secretsRoutes(server: FastifyInstance) {
    // GET /admin/secrets - List all secrets (masked)
    server.get('/admin/secrets', async (req, reply) => {
        try {
            const secrets = await SecretsService.getAllSecrets();
            return { ok: true, secrets };
        } catch (err: any) {
            req.log.error(err);
            return reply.code(500).send({ ok: false, error: "internal_error" });
        }
    });

    // PUT /admin/secrets/:key - Set a secret
    server.put<{ Params: SetSecretParams; Body: SetSecretBody }>('/admin/secrets/:key', async (req, reply) => {
        const { key } = req.params;
        const { value } = req.body;

        try {
            const result = await SecretsService.setSecret(key, value);
            return { ok: true, secret: result };
        } catch (err: any) {
            if (err.message.includes("Unknown secret key")) {
                return reply.code(400).send({ ok: false, error: "unknown_key" });
            }
            if (err.message.includes("Value cannot be empty")) {
                return reply.code(400).send({ ok: false, error: "empty_value" });
            }

            req.log.error(err);
            return reply.code(500).send({ ok: false, error: "internal_error" });
        }
    });
}

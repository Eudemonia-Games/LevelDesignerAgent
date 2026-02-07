import { FastifyInstance } from 'fastify';
import { TestProviderRequest } from '@lda/shared';
import { JobsDb } from '../db/jobs';

export const adminRoutes = async (server: FastifyInstance) => {

    server.post<{ Body: TestProviderRequest }>('/admin/test-provider', async (req, reply) => {
        const { provider, prompt, model, options } = req.body;

        if (!provider || !prompt) {
            return reply.code(400).send({ ok: false, error: "Missing provider or prompt" });
        }

        try {
            const job = await JobsDb.createJob('test_provider_call', {
                provider,
                prompt,
                model,
                options
            });

            return reply.send({ ok: true, jobId: job.id });
        } catch (e: any) {
            req.log.error(e);
            return reply.code(500).send({ ok: false, error: e.message });
        }
    });

    server.get<{ Params: { jobId: string } }>('/admin/test-provider/:jobId', async (req, reply) => {
        const { jobId } = req.params;

        const job = await JobsDb.getJob(jobId);
        if (!job) {
            return reply.code(404).send({ ok: false, error: "Job not found" });
        }

        return reply.send({
            ok: true,
            status: job.status,
            result: job.result,
            error: job.error
        });
    });
};

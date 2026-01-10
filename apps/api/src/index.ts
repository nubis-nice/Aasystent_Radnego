import 'dotenv/config';
import Fastify from 'fastify';

const port = Number(process.env.API_PORT ?? 3001);

const app = Fastify({
  logger: true,
});

app.get('/health', async () => {
  return { status: 'ok' };
});

app.listen({ port, host: '0.0.0.0' }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});

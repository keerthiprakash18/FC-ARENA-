import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttpSecurity } from './security/http-security.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureHttpSecurity(app);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);

  console.log('');
  console.log('============================================');
  console.log(' FC ARENA API STARTED');
  console.log(` API:    http://${host}:${port}/api`);
  console.log(` Health: http://${host}:${port}/api/health`);
  console.log('============================================');
  console.log('');
}

void bootstrap();

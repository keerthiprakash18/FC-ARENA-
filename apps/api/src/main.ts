import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureHttpSecurity } from './security/http-security.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureHttpSecurity(app);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);

  await app.listen(port);

  console.log('');
  console.log('============================================');
  console.log(' FC ARENA API STARTED');
  console.log(` API:    http://localhost:${port}/api`);
  console.log(` Health: http://localhost:${port}/api/health`);
  console.log('============================================');
  console.log('');
}

void bootstrap();
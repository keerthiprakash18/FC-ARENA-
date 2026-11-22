import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../apps/api/dist/app.module.js';
import { OcrProcessor } from '../apps/api/dist/ocr/ocr.processor.js';

const db=new URL(process.env.DATABASE_URL ?? '');
if(process.env.NODE_ENV!=='test'||!db.pathname.endsWith('_test')||!['localhost','127.0.0.1','[::1]'].includes(db.hostname)||!process.send) {
  throw Error('Disposable loopback test child process required');
}
const app=await NestFactory.create(AppModule,{logger:false});
app.setGlobalPrefix('api');
app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true,forbidNonWhitelisted:true}));
app.enableShutdownHooks();
await app.init();await app.get(OcrProcessor).worker.close();
await app.listen(0,'127.0.0.1');
process.send({port:app.getHttpServer().address().port});

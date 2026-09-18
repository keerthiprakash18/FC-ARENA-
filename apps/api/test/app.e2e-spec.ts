import {
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';

import {
  Test,
  type TestingModule,
} from '@nestjs/testing';

import request from 'supertest';

import {
  AppModule,
} from '../src/app.module.js';

describe(
  'FC ARENA API (e2e)',
  () => {
    let app:
      INestApplication;

    beforeAll(
      async () => {
        const moduleFixture:
          TestingModule =
          await Test.createTestingModule({
            imports: [
              AppModule,
            ],
          }).compile();

        app =
          moduleFixture.createNestApplication();

        app.setGlobalPrefix(
          'api',
        );

        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted:
              true,
          }),
        );

        await app.init();
      },
      30_000,
    );

    afterAll(
      async () => {
        await app.close();
      },
      30_000,
    );

    it(
      '/api/health (GET)',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .get(
              '/api/health',
            )
            .expect(
              200,
            );

        expect(
          response.body,
        ).toBeDefined();
      },
    );

    it(
      '/api/notifications rejects anonymous users',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/notifications',
          )
          .expect(
            401,
          );
      },
    );

    it(
      '/ root is intentionally not exposed',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/',
          )
          .expect(
            404,
          );
      },
    );
  },
);
import { type INestApplication } from '@nestjs/common';

import {
  Test,
  type TestingModule,
} from '@nestjs/testing';

import request from 'supertest';

import {
  AppModule,
} from '../src/app.module.js';
import { configureHttpSecurity } from '../src/security/http-security.js';

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

        configureHttpSecurity(app);

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

    it('/api/health/live does not require dependencies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health/live')
        .set('X-Request-Id', 'health-live-test')
        .expect(200);

      expect(response.body.data.status).toBe('alive');
      expect(response.body.data.runtime).toBeUndefined();
      expect(response.body.data.telemetry).toBeUndefined();
      expect(response.headers['x-request-id']).toBe('health-live-test');
    });

    it('/api/health/ready exposes dependency readiness', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(200);

      expect(response.body.data.checks.database.status).toBe('connected');
    });

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

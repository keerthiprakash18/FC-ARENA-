const {
  test,
} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function moduleWithFetch(fetchImpl) {
  const output = {};
  const code = ts.transpileModule(
    fs.readFileSync(
      'apps/web/src/lib/api.ts',
      'utf8',
    ),
    {
      compilerOptions: {
        module:
          ts.ModuleKind.CommonJS,
        target:
          ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  vm.runInNewContext(
    code,
    {
      exports:
        output,
      require:
        () => ({}),
      process: {
        env: {
          NODE_ENV:
            'test',
          NEXT_PUBLIC_API_URL:
            'http://localhost:4000/api',
        },
      },
      fetch:
        fetchImpl,
      Response,
      AbortController,
      AbortSignal,
      DOMException,
      setTimeout,
      clearTimeout,
      Promise,
      Error,
      Set,
    },
  );

  return output;
}

test(
  'GET retries one transient 503 and then succeeds',
  async () => {
    let calls =
      0;

    const api =
      moduleWithFetch(
        async () => {
          calls++;

          return calls ===
            1
            ? new Response(
                JSON.stringify({
                  error: {
                    code:
                      'TEMP',
                    message:
                      'temporary',
                  },
                }),
                {
                  status:
                    503,
                  headers: {
                    'content-type':
                      'application/json',
                  },
                },
              )
            : new Response(
                JSON.stringify({
                  success:
                    true,
                }),
                {
                  status:
                    200,
                  headers: {
                    'content-type':
                      'application/json',
                  },
                },
              );
        },
      );

    const result =
      await api.apiRequest(
        '/health',
      );

    assert.equal(
      calls,
      2,
    );

    assert.equal(
      result.success,
      true,
    );
  },
);

test(
  'mutation does not replay after a network failure',
  async () => {
    let calls =
      0;

    const api =
      moduleWithFetch(
        async () => {
          calls++;

          throw new TypeError(
            'offline',
          );
        },
      );

    await assert.rejects(
      api.apiRequest(
        '/matches/example/results',
        {
          method:
            'POST',
          body:
            '{}',
        },
      ),
      (
        error,
      ) =>
        error.code ===
        'NETWORK_UNAVAILABLE',
    );

    assert.equal(
      calls,
      1,
    );
  },
);

test(
  'GET retries a network failure once',
  async () => {
    let calls =
      0;

    const api =
      moduleWithFetch(
        async () => {
          calls++;

          if (
            calls ===
            1
          ) {
            throw new TypeError(
              'offline',
            );
          }

          return new Response(
            JSON.stringify({
              success:
                true,
            }),
            {
              status:
                200,
              headers: {
                'content-type':
                  'application/json',
              },
            },
          );
        },
      );

    await api.apiRequest(
      '/leagues/my',
    );

    assert.equal(
      calls,
      2,
    );
  },
);

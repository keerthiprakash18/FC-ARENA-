'use client';

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

interface AiStatus {
  enabled: boolean;
  configured: boolean;
  mode: 'READ_ONLY';
  limits: {
    perMinute: number;
    perDay: number;
  };
}

interface ChatMessage {
  id: string;
  role:
    | 'user'
    | 'assistant';
  content: string;
}

const quickQuestions = [
  'What is my next match?',
  'Show my current leagues.',
  'Explain my recent stats.',
  'How do I submit a match result?',
] as const;

export default function AiPage() {
  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    status,
    setStatus,
  ] =
    useState<AiStatus | null>(
      null,
    );

  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>([]);

  const [
    input,
    setInput,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          statusResponse,
        ] =
          await Promise.all([
            getCurrentUser(),
            authenticatedRequest<{
              success: true;
              data: AiStatus;
              error: null;
            }>('/ai/status'),
          ]);

        setUser(
          current,
        );

        setStatus(
          statusResponse.data,
        );
      } catch {
        router.replace(
          '/login',
        );
      } finally {
        setLoading(
          false,
        );
      }
    })();
  }, [
    router,
  ]);

  const playerName =
    useMemo(
      () =>
        user?.player
          ?.identity
          ?.inGameName ||
        user?.fullName ||
        'FC ARENA Player',
      [
        user,
      ],
    );

  async function ask(
    rawQuestion: string,
  ) {
    const question =
      rawQuestion
        .trim()
        .slice(
          0,
          1000,
        );

    if (
      !question ||
      sending ||
      !status?.enabled
    ) {
      return;
    }

    const userMessage:
      ChatMessage = {
        id:
          `user-${Date.now()}`,
        role:
          'user',
        content:
          question,
      };

    const history =
      messages
        .slice(
          -6,
        )
        .map(
          (message) => ({
            role:
              message.role,
            content:
              message.content,
          }),
        );

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ],
    );

    setInput('');
    setError('');
    setSending(true);

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            answer: string;
            generatedAt: string;
            mode: 'READ_ONLY';
          };
          error: null;
        }>('/ai/chat', {
          method:
            'POST',

          body:
            JSON.stringify({
              message:
                question,
              history,
            }),
        });

      setMessages(
        (current) => [
          ...current,
          {
            id:
              `assistant-${Date.now()}`,
            role:
              'assistant',
            content:
              response.data.answer,
          },
        ],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach FC ARENA AI.',
      );
    } finally {
      setSending(false);
    }
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void ask(
      input,
    );
  }

  if (
    loading ||
    !user ||
    !status
  ) {
    return (
      <FcLoadingScreen
        label="Loading FC ARENA AI..."
      />
    );
  }

  return (
    <AppShell
      playerName={
        playerName
      }
    >
      <div className="space-y-6">
        <FcPageHeader
          eyebrow="Read-only assistant"
          title="FC ARENA AI"
          subtitle="Ask about FC ARENA workflows, your leagues, tournaments, upcoming fixtures and verified statistics. The assistant cannot change competition data."
          action={
            <FcStatusBadge
              label={
                status.enabled
                  ? 'AI Ready'
                  : 'Not Configured'
              }
              tone={
                status.enabled
                  ? 'emerald'
                  : 'slate'
              }
            />
          }
        />

        {!status.enabled ? (
          <FcPanel className="p-5 sm:p-6">
            <h2 className="theme-text text-lg font-semibold">
              AI Assistant is safely disabled
            </h2>

            <p className="theme-secondary-text mt-2 text-sm leading-6">
              The FC ARENA AI module is installed, but the server-side AI provider has not been enabled. Existing FC ARENA features continue to work normally.
            </p>
          </FcPanel>
        ) : (
          <>
            <FcPanel className="p-4 sm:p-5">
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map(
                  (question) => (
                    <button
                      key={
                        question
                      }
                      type="button"
                      disabled={
                        sending
                      }
                      onClick={() =>
                        void ask(
                          question,
                        )
                      }
                      className="theme-secondary-button min-h-10 rounded-[10px] border px-3.5 text-sm font-medium transition disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ),
                )}
              </div>
            </FcPanel>

            <FcPanel className="min-h-[420px] p-4 sm:p-5">
              <div className="space-y-3">
                {messages.length ===
                0 ? (
                  <div className="theme-secondary-text grid min-h-[250px] place-items-center text-center text-sm leading-6">
                    <div>
                      <p className="theme-text text-base font-semibold">
                        Ask FC ARENA AI
                      </p>

                      <p className="mt-2 max-w-lg">
                        Example: “What is my next match?” or “How does result verification work?”
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map(
                    (message) => (
                      <div
                        key={
                          message.id
                        }
                        className={
                          message.role ===
                          'user'
                            ? 'ml-auto max-w-[88%] rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm leading-6'
                            : 'theme-panel max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-6'
                        }
                      >
                        <p className="whitespace-pre-wrap">
                          {
                            message.content
                          }
                        </p>
                      </div>
                    ),
                  )
                )}

                {sending ? (
                  <div className="theme-panel max-w-[92%] rounded-2xl border px-4 py-3 text-sm">
                    Thinking...
                  </div>
                ) : null}
              </div>
            </FcPanel>

            {error ? (
              <FcErrorState
                message={
                  error
                }
              />
            ) : null}

            <FcPanel className="p-4 sm:p-5">
              <form
                onSubmit={
                  submit
                }
                className="space-y-3"
              >
                <label
                  htmlFor="ai-question"
                  className="theme-text text-sm font-semibold"
                >
                  Your question
                </label>

                <textarea
                  id="ai-question"
                  value={
                    input
                  }
                  maxLength={
                    1000
                  }
                  rows={
                    3
                  }
                  disabled={
                    sending
                  }
                  onChange={(
                    event,
                  ) =>
                    setInput(
                      event.target.value,
                    )
                  }
                  placeholder="Ask about your next match, league, tournament, stats or an FC ARENA workflow..."
                  className="theme-input w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none disabled:opacity-60"
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="theme-muted text-xs">
                    Read-only • {status.limits.perDay} questions/day • no competition data changes
                  </p>

                  <button
                    type="submit"
                    disabled={
                      sending ||
                      !input.trim()
                    }
                    className="theme-primary-button min-h-11 rounded-[10px] px-5 text-sm font-semibold transition disabled:opacity-50"
                  >
                    {sending
                      ? 'Sending...'
                      : 'Ask AI'}
                  </button>
                </div>
              </form>
            </FcPanel>
          </>
        )}
      </div>
    </AppShell>
  );
}

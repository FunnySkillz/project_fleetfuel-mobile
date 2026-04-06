import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedFleetError } from '@/shared-fleet/errors';
import { authRepo } from '@/shared-fleet/repos/auth-repo';

const mockAuth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  setSession: vi.fn(),
};

vi.mock('@/shared-fleet/supabase/client', () => ({
  getSharedSupabaseClient: () => ({
    auth: mockAuth,
  }),
}));

function createMockSession(id: string): Session {
  return {
    access_token: `access-${id}`,
    refresh_token: `refresh-${id}`,
    expires_in: 3600,
    expires_at: 1_700_000_000,
    token_type: 'bearer',
    user: {
      id,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: `${id}@example.com`,
    },
  } as Session;
}

describe('auth repo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs up with email and password', async () => {
    const session = createMockSession('signup');
    mockAuth.signUp.mockResolvedValueOnce({ data: { session }, error: null });

    const result = await authRepo.signUp({ email: 'TEST@EXAMPLE.COM', password: 'password123' });

    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result).toEqual(session);
  });

  it('maps invalid credentials to shared_invalid_credentials', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    });

    await expect(authRepo.signIn({ email: 'a@b.com', password: 'password123' })).rejects.toMatchObject({
      code: 'shared_invalid_credentials',
    });
  });

  it('supports sign out', async () => {
    mockAuth.signOut.mockResolvedValueOnce({ error: null });

    await authRepo.signOut();

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it('restores session', async () => {
    const session = createMockSession('restore');
    mockAuth.getSession.mockResolvedValueOnce({ data: { session }, error: null });

    const result = await authRepo.getSession();

    expect(result).toEqual(session);
  });

  it('hydrates deep-link access token callback', async () => {
    mockAuth.setSession.mockResolvedValueOnce({ data: { session: null }, error: null });

    const handled = await authRepo.handleDeepLinkCallback(
      'fleetfuel://shared#access_token=abc&refresh_token=def&token_type=bearer',
    );

    expect(handled).toBe(true);
    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'abc', refresh_token: 'def' });
  });

  it('validates password length before sign-in', async () => {
    await expect(authRepo.signIn({ email: 'user@example.com', password: 'short' })).rejects.toBeInstanceOf(SharedFleetError);
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });
});

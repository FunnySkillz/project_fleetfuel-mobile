import type { Session } from '@supabase/supabase-js';

import { authRepo } from '@/shared-fleet/repos';

export async function signInSharedUser(input: { email: string; password: string }): Promise<Session | null> {
  return authRepo.signIn(input);
}

export async function signUpSharedUser(input: { email: string; password: string }): Promise<Session | null> {
  return authRepo.signUp(input);
}

export async function signOutSharedUser(): Promise<void> {
  await authRepo.signOut();
}

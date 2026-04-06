import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createRequestClient(authHeader: string): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export async function requireAuthenticatedUser(request: Request): Promise<User> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    throw new Error('missing_authorization');
  }

  const requestClient = createRequestClient(authorization);
  const { data, error } = await requestClient.auth.getUser();

  if (error || !data.user) {
    throw new Error('unauthorized');
  }

  return data.user;
}

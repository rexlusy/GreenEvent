import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { cookieOptions, supabaseConfig } from "./env.js";

export const getSupabase = cache(async () => {
  const config = supabaseConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: cookieOptions(),
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) jar.set(name, value, options);
        } catch {
          // A Server Component can only read cookies. Proxy persists token refreshes.
        }
      },
    },
  });
});

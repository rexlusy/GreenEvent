import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookieOptions, supabaseConfig } from "./lib/env.js";

export async function proxy(request) {
  const config = supabaseConfig();
  let response = NextResponse.next({ request });
  if (!config || !request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))) {
    return response;
  }
  const db = createServerClient(config.url, config.key, {
    cookieOptions: cookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers = {}) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });
  await db.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|fonts/|images/).*)"],
};

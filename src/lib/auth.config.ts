import type { NextAuthConfig } from "next-auth";

export default {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
} satisfies NextAuthConfig;

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/validations/auth";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/models/user";
import { verifyPassword } from "./password";
import { consumeRateLimit } from "./rate-limit";
export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        if (!(await consumeRateLimit(`login:${parsed.data.email}`, 10)))
          return null;
        await connectDB();
        const user = await User.findOne({ email: parsed.data.email }).select(
          "+passwordHash",
        );
        const valid = await verifyPassword(
          parsed.data.password,
          user?.passwordHash,
        );
        if (!user || !valid || !user.isActive) return null;
        return { id: user._id.toString(), name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      if (!token.sub) return null;
      await connectDB();
      const current = await User.findById(token.sub)
        .select("name email isActive")
        .lean();
      if (!current?.isActive) return null;
      token.name = current.name;
      token.email = current.email;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

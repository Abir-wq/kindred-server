
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { jwt } from "better-auth/plugins";
import {
  createAuthMiddleware,
  APIError,
} from "better-auth/api";

export function createAuth(database, client) {
  const secret = process.env.BETTER_AUTH_SECRET;

  const baseURL =
    process.env.BETTER_AUTH_URL ||
    "http://localhost:5000";

  if (!secret || secret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must contain at least 32 characters."
    );
  }

  return betterAuth({
    appName: "Kindred",

    baseURL,

    secret,

    trustedOrigins: [
      process.env.CLIENT_URL || "http://localhost:3000",
    ],

    database: mongodbAdapter(database, {
      client,
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 6,
      maxPasswordLength: 128,
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") {
          return;
        }

        const password = ctx.body?.password;

        if (
          typeof password !== "string" ||
          password.length < 6 ||
          password.length > 128 ||
          !/[a-z]/.test(password) ||
          !/[A-Z]/.test(password)
        ) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Password must contain at least 6 characters, including one uppercase and one lowercase letter.",
          });
        }
      }),
    },

    plugins: [
      jwt(),
    ],
  });
}

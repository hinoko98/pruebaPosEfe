import type { LoginInput, LoginResult, CreateUserInput } from "~/main/electron/ipc/schemas/auth.schema";

declare global {
  interface Window {
    api: {
      login: (payload: LoginInput) => Promise<LoginResult>;
      createUser: (payload: CreateUserInput) => Promise<{ success: boolean; message?: string }>;
    };
  }
}

export {};

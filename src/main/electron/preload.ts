import { contextBridge, ipcRenderer } from "electron";
import type { LoginInput, LoginResult, CreateUserInput } from "./ipc/schemas/auth.schema";

contextBridge.exposeInMainWorld("api", {
  login: (payload: LoginInput): Promise<LoginResult> =>
    ipcRenderer.invoke("auth:login", payload),

  createUser: (payload: CreateUserInput): Promise<{ success: boolean; message?: string }> =>
    ipcRenderer.invoke("auth:createUser", payload),
});

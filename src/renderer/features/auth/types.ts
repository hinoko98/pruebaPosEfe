export type Role = "ADMIN" | "EMPLOYEE";

export type AuthUser = {
  id: string;
  username: string;
  name?: string;
  role: Role;
};

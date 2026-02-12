export type Role = 'ADMIN' | 'EMPLOYEE';

export type AuthUser = {
  id: string;
  name: string;
  role: Role;
};

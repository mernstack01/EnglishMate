export type Role = "USER" | "ADMIN";
export type Language = "UZ" | "EN";
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  preferredLanguage: Language;
}

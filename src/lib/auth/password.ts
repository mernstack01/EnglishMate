import { compare, hash } from "bcryptjs";
export const hashPassword = (password: string) => hash(password, 12);
// Match password work for nonexistent accounts to reduce account enumeration by timing.
const dummyHash =
  "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
export const verifyPassword = (password: string, hash?: string) =>
  compare(password, hash ?? dummyHash);

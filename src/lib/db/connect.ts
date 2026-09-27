import mongoose from "mongoose";
// One pool per process, including across development hot reloads.
const globalDb = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};
export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri)
    throw new Error(
      "MONGODB_URI is required. Configure .env.local before starting EnglishMate.",
    );
  if (!globalDb.mongooseConnection || mongoose.connection.readyState === 0) {
    globalDb.mongooseConnection = mongoose
      .connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        autoIndex: process.env.NODE_ENV !== "production",
      })
      .catch((error: unknown) => {
        globalDb.mongooseConnection = undefined;
        throw error;
      });
  }
  return globalDb.mongooseConnection;
}

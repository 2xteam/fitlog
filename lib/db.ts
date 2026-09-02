import dns from "node:dns";
import mongoose from "mongoose";

/** 일부 Windows/공유기 환경에서 SRV 조회 이슈 완화 */
dns.setDefaultResultOrder("ipv4first");

const MONGODB_URI = process.env.MONGO_URI;

/**
 * 이 앱의 데이터가 들어갈 DB 이름.
 *
 * URI 뒤에 붙은 경로(`.../fit`)에 의존하지 않고 **명시적으로 지정**한다.
 * 다른 앱의 연결 문자열을 그대로 붙여 넣으면 URI 경로가 다른 DB를 가리켜
 * 조용히 엉뚱한 DB에 쓰기 때문이다. (2026-09-02 FitLog가 `math` DB에
 * measurements 를 쓰던 사고)
 */
const MONGODB_DB = (process.env.MONGO_DB ?? "fit").trim() || "fit";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseCache?: MongooseCache;
};

function getCache(): MongooseCache {
  if (!globalForMongoose._mongooseCache) {
    globalForMongoose._mongooseCache = { conn: null, promise: null };
  }
  return globalForMongoose._mongooseCache;
}

/**
 * 서버리스/핫리로드 환경에서도 연결을 재사용합니다.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGO_URI 환경 변수가 설정되지 않았습니다.");
  }

  const cached = getCache();
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
      serverSelectionTimeoutMS: 25_000,
      connectTimeoutMS: 20_000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }
}

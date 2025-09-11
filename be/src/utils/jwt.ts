import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string || "db88f91f79860a5251f217d5";
const REFRESH_SECRET = process.env.REFRESH_SECRET as string || "181e6776b5714ba564e54fd9";

export const generateToken = (userid: string, type: string): string => {
  if (type !== "access" && type !== "refresh") {
    throw new Error("Invalid token type. Use 'access' or 'refresh'.");
  }
  const secret = type === "access" ? JWT_SECRET : REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return jwt.sign({ userid }, secret, {
    expiresIn: type === "access" ? "1d" : "7d",
  });
};

export const verifyJWT = (
  token: string,
  type: string
): string | jwt.JwtPayload => {
  const secret = type === "access" ? JWT_SECRET : REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  try {
    const decoded = jwt.verify(token, secret);
    const { userid } = decoded as { userid: string };
    return userid;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
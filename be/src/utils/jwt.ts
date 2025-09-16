import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string || "db88f91f79860a5251f217d5";
// const REFRESH_SECRET = process.env.REFRESH_SECRET as string || "181e6776b5714ba564e54fd9";

export const generateToken = (userid: string): string => {
  const secret = JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  return jwt.sign({ userid }, secret, {
    expiresIn: "1d",
  });
};

export const verifyJWT = (
  token: string,
): string | jwt.JwtPayload => {
  const secret = JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  try {
    const decoded = jwt.verify(token, secret);
    const userName = decoded as string;
    return userName;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};
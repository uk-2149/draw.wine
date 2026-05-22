import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwt_secret } from "../constants";

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, jwt_secret) as { wallet: string };
      req.walletAddress = decoded.wallet;
    } catch (err) {
      // Token is invalid, but we allow fallback to anonymous/IP
      // If we wanted strict auth, we would return 401 here.
    }
  }

  next();
};

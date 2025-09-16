"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJWT = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "db88f91f79860a5251f217d5";
// const REFRESH_SECRET = process.env.REFRESH_SECRET as string || "181e6776b5714ba564e54fd9";
const generateToken = (userid) => {
    const secret = JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not defined");
    }
    return jsonwebtoken_1.default.sign({ userid }, secret, {
        expiresIn: "1d",
    });
};
exports.generateToken = generateToken;
const verifyJWT = (token) => {
    const secret = JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not defined");
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const userName = decoded;
        return userName;
    }
    catch (error) {
        throw new Error("Invalid or expired token");
    }
};
exports.verifyJWT = verifyJWT;

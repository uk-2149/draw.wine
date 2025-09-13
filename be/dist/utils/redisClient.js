"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sub = exports.pub = void 0;
const redis_1 = require("redis");
const redisClient = (0, redis_1.createClient)();
redisClient.connect();
// Publisher client
const pub = redisClient.duplicate();
exports.pub = pub;
pub.connect();
// Subscriber client
const sub = redisClient.duplicate();
exports.sub = sub;
sub.connect();
exports.default = redisClient;

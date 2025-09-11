import { createClient } from "redis";

const redisClient = createClient();
redisClient.connect();

// Publisher client
const pub = redisClient.duplicate();
pub.connect();

// Subscriber client
const sub = redisClient.duplicate();
sub.connect();

export { pub, sub };

export default redisClient;
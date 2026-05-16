import { initServer } from ".";
import { Logger } from "./helpers";

initServer().catch((err) => Logger.error("Failed to start server:", err));

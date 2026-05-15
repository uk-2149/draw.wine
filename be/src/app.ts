import { initServer } from ".";
import { Logger } from "./helpers/ext.h";

initServer().catch((err) => Logger.error("Failed to start server:", err));

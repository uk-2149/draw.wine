import type { ChatSession } from "@google/generative-ai";
import { Logger } from "../helpers/ext.h";

interface SessionData {
  chat: ChatSession;
  createdAt: number;
  lastAccessedAt: number;
}

class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create a chat session for a sessionId
   */
  getOrCreateSession(
    sessionId: string,
    createFn: () => ChatSession,
  ): ChatSession {
    const existing = this.sessions.get(sessionId);

    if (existing) {
      // Update last accessed time
      existing.lastAccessedAt = Date.now();
      Logger.debug(`[SessionManager] Reusing existing session: ${sessionId}`);
      return existing.chat;
    }

    // Create new session
    const chat = createFn();
    const now = Date.now();
    this.sessions.set(sessionId, {
      chat,
      createdAt: now,
      lastAccessedAt: now,
    });

    Logger.info(`[SessionManager] Created new session: ${sessionId}`);

    // Cleanup old sessions
    this.cleanupExpiredSessions();

    return chat;
  }

  /**
   * Clear a specific session
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    Logger.info(`[SessionManager] Cleared session: ${sessionId}`);
  }

  /**
   * Remove all expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let count = 0;

    for (const [sessionId, data] of this.sessions.entries()) {
      if (now - data.lastAccessedAt > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    if (count > 0) {
      Logger.debug(`[SessionManager] Cleaned up ${count} expired sessions`);
    }
  }

  /**
   * Get session stats for monitoring
   */
  getStats(): { activeSessions: number; totalMemoryUsage: string } {
    return {
      activeSessions: this.sessions.size,
      totalMemoryUsage: `~${(this.sessions.size * 50).toLocaleString()} KB`, // rough estimate
    };
  }
}

export default new SessionManager();

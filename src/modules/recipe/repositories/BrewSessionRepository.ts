'use client';

/**
 * BrewSessionRepository
 *
 * Manages brew session persistence in localStorage.
 * Sessions track actual brew days and measurements.
 */

import { devError } from '@/utils/logger';
import type { BrewSession, SessionId } from '../models/BrewSession';

export class BrewSessionRepository {
  private readonly STORAGE_KEY = 'beer-brew-sessions-v1';

  /**
   * Load all sessions from storage
   */
  loadAll(): BrewSession[] {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (!json) return [];

      const sessions = JSON.parse(json) as BrewSession[];
      return sessions;
    } catch (error) {
      devError('Failed to load brew sessions:', error);
      return [];
    }
  }

  /**
   * Load a single session by ID
   */
  loadById(id: SessionId): BrewSession | null {
    try {
      const sessions = this.loadAll();
      return sessions.find((s) => s.id === id) ?? null;
    } catch (error) {
      devError('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Load all sessions for a specific recipe
   */
  loadByRecipeId(recipeId: string): BrewSession[] {
    try {
      const sessions = this.loadAll();
      return sessions
        .filter((s) => s.recipeId === recipeId)
        .sort((a, b) => new Date(b.brewDate).getTime() - new Date(a.brewDate).getTime());
    } catch (error) {
      devError('Failed to load sessions for recipe:', error);
      return [];
    }
  }

  /**
   * Save a session (create or update)
   */
  save(session: BrewSession): void {
    try {
      const sessions = this.loadAll();
      const existingIndex = sessions.findIndex((s) => s.id === session.id);

      if (existingIndex >= 0) {
        // Update existing
        sessions[existingIndex] = session;
      } else {
        // Add new
        sessions.push(session);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      devError('Failed to save session:', error);
      throw new Error('Could not save brew session. Storage may be full.');
    }
  }

  /**
   * Delete a session
   */
  delete(id: SessionId): void {
    try {
      const sessions = this.loadAll();
      const filtered = sessions.filter((s) => s.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      devError('Failed to delete session:', error);
      throw new Error('Could not delete brew session.');
    }
  }

  /**
   * Delete all sessions for a recipe (when recipe is deleted)
   */
  deleteByRecipeId(recipeId: string): void {
    try {
      const sessions = this.loadAll();
      const filtered = sessions.filter((s) => s.recipeId !== recipeId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      devError('Failed to delete sessions for recipe:', error);
      throw new Error('Could not delete sessions.');
    }
  }

  /**
   * Delete all sessions (for testing/reset)
   */
  deleteAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      devError('Failed to clear sessions:', error);
    }
  }

  /**
   * Get session count for a recipe
   */
  getSessionCount(recipeId: string): number {
    const sessions = this.loadByRecipeId(recipeId);
    return sessions.length;
  }
}

// Export singleton instance
export const brewSessionRepository = new BrewSessionRepository();

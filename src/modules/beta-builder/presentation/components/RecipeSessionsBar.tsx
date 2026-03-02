/**
 * Recipe Sessions Bar
 *
 * Collapsible bar showing brew sessions for a recipe.
 * Displays under recipe cards in the list view.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { BrewSession } from "../../domain/models/BrewSession";
import { useBrewSessionStore } from "../stores/brewSessionStore";

interface RecipeSessionsBarProps {
  recipeId: string;
}

export default function RecipeSessionsBar({
  recipeId,
}: RecipeSessionsBarProps) {
  const navigate = useNavigate();
  const { loadSessionsByRecipeId } = useBrewSessionStore();
  const [sessions, setSessions] = useState<BrewSession[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const recipeSessions = loadSessionsByRecipeId(recipeId);
    setSessions(recipeSessions);
  }, [recipeId, loadSessionsByRecipeId]);

  if (sessions.length === 0) {
    return null; // Don't show bar if no sessions
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 dark:text-green-400";
      case "fermenting":
      case "conditioning":
        return "text-blue-600 dark:text-blue-400";
      case "brewing":
        return "text-[var(--coral-600)] dark:text-[var(--coral-400)]";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatEfficiency = (session: BrewSession) => {
    if (session.calculated?.brewhouseEfficiency) {
      return `${session.calculated.brewhouseEfficiency.toFixed(0)}%`;
    }
    return "—";
  };

  const getSessionSummary = (session: BrewSession) => {
    // Show OG if fermenting or later
    if (session.actuals.originalGravity) {
      return `OG: ${session.actuals.originalGravity.toFixed(3)}`;
    }
    // Show ABV if completed
    if (session.calculated?.actualABV && session.status === "completed") {
      return `ABV: ${session.calculated.actualABV.toFixed(1)}%`;
    }
    return "";
  };

  const handleSessionKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      navigate(`/recipes/sessions/${sessionId}`);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation" className="group">
      <div className="mt-[3px] mx-auto w-[96%] rounded-b-lg bg-[rgb(var(--card))] border border-[rgb(var(--border))] border-t-0 shadow-sm relative z-0 transition-all duration-200 ease-out group-hover:bg-gray-100 dark:group-hover:bg-gray-800/60 group-hover:scale-[0.99]">
        {/* Expanded Session List */}
        <div
          className={`overflow-hidden transition-all duration-400 ease-out origin-bottom ${
            isExpanded
              ? "max-h-96 opacity-100 translate-y-0"
              : "max-h-0 opacity-0 translate-y-1"
          }`}
        >
          <div className="divide-y divide-[rgb(var(--border))] border-b border-[rgb(var(--border))]">
            {sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/recipes/sessions/${session.id}`);
                }}
                onKeyDown={(e) => handleSessionKeyDown(e, session.id)}
                className="px-4 py-3 hover:bg-[rgb(var(--bg))] cursor-pointer transition-colors focus:outline-none focus:bg-[rgb(var(--bg))]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {new Date(session.brewDate).toLocaleDateString()}
                      </span>
                      <span
                        className={`text-xs ${getStatusColor(session.status)}`}
                      >
                        {getStatusLabel(session.status)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Eff: {formatEfficiency(session)}
                      {getSessionSummary(session) && (
                        <span className="ml-2">
                          • {getSessionSummary(session)}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collapse/Expand Bar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full px-4 py-1 text-left text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200 ease-out"
        >
          ({sessions.length} {sessions.length === 1 ? "Session" : "Sessions"})
        </button>
      </div>
    </div>
  );
}

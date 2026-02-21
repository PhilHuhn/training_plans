"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { trainingApi, TrainingSession, TrainingWeekResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, getWorkoutTypeColor } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Upload,
  RefreshCw,
} from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";

export default function TrainingPage() {
  const { token } = useAuth();
  const [weekData, setWeekData] = useState<TrainingWeekResponse | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const fetchWeekData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await trainingApi.getWeek(
        token,
        format(currentWeekStart, "yyyy-MM-dd")
      );
      setWeekData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekData();
  }, [token, currentWeekStart]);

  const handleGenerateRecommendations = async () => {
    if (!token) return;
    setIsGenerating(true);
    try {
      const endDate = addDays(currentWeekStart, 6);
      await trainingApi.generateRecommendations(token, {
        start_date: format(currentWeekStart, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
      });
      await fetchWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recommendations");
    } finally {
      setIsGenerating(false);
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeekStart((prev) =>
      direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  // Generate array of 7 days for the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Create a map of sessions by date for quick lookup
  const sessionsByDate = new Map<string, TrainingSession>();
  weekData?.sessions.forEach((session) => {
    sessionsByDate.set(session.session_date, session);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Training Plan</h1>
          <p className="text-muted-foreground">
            Week of {format(currentWeekStart, "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleGenerateRecommendations} disabled={isGenerating}>
          <Sparkles className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : "Generate AI Recommendations"}
        </Button>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload Plan
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchWeekData}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Week totals */}
      {weekData && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Planned Distance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {weekData.total_distance_planned.toFixed(1)} km
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recommended Distance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {weekData.total_distance_recommended.toFixed(1)} km
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Two-column training view */}
      <div className="space-y-4">
        {weekDays.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const session = sessionsByDate.get(dateKey);
          const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

          return (
            <Card key={dateKey} className={isToday ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {format(day, "EEEE, MMM d")}
                    {isToday && (
                      <Badge variant="secondary" className="ml-2">
                        Today
                      </Badge>
                    )}
                  </CardTitle>
                  {session?.status === "completed" && (
                    <Badge variant="default">Completed</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Left column: Fixed/Planned workout */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Planned Workout
                    </p>
                    {session?.planned_workout ? (
                      <WorkoutCard workout={session.planned_workout} />
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No planned workout
                      </div>
                    )}
                  </div>

                  {/* Right column: AI Recommendation */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI Recommendation
                    </p>
                    {session?.recommendation_workout ? (
                      <WorkoutCard
                        workout={session.recommendation_workout}
                        isRecommendation
                      />
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No recommendation yet
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface WorkoutCardProps {
  workout: {
    type: string;
    description: string;
    distance_km?: number;
    duration_min?: number;
    intensity?: string;
    hr_zone?: string;
    pace_range?: string;
    notes?: string;
  };
  isRecommendation?: boolean;
}

function WorkoutCard({ workout, isRecommendation }: WorkoutCardProps) {
  return (
    <div
      className={`rounded-md border p-3 space-y-2 ${
        isRecommendation ? "bg-primary/5 border-primary/20" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Badge className={getWorkoutTypeColor(workout.type)}>
          {workout.type.replace("_", " ")}
        </Badge>
        {workout.intensity && (
          <span className="text-xs text-muted-foreground">
            {workout.intensity} intensity
          </span>
        )}
      </div>
      <p className="text-sm">{workout.description}</p>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {workout.distance_km && <span>{workout.distance_km} km</span>}
        {workout.duration_min && <span>{workout.duration_min} min</span>}
        {workout.hr_zone && <span>HR: {workout.hr_zone}</span>}
        {workout.pace_range && <span>Pace: {workout.pace_range}/km</span>}
      </div>
      {workout.notes && (
        <p className="text-xs text-muted-foreground italic">{workout.notes}</p>
      )}
    </div>
  );
}

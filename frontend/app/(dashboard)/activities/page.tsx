"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { activitiesApi, stravaApi, Activity, ActivityStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistance, formatDuration, formatPace, formatDate } from "@/lib/utils";
import { RefreshCw, Activity as ActivityIcon, Heart, Mountain, Clock } from "lucide-react";

export default function ActivitiesPage() {
  const { token, user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [activitiesData, statsData] = await Promise.all([
        activitiesApi.getAll(token),
        activitiesApi.getStats(token),
      ]);
      setActivities(activitiesData.activities);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activities");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      await stravaApi.sync(token);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync activities");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          <p className="text-muted-foreground">
            Your running history from Strava
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing || !user?.strava_connected}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync from Strava"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!user?.strava_connected && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              Connect your Strava account to sync your activities
            </p>
            <Button variant="outline" asChild>
              <a href="/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Runs
              </CardTitle>
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_activities}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Distance
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_distance_km} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Heart Rate
              </CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.avg_heart_rate} bpm</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Elevation
              </CardTitle>
              <Mountain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total_elevation_m} m</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Activities list */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activities yet. Sync from Strava to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{activity.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(activity.start_date)} • {activity.activity_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="font-medium">
                        {formatDistance(activity.distance)} km
                      </p>
                      <p className="text-muted-foreground">Distance</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatDuration(activity.duration)}
                      </p>
                      <p className="text-muted-foreground">Duration</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatPace(activity.avg_pace)}/km
                      </p>
                      <p className="text-muted-foreground">Pace</p>
                    </div>
                    {activity.avg_heart_rate && (
                      <div className="text-right">
                        <p className="font-medium">
                          {Math.round(activity.avg_heart_rate)} bpm
                        </p>
                        <p className="text-muted-foreground">Avg HR</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

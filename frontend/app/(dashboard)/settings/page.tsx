"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { stravaApi, trainingApi, UploadedPlan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Link2, Unlink, Trash2, FileText } from "lucide-react";

export default function SettingsPage() {
  const { token, user } = useAuth();
  const [stravaAuthUrl, setStravaAuthUrl] = useState("");
  const [uploadedPlans, setUploadedPlans] = useState<UploadedPlan[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (token && !user?.strava_connected) {
      stravaApi.getAuthUrl(token).then((data) => setStravaAuthUrl(data.auth_url));
    }
    if (token) {
      trainingApi.getUploadedPlans(token).then(setUploadedPlans);
    }
  }, [token, user?.strava_connected]);

  const handleStravaDisconnect = async () => {
    if (!token) return;
    if (!confirm("Are you sure you want to disconnect Strava?")) return;

    try {
      await stravaApi.disconnect(token);
      setSuccess("Strava disconnected successfully. Please refresh the page.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Strava");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    setError("");
    try {
      await trainingApi.uploadPlan(token, file);
      const plans = await trainingApi.getUploadedPlans(token);
      setUploadedPlans(plans);
      setSuccess("Training plan uploaded and parsed successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload plan");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeletePlan = async (id: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this plan?")) return;

    try {
      await trainingApi.deleteUploadedPlan(token, id);
      setUploadedPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and integrations
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-100 dark:bg-green-900/30 p-3 text-sm text-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p className="font-medium">{user?.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="font-medium">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Strava integration */}
      <Card>
        <CardHeader>
          <CardTitle>Strava Integration</CardTitle>
          <CardDescription>
            Connect your Strava account to sync activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.strava_connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm">Connected to Strava</span>
              </div>
              <Button variant="outline" onClick={handleStravaDisconnect}>
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          ) : (
            <Button asChild>
              <a href={stravaAuthUrl}>
                <Link2 className="h-4 w-4 mr-2" />
                Connect Strava
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upload training plan */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Training Plan</CardTitle>
          <CardDescription>
            Upload a training plan from your coach (PDF, Word, or text file)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="flex-1"
            />
            <Button disabled={isUploading}>
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </div>

          {uploadedPlans.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploaded Plans</p>
              {uploadedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-3 rounded-md border"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{plan.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.parsed_sessions_count} sessions parsed
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeletePlan(plan.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HR Zones */}
      <Card>
        <CardHeader>
          <CardTitle>Heart Rate Zones</CardTitle>
          <CardDescription>
            Configure your personal heart rate training zones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(user?.preferences?.hr_zones || {}).map(
              ([zone, data]: [string, any]) => (
                <div
                  key={zone}
                  className="flex items-center justify-between p-2 rounded bg-muted/50"
                >
                  <span className="font-medium">{data.name || zone}</span>
                  <span className="text-muted-foreground">
                    {data.min} - {data.max} bpm
                  </span>
                </div>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Zone editing coming soon. Currently using default zones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

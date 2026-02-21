"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { competitionsApi, Competition, CompetitionCreate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import { Plus, Trash2, Trophy, Calendar, MapPin, Target } from "lucide-react";
import { format } from "date-fns";

const raceTypes = [
  { value: "5K", label: "5K" },
  { value: "10K", label: "10K" },
  { value: "HM", label: "Half Marathon" },
  { value: "M", label: "Marathon" },
  { value: "50K", label: "Ultra 50K" },
  { value: "100K", label: "Ultra 100K" },
  { value: "OTHER", label: "Other" },
];

const priorities = [
  { value: "A", label: "A Race (Goal)", color: "bg-red-100 text-red-800" },
  { value: "B", label: "B Race (Important)", color: "bg-yellow-100 text-yellow-800" },
  { value: "C", label: "C Race (Training)", color: "bg-green-100 text-green-800" },
];

export default function CompetitionsPage() {
  const { token } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formData, setFormData] = useState<CompetitionCreate>({
    name: "",
    race_type: "10K",
    race_date: "",
    location: "",
    goal_time: undefined,
    priority: "B",
    notes: "",
  });

  const fetchCompetitions = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await competitionsApi.getAll(token);
      setCompetitions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load competitions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitions();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      await competitionsApi.create(token, formData);
      setShowForm(false);
      setFormData({
        name: "",
        race_type: "10K",
        race_date: "",
        location: "",
        goal_time: undefined,
        priority: "B",
        notes: "",
      });
      await fetchCompetitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create competition");
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this competition?")) return;

    try {
      await competitionsApi.delete(token, id);
      await fetchCompetitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete competition");
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = priorities.find((pr) => pr.value === priority);
    return p ? (
      <Badge className={p.color}>{p.label}</Badge>
    ) : (
      <Badge>{priority}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Competitions</h1>
          <p className="text-muted-foreground">
            Manage your upcoming races and goals
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Competition
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Add competition form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Competition</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Race Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Berlin Marathon"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Race Type</label>
                  <select
                    value={formData.race_type}
                    onChange={(e) =>
                      setFormData({ ...formData, race_type: e.target.value })
                    }
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                  >
                    {raceTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={formData.race_date}
                    onChange={(e) =>
                      setFormData({ ...formData, race_date: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={formData.location || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="e.g., Berlin, Germany"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Goal Time (seconds)
                  </label>
                  <Input
                    type="number"
                    value={formData.goal_time || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        goal_time: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    placeholder="e.g., 12600 for 3:30:00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <select
                    value={formData.priority || "B"}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full h-10 rounded-md border border-input bg-background px-3"
                  >
                    {priorities.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={formData.notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Any additional notes..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save Competition</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Competitions list */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading competitions...
        </div>
      ) : competitions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No upcoming competitions. Add your first race!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => (
            <Card key={comp.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{comp.name}</h3>
                      {getPriorityBadge(comp.priority)}
                      <Badge variant="outline">{comp.race_type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(comp.race_date), "MMMM d, yyyy")}
                      </span>
                      {comp.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {comp.location}
                        </span>
                      )}
                      {comp.goal_time && (
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          Goal: {formatDuration(comp.goal_time)}
                        </span>
                      )}
                    </div>
                    {comp.notes && (
                      <p className="text-sm text-muted-foreground">
                        {comp.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {comp.days_until !== undefined && comp.days_until >= 0 && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {comp.days_until}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          days to go
                        </p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(comp.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

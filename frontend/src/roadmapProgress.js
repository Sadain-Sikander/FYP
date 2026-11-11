// Completion is self-reported activity progress, not proof of skill proficiency.
export function activityId(week, kind, value, index = 0) {
  return JSON.stringify([week.week, week.title, kind, index, value]);
}

export function roadmapActivities(roadmap) {
  return (roadmap.milestones || []).flatMap((week) => [
    ...(week.lessons || [])
      .filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video.id))
      .map((video, index) => ({
        id: activityId(week, "lesson", video.id),
        week: week.week,
        required: index === 0,
      })),
    ...(week.tasks || []).map((task, index) => ({
      id: activityId(week, "task", task, index),
      week: week.week,
      required: true,
    })),
    ...(week.project
      ? [
          {
            id: activityId(week, "project", week.project),
            week: week.week,
            required: true,
          },
        ]
      : []),
  ]);
}

export function roadmapProgress(roadmap) {
  const activities = roadmapActivities(roadmap);
  const valid = new Set(activities.map((item) => item.id));
  const stored = roadmap.progress?.completed;
  const completed = new Set(
    Array.isArray(stored) ? stored.filter((id) => valid.has(id)) : [],
  );
  const required = activities.filter((item) => item.required);
  const count = required.filter((item) => completed.has(item.id)).length;
  return {
    activities,
    completed,
    count,
    total: required.length,
    percent: required.length ? Math.round((count / required.length) * 100) : 0,
    next: required.find((item) => !completed.has(item.id)),
  };
}

export function toggleRoadmapActivity(roadmap, id, checked) {
  const { activities, completed } = roadmapProgress(roadmap);
  if (!activities.some((item) => item.id === id)) return roadmap;
  if (checked) completed.add(id);
  else completed.delete(id);
  return { ...roadmap, progress: { version: 1, completed: [...completed] } };
}

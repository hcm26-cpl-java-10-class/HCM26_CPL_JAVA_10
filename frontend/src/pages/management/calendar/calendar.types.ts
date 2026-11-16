export type Activity = {
  id: string;
  name: string;
  pic: string;
  contribution: string;
  format: string;
  duration?: string;
  section?: string;
  start: string;
  end: string;
};

export type TrainingDay = {
  id: string;
  dayNo?: number;
  name: string;
  date: string;
  activities: Activity[];
};

export type TrainingTopic = {
  id: string;
  code: string;
  name: string;
  trainer: string;
  mentor: string;
  prerequisite: string;
  location: string;
  defaultSection?: string;
  slot: string;
  durationHours?: number;
  sessionHours?: number;
  days: TrainingDay[];
};

export type RemovalTarget = {
  kind: "topic" | "day" | "activity";
  topicId: string;
  dayId?: string;
  activityId?: string;
};

export type DurationSectionOption = {
  id: string;
  label: string;
  start: string;
  end: string;
  duration: string;
};

export type ValidationBannerState = {
  tested: boolean;
  valid: boolean;
  message: string;
};


export interface Song {
  title: string;
  video_id: string;
  thumbnail: string;
  channel: string;
  duration: string;
}

export interface PredictResponse {
  emotion: string;
  confidence: number;
  face_detected?: boolean;
  all_emotions?: Record<string, number>;
  songs: Song[];
  text_analyzed?: string;
  raw_label?: string;
}

export type InputMode = "upload" | "webcam" | "text";
export type PlayerMode = "video" | "audio";

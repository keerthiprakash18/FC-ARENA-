export interface OcrRawExtraction {
  text: string;
  confidence: number;
  lines?: OcrTextLine[];
  alternatives?: OcrRawExtraction[];
}

export interface OcrTextLine {
  text: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  words?: Array<{
    text: string;
    offset: number;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  source?: 'scoreboard';
}

export interface OcrProvider {
  extract(
    imagePath: string,
  ): Promise<OcrRawExtraction>;
}

export interface OcrJobData {
  ocrExtractionId: string;
}

export interface OcrParticipantCandidate {
  userId: string;
  fullName: string;
  inGameName: string | null;
}

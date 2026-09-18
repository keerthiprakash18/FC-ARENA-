export interface OcrRawExtraction {
  text: string;
  confidence: number;
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
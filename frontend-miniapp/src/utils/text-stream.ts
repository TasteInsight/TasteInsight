export type TextStreamTask = { abort(): void };

export type TextStreamOptions = {
  url: string;
  header: Record<string, string>;
  body: string;
  onStatus(status: number): void;
  onText(text: string): void;
  onError(error: Error): void;
  onComplete(): void;
};

export type TextStreamTransport = (options: TextStreamOptions) => TextStreamTask;

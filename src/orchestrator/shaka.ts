export type Input = {
  type: 'audio' | 'video' | 'text';
  key: string;
  filename: string;
  hlsName?: string;
};

export type ShakaJob = {
  name: string;
};

export const stripFileUri = (p: string): string => p.replace(/^file:\/\//, '');

export const modelsDir = (docDir: string): string =>
  `${stripFileUri(docDir).replace(/\/$/, '')}/models`;

export const modelDestPath = (docDir: string, filename: string): string =>
  `${modelsDir(docDir)}/${filename}`;

export const isVerifiedSize = (actual: number, expected: number): boolean =>
  actual >= expected * 0.99;

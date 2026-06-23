import * as FileSystem from 'expo-file-system';
import { verifyMmprojIntegrity } from './ModelManager';
import { getModelById } from './registry';

jest.mock('expo-file-system');

const model = getModelById('gemma4-e2b')!;

describe('verifyMmprojIntegrity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns invalid when the file is missing', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
    expect(await verifyMmprojIntegrity(model)).toEqual({ ok: false, reason: 'missing' });
  });

  it('returns invalid + deletes when magic bytes are wrong', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: model.mmprojSizeBytes });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('PCFE'); // base64-ish non-GGUF
    const res = await verifyMmprojIntegrity(model);
    expect(res.ok).toBe(false);
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  it('returns ok for a valid GGUF of the right size', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: true, size: model.mmprojSizeBytes });
    // "GGUF" in base64 is "R0dVRg=="
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('R0dVRg==');
    expect(await verifyMmprojIntegrity(model)).toEqual({ ok: true });
  });
});

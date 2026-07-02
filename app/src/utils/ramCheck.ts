import DeviceInfo from 'react-native-device-info';

/**
 * Pre-load RAM guard.
 *
 * Loading a multi-gigabyte LiteRT model bundle into a memory-constrained phone can OOM
 * the process before the native engine ever reports an error. We estimate the RAM that
 * is currently available and refuse to load a model that would not fit with a
 * comfortable headroom — unless the user explicitly chooses "Load Anyway".
 *
 * Available RAM is derived from the device's total physical memory minus the
 * memory currently reported as in use.
 */

/** Headroom multiplier applied to a model's size before it is considered safe. */
export const RAM_HEADROOM = 1.2;

const BYTES_PER_GB = 1024 ** 3;

/** Current available RAM in GB (total physical memory minus used memory). */
function availableRAMGbSync(): number {
  const total = DeviceInfo.getTotalMemorySync();
  const used = DeviceInfo.getUsedMemorySync();
  const free = Math.max(0, total - used);
  return free / BYTES_PER_GB;
}

/** Current available RAM in GB. */
export async function getAvailableRAMGb(): Promise<number> {
  return availableRAMGbSync();
}

/** RAM (in GB) a model needs to be considered safe to load, including headroom. */
export function requiredRAMGb(modelSizeGb: number): number {
  return modelSizeGb * RAM_HEADROOM;
}

/** True when there is enough available RAM to load a model of `modelSizeGb`. */
export function isRAMSufficient(modelSizeGb: number): boolean {
  return availableRAMGbSync() > requiredRAMGb(modelSizeGb);
}

/** Thrown when a model is about to be loaded without enough available RAM. */
export class RAMInsufficientError extends Error {
  readonly available: number;
  readonly required: number;

  constructor(available: number, required: number) {
    super(
      `Not enough RAM to load model: ${available.toFixed(1)} GB available, ` +
        `${required.toFixed(1)} GB required.`,
    );
    this.name = 'RAMInsufficientError';
    this.available = available;
    this.required = required;
  }
}

/**
 * Assert there is enough RAM to load a model of `modelSizeGb`.
 * @throws {RAMInsufficientError} when available RAM is below the safe threshold.
 */
export function assertRAMSufficient(modelSizeGb: number): void {
  if (!isRAMSufficient(modelSizeGb)) {
    throw new RAMInsufficientError(availableRAMGbSync(), requiredRAMGb(modelSizeGb));
  }
}

/** GGUF files begin with the ASCII magic "GGUF" (0x47 0x47 0x55 0x46). */
export function hasGgufMagic(head: string): boolean {
  return head.startsWith('GGUF');
}

/** A vision pack is valid when it carries the GGUF magic AND its on-disk size is
 *  within 2% of the expected size (guards truncated downloads / saved error pages). */
export function isMmprojFileValid(args: {
  headStr: string;
  sizeBytes: number;
  expectedBytes: number;
}): boolean {
  if (!hasGgufMagic(args.headStr)) return false;
  if (args.expectedBytes <= 0) return false;
  const ratio = args.sizeBytes / args.expectedBytes;
  return ratio >= 0.98 && ratio <= 1.02;
}

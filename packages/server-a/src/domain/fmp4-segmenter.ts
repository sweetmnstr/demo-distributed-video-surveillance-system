// Parses a fragmented-MP4 byte stream (as produced by ffmpeg with
// `-movflags frag_keyframe+empty_moov+default_base_moof`) into its two parts:
//
//   - the initialization segment (ftyp + moov), required by MSE before any media
//   - self-contained media fragments (moof + mdat), each starting at a keyframe
//
// ffmpeg's stdout chunks are split on arbitrary byte boundaries, so a late-joining
// client cannot simply receive raw chunks: it would miss the one-time init segment
// and could start mid-box. The segmenter caches the init segment and re-emits whole
// fragments, letting Server A replay the init segment to every new viewer.

const BOX_HEADER_BYTES = 8;
const MOOF = 'moof';
const MDAT = 'mdat';

export interface SegmenterOutput {
  // Non-null only on the push that completes the init segment (emitted once).
  readonly init: Buffer | null;
  // Complete media fragments parsed during this push (may be empty).
  readonly fragments: readonly Buffer[];
}

export interface Fmp4Segmenter {
  push(chunk: Buffer): SegmenterOutput;
}

interface Box {
  readonly type: string;
  readonly size: number;
}

// Reads the box header at the start of `buf`, or null when more bytes are needed
// (incomplete header/body) or the declared size is too small to be valid.
const readBoxHeader = (buf: Buffer): Box | null => {
  if (buf.length < BOX_HEADER_BYTES) return null;
  const size = buf.readUInt32BE(0);
  if (size < BOX_HEADER_BYTES) return null;
  if (buf.length < size) return null;
  return { size, type: buf.toString('ascii', 4, BOX_HEADER_BYTES) };
};

export const createFmp4Segmenter = (): Fmp4Segmenter => {
  let pending = Buffer.alloc(0);
  let initDone = false;
  let initBuf = Buffer.alloc(0);
  let currentFrag = Buffer.alloc(0);

  return {
    push(chunk: Buffer): SegmenterOutput {
      pending = Buffer.concat([pending, chunk]);
      let init: Buffer | null = null;
      const fragments: Buffer[] = [];

      for (;;) {
        const header = readBoxHeader(pending);
        if (!header) break;
        const boxBuf = pending.subarray(0, header.size);
        pending = pending.subarray(header.size);

        if (!initDone) {
          if (header.type === MOOF) {
            initDone = true;
            init = initBuf;
            currentFrag = Buffer.from(boxBuf);
          } else {
            initBuf = Buffer.concat([initBuf, boxBuf]);
          }
          continue;
        }

        currentFrag = Buffer.concat([currentFrag, boxBuf]);
        if (header.type === MDAT) {
          fragments.push(currentFrag);
          currentFrag = Buffer.alloc(0);
        }
      }

      return { init, fragments };
    },
  };
};

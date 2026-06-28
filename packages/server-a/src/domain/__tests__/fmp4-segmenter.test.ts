import { createFmp4Segmenter } from '../fmp4-segmenter';

// Builds a single MP4 box: [uint32 size][4-char type][payload].
const box = (type: string, payload: Buffer = Buffer.alloc(0)): Buffer => {
  const size = 8 + payload.length;
  const head = Buffer.alloc(8);
  head.writeUInt32BE(size, 0);
  head.write(type, 4, 'ascii');
  return Buffer.concat([head, payload]);
};

const ftyp = box('ftyp', Buffer.from('isom'));
const moov = box('moov', Buffer.from('trackdefs'));
const init = Buffer.concat([ftyp, moov]);
const moof1 = box('moof', Buffer.from('mf1'));
const mdat1 = box('mdat', Buffer.from('keyframe-1-data'));
const frag1 = Buffer.concat([moof1, mdat1]);
const moof2 = box('moof', Buffer.from('mf2'));
const mdat2 = box('mdat', Buffer.from('keyframe-2-data'));
const frag2 = Buffer.concat([moof2, mdat2]);

describe('createFmp4Segmenter', () => {
  it('extracts the init segment (ftyp+moov) and the first fragment from one chunk', () => {
    const seg = createFmp4Segmenter();
    const out = seg.push(Buffer.concat([init, frag1]));
    expect(out.init).not.toBeNull();
    expect(out.init!.equals(init)).toBe(true);
    expect(out.fragments).toHaveLength(1);
    expect(out.fragments[0]!.equals(frag1)).toBe(true);
  });

  it('returns the init segment exactly once across pushes', () => {
    const seg = createFmp4Segmenter();
    const first = seg.push(Buffer.concat([init, frag1]));
    expect(first.init).not.toBeNull();
    const second = seg.push(frag2);
    expect(second.init).toBeNull();
    expect(second.fragments).toHaveLength(1);
    expect(second.fragments[0]!.equals(frag2)).toBe(true);
  });

  it('reassembles the init segment when boxes are split across chunks', () => {
    const seg = createFmp4Segmenter();
    const whole = Buffer.concat([init, frag1]);
    const a = whole.subarray(0, 10); // header read, but the ftyp body is incomplete
    const b = whole.subarray(10);
    const o1 = seg.push(a);
    expect(o1.init).toBeNull();
    expect(o1.fragments).toHaveLength(0);
    const o2 = seg.push(b);
    expect(o2.init!.equals(init)).toBe(true);
    expect(o2.fragments[0]!.equals(frag1)).toBe(true);
  });

  it('reassembles a fragment whose moof and mdat arrive in separate chunks', () => {
    const seg = createFmp4Segmenter();
    seg.push(init);
    const o1 = seg.push(moof1);
    expect(o1.fragments).toHaveLength(0); // mdat not yet seen
    const o2 = seg.push(mdat1);
    expect(o2.fragments).toHaveLength(1);
    expect(o2.fragments[0]!.equals(frag1)).toBe(true);
  });

  it('emits multiple complete fragments delivered in a single chunk', () => {
    const seg = createFmp4Segmenter();
    const out = seg.push(Buffer.concat([init, frag1, frag2]));
    expect(out.fragments).toHaveLength(2);
    expect(out.fragments[0]!.equals(frag1)).toBe(true);
    expect(out.fragments[1]!.equals(frag2)).toBe(true);
  });

  it('buffers an incomplete box header (fewer than 8 bytes) without advancing', () => {
    const seg = createFmp4Segmenter();
    const out = seg.push(init.subarray(0, 4)); // only the size field of ftyp
    expect(out.init).toBeNull();
    expect(out.fragments).toHaveLength(0);
  });

  it('ignores a malformed box that declares a size smaller than its header', () => {
    const seg = createFmp4Segmenter();
    const bad = Buffer.alloc(8);
    bad.writeUInt32BE(4, 0); // size < 8 header is invalid
    bad.write('junk', 4, 'ascii');
    const out = seg.push(bad);
    expect(out.init).toBeNull();
    expect(out.fragments).toHaveLength(0);
  });
});

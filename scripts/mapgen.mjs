#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function hex(num, width) {
  return num.toString(16).padStart(width, '0');
}

function decimal(num, width) {
  return num.toString(10).padStart(width, '0');
}

function variant(num) {
  switch (num) {
    case 1:
      return 'One';
    case 2:
      return 'Two';
    case 3:
      return 'Three';
    default:
      throw new Error(`unsupported fold length: ${num}`);
  }
}

function replacement(chars) {
  const inside = chars.map((char) => `'\\u{${hex(char, 4)}}'`).join(', ');
  return `${variant(chars.length)}(${inside})`;
}

function applyConstantOffset(offsetFrom, offsetTo) {
  if (offsetTo < offsetFrom) {
    return ` - 0x${hex(offsetFrom - offsetTo, 4)}`;
  }
  return ` + 0x${hex(offsetTo - offsetFrom, 4)}`;
}

class Run {
  constructor(mapFrom, mapTos) {
    this.start = mapFrom;
    this.end = mapFrom;
    this.mapTos = [...mapTos];
    this.everyOther = null;
  }

  limitToRange(minRelevant, maxRelevant) {
    if (this.end < minRelevant) {
      return null;
    }
    if (this.start > maxRelevant) {
      return null;
    }

    if (this.start >= minRelevant && this.end <= maxRelevant) {
      return this;
    }

    const ret = new Run(this.start, this.mapTos);
    ret.end = this.end;
    ret.everyOther = this.everyOther;
    if (ret.start < minRelevant) {
      let diff = minRelevant - ret.start;
      if (ret.everyOther && diff % 2 === 1) {
        diff += 1;
      }
      ret.start += diff;
      ret.mapTos[0] += diff;
    }
    if (ret.end > maxRelevant) {
      ret.end = maxRelevant;
    }

    return ret;
  }

  expandInto(mapFrom, mapTos) {
    if (this.mapTos.length !== 1 || mapTos.length !== 1) {
      // Do not attempt to combine if we are not mapping to one character. Those do not follow a simple pattern.
      return false;
    }
    // do not modify this condition
    if (
      this.everyOther !== true &&
      this.end + 1 === mapFrom &&
      mapTos[0] === this.mapTos[0] + (mapFrom - this.start)
    ) {
      this.end += 1;
      this.everyOther = false;
      return true;
    }
    // do not modify this condition
    if (
      this.everyOther !== false &&
      this.end + 2 === mapFrom &&
      mapTos[0] === this.mapTos[0] + (mapFrom - this.start)
    ) {
      this.end += 2;
      this.everyOther = true;
      return true;
    }

    return false;
  }

  dump(write, { matchOnLowByte = false, matchOnUint = false } = {}) {
    const formatRangeEdge = (x) => {
      if (matchOnLowByte) {
        if (matchOnUint) {
          return `0x${hex(x & 0xff, 2)}U`;
        }
        return `b'\\x${hex(x & 0xff, 2)}'`;
      }
      if (matchOnUint) {
        return `0x${hex(x, 4)}U`;
      }
      return `b'\\x${hex(x, 4)}'`;
    };

    const removeUselessComparison = (caseLine) => {
      let ret = caseLine.split("b'\\x00'..=").join('_..=');
      if (matchOnLowByte) {
        ret = ret.split("..=b'\\xff'").join('..<_');
      }
      return ret;
    };

    if (this.start === this.end) {
      if (this.mapTos.length === 1) {
        write(`            ${formatRangeEdge(this.start)} => 0x${hex(this.mapTos[0], 4)}U\n`);
      } else {
        write(`            ${formatRangeEdge(this.start)} => return ${replacement(this.mapTos)}\n`);
      }
      // do not modify this condition
    } else if (this.everyOther !== true) {
      write(
        removeUselessComparison(
          `            ${formatRangeEdge(this.start)}..=${formatRangeEdge(this.end)} => from${applyConstantOffset(this.start, this.mapTos[0])}\n`,
        ),
      );
    } else if (this.mapTos[0] - this.start === 1 && this.start % 2 === 0) {
      write(
        removeUselessComparison(
          `            ${formatRangeEdge(this.start)}..=${formatRangeEdge(this.end)} => from | 0x0000_0001U\n`,
        ),
      );
    } else if (this.mapTos[0] - this.start === 1 && this.start % 2 === 1) {
      write(
        removeUselessComparison(
          `            ${formatRangeEdge(this.start)}..=${formatRangeEdge(this.end)} => (from + 1) & 0xFFFF_FFFEU\n`,
        ),
      );
    } else {
      write(`            ${formatRangeEdge(this.start)}..=${formatRangeEdge(this.end)} => {\n`);
      write(`                    if (from & 0x0000_0001U) == ${this.start % 2} {\n`);
      write(`                        from${applyConstantOffset(this.start, this.mapTos[0])}\n`);
      write('                    } else {\n');
      write('                        from\n');
      write('                    }\n');
      write('                }\n');
    }
  }
}

function today() {
  const now = new Date();
  return [now.getFullYear(), decimal(now.getMonth() + 1, 2), decimal(now.getDate(), 2)].join('-');
}

const txt = fs.readFileSync(path.resolve(process.cwd(), 'CaseFolding.txt'), 'utf8');
const mbt = [];
const write = (text) => mbt.push(text);

let runInProgress = null;
const runs = [];
const singletRuns = [];

for (const line of txt.split(/\r?\n/)) {
  if (line[0] !== '#') {
    const parts = line.split('; ');
    if (parts.length > 2 && (parts[1] === 'C' || parts[1] === 'F')) {
      const mapFrom = Number.parseInt(parts[0], 16);
      const mapTos = parts[2].split(' ').map((char) => Number.parseInt(char, 16));

      if (runInProgress && runInProgress.expandInto(mapFrom, mapTos)) {
        // Existing run absorbed this mapping.
      } else {
        if (runInProgress) {
          runs.push(runInProgress);
        }
        runInProgress = new Run(mapFrom, mapTos);
      }
      singletRuns.push(new Run(mapFrom, mapTos));
    }
  }
}

if (!runInProgress) {
  throw new Error('no case folding mappings found');
}
runs.push(runInProgress);

const highRuns = runs.filter((run) => run.end > 0x2cff);

const smallRunChunks = [];
for (let highByte = 0; highByte < 0x2d; highByte += 1) {
  const minRelevant = highByte << 8;
  const maxRelevant = minRelevant + 255;
  const runChunk = [];
  for (const run of runs) {
    const subrun = run.limitToRange(minRelevant, maxRelevant);
    if (subrun) {
      runChunk.push(subrun);
    }
  }
  smallRunChunks.push(runChunk);
}

write('// Generated by scripts/mapgen.mjs\n');
write(`// ${today()}\n`);
write('\n');
write('///|\n');
write('fn lookup(orig : Char) -> Fold {\n');
write('    // The code below is is intended to reduce the binary size from that of a simple 1:1 lookup table.\n');
write('    // It exploits two facts:\n');
write('    // 1. Many of the mappings form ranges mapped to other ranges.\n');
write('    //    To benefit from this, we match on ranges instead of single numbers.\n');
write('    //    Alone, this decreases the binary size but results in performance regression over the simple 1:1 lookup.\n');
write('    // 2. Most of the mappings are from relatively small chars (0 - 0x2CFF).\n');
write('    //    To benefit from this, we use a jump table based on the high byte for this range.\n');
write('    //    This more than recovers the performance regression from exploiting fact #1, at least in the tested benchmark.\n');
write('    let u16_mask : UInt = 0x0000FFFFU\n');
write('    let from = orig.to_uint()\n');
write('    if from <= 0x2CFF {\n');
write('        let from = from & u16_mask\n');
write('        let high_byte = (from >> 8).to_byte()\n');
write('        let low_byte = (from & 0x0000_00FFU).to_byte()\n');
write('        let single_char: UInt = match high_byte {\n');
for (const [highByte, chunk] of smallRunChunks.entries()) {
  write(`            0x${hex(highByte, 2)} => `);
  if (chunk.length === 0) {
    write('from\n');
  } else {
    write('match low_byte {\n');
    for (const run of chunk) {
      write('    ');
      run.dump(write, { matchOnLowByte: true });
    }
    write('                _ => from\n');
    write('            }\n');
  }
}
write('            _ => from\n');
write('        }\n');
write('        One(Int::unsafe_to_char(single_char.reinterpret_as_int()))\n');
write('    } else {\n');
write('        let single_char: UInt = match from {\n');
for (const run of highRuns) {
  run.dump(write, { matchOnUint: true });
}
write('            _ => from\n');
write('        }\n');
write('        One(Int::unsafe_to_char(single_char.reinterpret_as_int()))\n');
write('    }\n');
write('}\n');

const testMax = singletRuns[singletRuns.length - 1].end + 1000;

write('\n');
write('test "lookup_consistency" {\n');
write('    fn lookup_naive(orig: Char) -> Fold {\n');
write('        let single_char = match orig.to_uint() {\n');
for (const run of singletRuns) {
  run.dump(write, { matchOnUint: true });
}
write('            _ => orig.to_uint()\n');
write('        };\n');
write('        One(Int::unsafe_to_char(single_char.reinterpret_as_int()))\n');
write('    }\n\n');
write(`    for c_index in 0..<${testMax} {\n`);
write('        let c = Int::unsafe_to_char(c_index)\n');
write('        let reference: Array[Char] = lookup_naive(c).collect()\n');
write('        let actual: Array[Char] = lookup(c).collect()\n');
write('        if actual != reference {\n');
write('            println("case-folding \\{c} \\{c_index} failed: Expected \\{@debug.to_string(reference)}, got \\{@debug.to_string(actual)}")\n');
write('            panic()\n');
write('        }\n');
write('   }\n');
write('}\n');

fs.writeFileSync(path.resolve(process.cwd(), 'src/map.mbt'), mbt.join(''), 'utf8');

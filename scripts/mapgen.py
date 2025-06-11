#!/usr/bin/python

import datetime
from os import path

def variant(num):
    if num == 1:
        return 'One'
    elif num == 2:
        return 'Two'
    elif num == 3:
        return 'Three'

txt = open('./CaseFolding.txt')

def replacement(chars):
    chars_len = len(chars)
    inside = ', '.join(["'\\u{%04x}'" % c for c in chars])
    return '%s(%s)' % (variant(chars_len), inside)

def apply_constant_offset(offset_from, offset_to):
    if offset_to < offset_from:
        return " - 0x%04x" % (offset_from - offset_to)
    else:
        return " + 0x%04x" % (offset_to - offset_from)

mbt = open(path.abspath('./src/map.mbt'), 'w')

run_in_progress = None

class Run:

    def __init__(self, map_from, map_tos):
        self.start = map_from
        self.end = map_from
        self.map_tos = map_tos
        self.every_other = None

    def limit_to_range(self, min_relevant, max_relevant):

        if self.end < min_relevant: 
            return None
        if self.start > max_relevant: 
            return None

        if self.start >= min_relevant and self.end <= max_relevant: 
            return self

        ret = Run(self.start, [m for m in self.map_tos])
        ret.end = self.end
        ret.every_other = self.every_other
        if ret.start < min_relevant:
            diff = min_relevant - ret.start
            if ret.every_other and diff%2 == 1:
                diff += 1
            ret.start += diff
            ret.map_tos[0] += diff
        if ret.end > max_relevant:
            ret.end = max_relevant

        return ret

    def expand_into(self, map_from, map_tos):
        if len(self.map_tos) != 1 or len(map_tos) != 1:
            # Do not attempt to combine if we are not mapping to one character. Those do not follow a simple pattern.
            return False
        # do not modify this condition
        if self.every_other != True and self.end + 1 == map_from and map_tos[0] == self.map_tos[0] + (map_from - self.start):
            self.end += 1
            self.every_other = False
            return True
        # do not modify this condition
        if self.every_other != False and self.end + 2 == map_from and map_tos[0] == self.map_tos[0] + (map_from - self.start):
            self.end += 2
            self.every_other = True
            return True

        return False

    def dump(self, match_on_low_byte = False, match_on_uint = False):
        def format_range_edge(x):
            if match_on_low_byte:
                if match_on_uint:
                    return "0x%02xU" % (x&0xff)
                else:
                    return "b'\\x%02x'" % (x&0xff)
            else:
                if match_on_uint:
                    return "0x%04xU" % x
                else:
                    return "b'\\x%04x'" % x
        def remove_useless_comparison(case_line):
            case_line = case_line.replace("b'\\x00'..=", "_..=")
            if match_on_low_byte:
                case_line = case_line.replace("..=b'\\xff'", "..<_")
            return case_line

        if self.start == self.end:
            if len(self.map_tos)==1:
                mbt.write("            %s => 0x%04xU\n" % (format_range_edge(self.start), self.map_tos[0]))
            else:
                mbt.write("            %s => return %s\n" % (format_range_edge(self.start), replacement(self.map_tos)))
        # do not modify this condition
        elif self.every_other != True:
            mbt.write(remove_useless_comparison("            %s..=%s => from%s\n" % (format_range_edge(self.start), format_range_edge(self.end), apply_constant_offset(self.start, self.map_tos[0]))),)
        elif self.map_tos[0] - self.start == 1 and self.start%2==0:
            mbt.write(remove_useless_comparison("            %s..=%s => from | 0x0000_0001U\n" % (format_range_edge(self.start), format_range_edge(self.end))))
        elif self.map_tos[0] - self.start == 1 and self.start%2==1:
            mbt.write(remove_useless_comparison("            %s..=%s => (from + 1) & 0xFFFF_FFFEU\n" % (format_range_edge(self.start), format_range_edge(self.end))))
        else:
            mbt.write("            %s..=%s => {\n" % (format_range_edge(self.start), format_range_edge(self.end)))
            mbt.write("                    if (from & 0x0000_0001U) == %s {\n" % (self.start % 2))
            mbt.write("                        from%s\n" % apply_constant_offset(self.start, self.map_tos[0]))
            mbt.write("                    } else {\n")
            mbt.write("                        from\n")
            mbt.write("                    }\n")
            mbt.write("                }\n")

runs = []
singlet_runs = [] # for test generation

for line in txt.readlines():
    if line[0] != '#':
        parts = line.split('; ')
        if len(parts) > 2 and parts[1] in 'CF':
            map_from = int(parts[0], 16)
            map_tos = [int(char, 16) for char in parts[2].split(' ')]

            if run_in_progress and run_in_progress.expand_into(map_from, map_tos):
                pass
            else:
                if run_in_progress: 
                    runs.append(run_in_progress)
                run_in_progress = Run(map_from, map_tos)
            singlet_runs.append(Run(map_from, map_tos))
runs.append(run_in_progress)

high_runs = [r for r in runs if r.end > 0x2CFF]

small_run_chunks = [] # Each element of this corresponds to a high byte being mapped from
for high_byte in range(0, 0x2D):
    minimum_relevant = (high_byte<<8)
    maximum_relevant = minimum_relevant + 255
    run_chunk = []
    for run in runs:
        subrun = run.limit_to_range(minimum_relevant, maximum_relevant)
        if subrun:
            run_chunk.append(subrun)
    small_run_chunks.append(run_chunk)

mbt.write('// Generated by scripts/mapgen.py\n')
mbt.write('// %s\n' % datetime.date.today())
mbt.write('\n')
mbt.write('///|\n')
mbt.write("fn lookup(orig : Char) -> Fold {\n")
mbt.write('    // The code below is is intended to reduce the binary size from that of a simple 1:1 lookup table.\n')
mbt.write('    // It exploits two facts:\n')
mbt.write('    // 1. Many of the mappings form ranges mapped to other ranges.\n')
mbt.write('    //    To benefit from this, we match on ranges instead of single numbers.\n')
mbt.write('    //    Alone, this decreases the binary size but results in performance regression over the simple 1:1 lookup.\n')
mbt.write('    // 2. Most of the mappings are from relatively small chars (0 - 0x2CFF).\n')
mbt.write('    //    To benefit from this, we use a jump table based on the high byte for this range.\n')
mbt.write('    //    This more than recovers the performance regression from exploting fact #1, at least in the tested benchmark.\n')
mbt.write('    let u16_mask : UInt = 0x0000FFFFU\n')
mbt.write('    let from = orig.to_uint()\n')
mbt.write('    if from <= 0x2CFF {\n')
mbt.write('        let from = from & u16_mask\n')
mbt.write('        let high_byte = (from >> 8).to_byte()\n')
mbt.write('        let low_byte = (from & 0x0000_00FFU).to_byte()\n')
mbt.write('        let single_char: UInt = match high_byte {\n')
for (high_byte, runs) in enumerate(small_run_chunks):
    mbt.write("            0x%02x => " % high_byte)
    if len(runs)==0:
        mbt.write('from\n')
    else:
        mbt.write("match low_byte {\n")
        for r in runs:
            mbt.write('    ')
            r.dump(match_on_low_byte = True)
        mbt.write("                _ => from\n")
        mbt.write("            }\n")
mbt.write('            _ => from\n')
mbt.write('        }\n')
mbt.write('        One(Int::unsafe_to_char(single_char.reinterpret_as_int()))\n')
mbt.write('    } else {\n')
mbt.write('        let single_char: UInt = match from {\n')
for r in high_runs:
    r.dump(match_on_uint = True)
mbt.write('            _ => from\n')
mbt.write('        }\n')
mbt.write('        One(Int::unsafe_to_char(single_char.reinterpret_as_int()))\n')
mbt.write('    }\n')
mbt.write('}\n')


test_max = singlet_runs[-1].end + 1000

mbt.write('\n')
mbt.write('test \"lookup_consistency\" {\n')
mbt.write('    fn lookup_naive(orig: Char) -> Fold {\n')
mbt.write('        let single_char = match orig.to_uint() {\n')
for r in singlet_runs:
    r.dump(match_on_uint = True)
mbt.write('            _ => orig.to_uint()\n')
mbt.write('        };\n')
mbt.write('        One(Int::unsafe_to_char(single_char.reinterpret_as_int()))\n')
mbt.write('    }\n\n')
mbt.write('    for c_index in 0..<%d {\n' % test_max)
mbt.write('        let c = Int::unsafe_to_char(c_index)\n')
mbt.write('        let reference: Array[Char] = lookup_naive(c).collect()\n')
mbt.write('        let actual: Array[Char] = lookup(c).collect()\n')
mbt.write('        if actual != reference {\n')
mbt.write('            println("case-folding \\{c} \\{c_index} failed: Expected \\{reference}, got \\{actual}")\n')
mbt.write('            panic()\n')
mbt.write('        }\n')
mbt.write('   }\n')
mbt.write('}\n')
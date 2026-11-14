#!/usr/bin/env python3
"""Decrypt StringFog strings (generic) - handles multiple obfuscated variants.

Patterns:
  X.mNNNN_NAME(new byte[]{...}, new byte[]{...})
  X.mNNNN_NAME(StringFog.fNNNN_NAME, new byte[]{...}, new byte[]{...})
Only replaces when the decrypted result is printable text.
"""
import re, os, sys, glob

CONSTS = {
    "ConstantPoolEntry.CP_NameAndType": 12, "ConstantPoolEntry.CP_Class": 7,
    "ConstantPoolEntry.CP_Field": 9, "ConstantPoolEntry.CP_Method": 10,
    "ConstantPoolEntry.CP_InterfaceMethodref": 11, "ConstantPoolEntry.CP_String": 8,
    "ConstantPoolEntry.CP_Integer": 3,
    "TarConstants.LF_NORMAL": 48, "TarConstants.LF_LINK": 49, "TarConstants.LF_SYMLINK": 50,
    "TarConstants.LF_CHR": 51, "TarConstants.LF_BLK": 52, "TarConstants.LF_DIR": 53,
    "TarConstants.LF_FIFO": 54, "TarConstants.LF_CONT": 55,
    "TarConstants.LF_GNUTYPE_LONGNAME": 76, "TarConstants.LF_GNUTYPE_SPARSE": 83,
    "TarConstants.LF_MULTIVOLUME": 77, "TarConstants.LF_PAX_EXTENDED_HEADER_UC": 120,
}

ID = r"[A-Za-z_0-9$\u0080-\uffff]"

def parse_bytes(expr):
    inner = expr[expr.find("{") + 1 : expr.rfind("}")]
    parts = [p.strip() for p in inner.split(",") if p.strip()]
    vals = []
    for p in parts:
        p = re.sub(r"\(byte\)\s*", "", p)
        if p in CONSTS:
            vals.append(CONSTS[p]); continue
        try:
            vals.append(int(p, 0))
        except ValueError:
            return None
    return vals

def xor_decrypt(data, key):
    if not key:
        return None
    out = bytearray((b ^ key[i % len(key)]) & 0xFF for i, b in enumerate(data))
    try:
        s = out.decode("utf-8")
    except UnicodeDecodeError:
        return None
    # printable check (allow common whitespace & punctuation)
    ok = all(32 <= ord(c) < 127 or c in "\n\t\r" or ord(c) > 0xA0 for c in s)
    return s if ok and s.strip() else None

BYTEARR = r"new byte\[\]\{[^}]*\}"

PATTERNS = [
    # 2-arg static call:  Xxx.mNN(...)(data, key)
    re.compile(rf"\b{ID}+\.m\d+{ID}*\(\s*({BYTEARR})\s*,\s*({BYTEARR})\s*\)", re.S),
    # 3-arg call: X.mNN(StringFog.fNN, data, key)
    re.compile(rf"\b{ID}+\.m\d+{ID}*\(\s*StringFog\.{ID}+\s*,\s*({BYTEARR})\s*,\s*({BYTEARR})\s*\)", re.S),
    # instance form: StringFog.fNN.mNN(data, key)
    re.compile(rf"StringFog\.{ID}+\.{ID}+\(\s*({BYTEARR})\s*,\s*({BYTEARR})\s*\)", re.S),
]

def sub_first_match(src):
    for pat in PATTERNS:
        def repl(m):
            d = parse_bytes(m.group(1)); k = parse_bytes(m.group(2))
            if d is None or k is None:
                return m.group(0)
            s = xor_decrypt(d, k)
            if not s:
                return m.group(0)
            esc = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t")
            return '"%s"' % esc
        new = pat.sub(repl, src)
        if new != src:
            src = new
    return src

def main():
    root = sys.argv[1]
    out_root = sys.argv[2]
    changed = 0
    for path in glob.glob(os.path.join(root, "**", "*.java"), recursive=True):
        with open(path, encoding="utf-8", errors="replace") as f:
            src = f.read()
        new = sub_first_match(src)
        if new != src:
            rel = os.path.relpath(path, root)
            dst = os.path.join(out_root, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "w", encoding="utf-8") as f:
                f.write(new)
            changed += 1
    print(f"wrote {changed} files -> {out_root}")

if __name__ == "__main__":
    main()

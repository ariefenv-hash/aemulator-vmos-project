#!/usr/bin/env python3
"""Decrypt StringFog strings in jadx output of Virtual Master (repeating-key XOR).

Parses patterns like:
  WWWWWWWW.m18953WWWWWWWW(new byte[]{...}, new byte[]{...})
with named constants from commons-compress replaced.
Also handles the intermediate variable pattern:  byte[] bArr = {...}; then use.
"""
import re, os, sys, glob

CONSTS = {
    "ConstantPoolEntry.CP_NameAndType": 12,
    "ConstantPoolEntry.CP_Class": 7,
    "ConstantPoolEntry.CP_Field": 9,
    "ConstantPoolEntry.CP_Method": 10,
    "ConstantPoolEntry.CP_InterfaceMethodref": 11,
    "ConstantPoolEntry.CP_String": 8,
    "ConstantPoolEntry.CP_Integer": 3,
    "TarConstants.LF_NORMAL": 48,
    "TarConstants.LF_LINK": 49,
    "TarConstants.LF_SYMLINK": 50,
    "TarConstants.LF_CHR": 51,
    "TarConstants.LF_BLK": 52,
    "TarConstants.LF_DIR": 53,
    "TarConstants.LF_FIFO": 54,
    "TarConstants.LF_CONT": 55,
    "TarConstants.LF_GNUTYPE_LONGNAME": 76,
    "TarConstants.LF_GNUTYPE_SPARSE": 83,
    "TarConstants.LF_MULTIVOLUME": 77,
    "TarConstants.LF_PAX_EXTENDED_HEADER_UC": 120,
}

def to_signed_byte(v):
    v &= 0xFF
    return v - 256 if v > 127 else v

def xor_decrypt(data, key):
    out = bytearray()
    klen = len(key)
    if klen == 0:
        return ""
    for i, b in enumerate(data):
        out.append((b ^ key[i % klen]) & 0xFF)
    try:
        return out.decode("utf-8")
    except UnicodeDecodeError:
        return "0x" + out.hex()

def parse_bytes(expr):
    """Parse `new byte[]{...}` or `{...}` numeric list -> list of ints."""
    inner = expr[expr.find("{") + 1 : expr.rfind("}")]
    if not inner.strip():
        return []
    parts = [p.strip() for p in inner.split(",") if p.strip()]
    vals = []
    for p in parts:
        # variable refs like bArr are handled by var table substitution earlier
        p = re.sub(r"\(byte\)\s*", "", p)
        if p in CONSTS or any(p.startswith(c.split(".")[0]) for c in CONSTS):
            # try direct or dotted
            if p in CONSTS:
                vals.append(CONSTS[p]); continue
            match = [v for k, v in CONSTS.items() if k.endswith(p)]
            if match:
                vals.append(match[0]); continue
        try:
            vals.append(int(p, 0))
        except ValueError:
            return None
    return vals

CALL_RE = re.compile(
    r"WWWWWWWW\.m18953WWWWWWWW\(\s*(new byte\[\]\{[^}]*\})\s*,\s*(new byte\[\]\{[^}]*\}|[A-Za-z_0-9$\u0080-\uffff]+)\s*\)",
    re.S,
)

def process_file(path):
    with open(path, encoding="utf-8", errors="replace") as f:
        src = f.read()
    orig = src
    # collect var tables: byte[] name = {...} (possibly with consts)
    var_re = re.compile(
        r"byte\[\]\s+([A-Za-z_0-9$\u00c0-\uffff]+)\s*=\s*\{([^}]*)\}", re.S
    )
    vars = {}
    for m in var_re.finditer(src):
        vals = parse_bytes("{%s}" % m.group(2))
        if vals is not None:
            vars[m.group(1)] = vals

    def repl(m):
        d = parse_bytes(m.group(1))
        keyexpr = m.group(2)
        if keyexpr.startswith("new byte[]"):
            k = parse_bytes(keyexpr)
        else:
            k = vars.get(keyexpr)
        if d is None or k is None:
            return m.group(0)
        s = xor_decrypt(d, k)
        # produce a readable literal
        esc = s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        return 'DEC(""%s"")' % esc if False else '"%s"' % esc

    out = CALL_RE.sub(repl, src)
    return out if out != orig else None

def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/decompiled/vm-dex/sources"
    out_root = sys.argv[2] if len(sys.argv) > 2 else "/home/z/my-project/decompiled/vm-dex-decrypted"
    count = 0
    changed = 0
    for path in glob.glob(os.path.join(root, "**", "*.java"), recursive=True):
        count += 1
        try:
            res = process_file(path)
        except Exception as e:
            continue
        if res:
            rel = os.path.relpath(path, root)
            dst = os.path.join(out_root, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "w", encoding="utf-8") as f:
                f.write(res)
            changed += 1
    print(f"scanned {count} files, wrote {changed} decrypted files to {out_root}")

if __name__ == "__main__":
    main()

"""
Joymax JMXV kaynak bicimleri (Silkroad Online) okuyuculari.

  BSR  JMXVRES 0109  kaynak: malzeme listesi, mesh listesi, iskelet, animasyon listesi
  BMS  JMXVBMS 0110  mesh: tepe noktalari, (varsa) kemik agirliklari, ucgenler
  BMT  JMXVBMT 0102  malzeme kutuphanesi: ad, renkler, doku yolu
  BSK  JMXVBSK 0101  iskelet: kemik adi, ebeveyn, ebeveyne gore / dunyaya gore donusum
  BAN  JMXVBAN 0102  animasyon: ortak anahtar zamanlari + kemik basina (dortlu, oteleme)
  DDJ  JMXVDDJ       20 bayt baslik + DDS doku

Tum konum/oteleme degerleri Silkroad biriminde (desimetre) ve Silkroad eksenlerinde
dondurulur; web'e donusum (z aynasi, metre) cagiran tarafta yapilir.
"""
import struct


class Reader:
    __slots__ = ("b", "p")

    def __init__(self, data: bytes, pos: int = 0):
        self.b = data
        self.p = pos

    def seek(self, pos):
        self.p = pos
        return self

    def u8(self):
        v = self.b[self.p]
        self.p += 1
        return v

    def u16(self):
        v, = struct.unpack_from("<H", self.b, self.p)
        self.p += 2
        return v

    def u32(self):
        v, = struct.unpack_from("<I", self.b, self.p)
        self.p += 4
        return v

    def f32(self):
        v, = struct.unpack_from("<f", self.b, self.p)
        self.p += 4
        return v

    def floats(self, n):
        v = struct.unpack_from(f"<{n}f", self.b, self.p)
        self.p += 4 * n
        return v

    def str(self):
        n = self.u32()
        s = self.b[self.p:self.p + n].decode("cp949", "replace")
        self.p += n
        return s


def norm_path(p: str) -> str:
    return p.replace("\\", "/").lower().strip()


# ---------------------------------------------------------------- BSR
def parse_bsr(data: bytes):
    if not data.startswith(b"JMXVRES"):
        raise ValueError("BSR degil")
    offs = struct.unpack_from("<13I", data, 12)
    m_off, mesh_off, skel_off, ani_off, pmg_off, pag_off = offs[:6]
    mesh_flag = offs[8]
    r = Reader(data, 12 + 13 * 4)
    res_type = r.u32()
    name = r.str()
    out = {"type": res_type, "name": name, "materials": [], "meshes": [], "skeleton": None, "anims": [], "meshGroups": []}
    r.seek(m_off)
    for _ in range(r.u32()):
        mid = r.u32()
        out["materials"].append((mid, norm_path(r.str())))
    r.seek(mesh_off)
    for _ in range(r.u32()):
        path = norm_path(r.str())
        flag = r.u32() if mesh_flag else 0
        out["meshes"].append((path, flag))
    r.seek(skel_off)
    if skel_off and skel_off < len(data) and r.u32():
        out["skeleton"] = norm_path(r.str())
    r.seek(ani_off)
    if ani_off and ani_off < len(data):
        r.u32(); r.u32()
        for _ in range(r.u32()):
            out["anims"].append(norm_path(r.str()))
    r.seek(pmg_off)
    if pmg_off and pmg_off < len(data):
        try:
            for _ in range(r.u32()):
                gname = r.str()
                idx = [r.u32() for _ in range(r.u32())]
                out["meshGroups"].append((gname, idx))
        except struct.error:
            pass
    return out


# ---------------------------------------------------------------- BMS
def parse_bms(data: bytes):
    if not data.startswith(b"JMXVBMS"):
        raise ValueError("BMS degil")
    v_off, skin_off, face_off = struct.unpack_from("<3I", data, 12)
    r = Reader(data, 60)
    r.u32()                      # alt ilkel sayisi
    vflag = r.u32()
    r.u32()
    name = r.str()
    material = r.str()
    r.seek(v_off)
    nv = r.u32()
    pos = [0.0] * (nv * 3)
    nrm = [0.0] * (nv * 3)
    uv = [0.0] * (nv * 2)
    stride = 32 + (8 if vflag & 0x400 else 0) + (36 if vflag & 0x800 else 0) + 12
    for i in range(nv):
        px, py, pz, nx, ny, nz, u, v = struct.unpack_from("<8f", data, r.p)
        pos[i * 3:i * 3 + 3] = (px, py, pz)
        nrm[i * 3:i * 3 + 3] = (nx, ny, nz)
        uv[i * 2:i * 2 + 2] = (u, v)
        r.p += stride
    bones, skin = [], None
    if skin_off and skin_off < face_off:
        r.seek(skin_off)
        nb = r.u32()
        bones = [r.str() for _ in range(nb)]
        if nb:
            skin = []
            for _ in range(nv):
                b0 = r.u8(); w0 = r.u16(); b1 = r.u8(); w1 = r.u16()
                skin.append((b0, w0, b1, w1))
    r.seek(face_off)
    nf = r.u32()
    idx = list(struct.unpack_from(f"<{nf * 3}H", data, r.p))
    return {"name": name, "material": material, "flags": vflag, "pos": pos, "nrm": nrm, "uv": uv,
            "bones": bones, "skin": skin, "idx": idx}


# ---------------------------------------------------------------- BMT
def parse_bmt(data: bytes):
    r = Reader(data, 12)
    mats = {}
    for _ in range(r.u32()):
        name = r.str()
        diffuse = r.floats(4)
        r.floats(12)             # ortam, yansima, isima renkleri
        r.f32()                  # parlaklik
        flag = r.u32()
        tex = r.str()
        r.f32()
        r.u8(); r.u8(); r.u8()   # bayraklar (normal haritasi vb. sonraki surumlerde)
        if flag & 0x2000:        # normal haritasi bilgisi
            r.str(); r.u32()
        mats[name] = {"diffuse": diffuse, "flag": flag, "texture": norm_path(tex)}
    return mats


# ---------------------------------------------------------------- BSK
def parse_bsk(data: bytes):
    if not data.startswith(b"JMXVBSK"):
        raise ValueError("BSK degil")
    r = Reader(data, 12)
    bones = []
    for _ in range(r.u32()):
        btype = r.u8()
        name = r.str()
        parent = r.str()
        q_par = r.floats(4); t_par = r.floats(3)
        q_world = r.floats(4); t_world = r.floats(3)
        q_inv = r.floats(4); t_inv = r.floats(3)
        children = [r.str() for _ in range(r.u32())]
        bones.append({"type": btype, "name": name, "parent": parent, "q": q_par, "t": t_par,
                      "qw": q_world, "tw": t_world, "qi": q_inv, "ti": t_inv, "children": children})
    return bones


# ---------------------------------------------------------------- BAN
def parse_ban(data: bytes):
    if not data.startswith(b"JMXVBAN"):
        raise ValueError("BAN degil")
    r = Reader(data, 12)
    r.u32(); r.u32()
    name = r.str()
    duration = r.u32()           # ms
    fps = r.u32()
    looped = r.u32()
    times = [r.u32() for _ in range(r.u32())]
    tracks = []
    for _ in range(r.u32()):
        bone = r.str()
        n = r.u32()
        keys = []
        for _ in range(n):
            q = r.floats(4); t = r.floats(3)
            keys.append((q, t))
        tracks.append((bone, keys))
    return {"name": name, "duration": duration, "fps": fps, "looped": looped, "times": times, "tracks": tracks}


def ddj_to_dds(data: bytes) -> bytes:
    return data[20:] if data[:8] == b"JMXVDDJ " else data

"""
Unit Tests for Read-Only PK2 Reader Tool
"""
import os
from tools.pk2_reader import PK2ReadOnlyReader

def test_pk2_readonly_header_read():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    media_pk2 = os.path.join(base_dir, "extracted", "client", "Media.pk2")
    reader = PK2ReadOnlyReader(media_pk2)
    header = reader.read_header()
    assert "JoyMax File Manager" in header["magic"]
    assert header["file_size"] > 100 * 1024 * 1024

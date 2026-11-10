"""A tiny offline stand-in for the meaning model: words with the same meaning share a slot."""

import re
import zlib

import numpy as np

SAME_MEANING = {
    "quiet": "calm", "calm": "calm", "peaceful": "calm",
    "school": "school", "college": "school",
    "veedu": "house", "home": "house", "house": "house", "villa": "house",
    "purayidam": "land", "plot": "land", "land": "land",
    "river": "river", "riverside": "river", "puzha": "river",
    "loan": "finance", "finance": "finance", "emi": "finance",
    "road": "road", "highway": "road",
}  # fmt: skip
IGNORE = {"a", "an", "the", "near", "to", "of", "in", "with", "by", "and", "for", "on", "at", "from", "m", "s", "st"}


class FakeModel:
    def embed(self, texts):
        for t in texts:
            v = np.zeros(512, dtype=np.float32)
            for w in re.findall(r"[a-z]+", t.lower()):
                if w not in IGNORE:
                    v[zlib.crc32(SAME_MEANING.get(w, w).encode()) % 512] += 1
            yield v

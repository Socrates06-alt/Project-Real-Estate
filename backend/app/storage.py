from functools import lru_cache
from pathlib import Path
from typing import Protocol

import httpx

from app.config import get_settings


class StorageError(RuntimeError):
    pass


class Storage(Protocol):
    def put(self, bucket: str, path: str, data: bytes, content_type: str) -> None: ...
    def get(self, bucket: str, path: str) -> bytes: ...
    def delete(self, bucket: str, paths: list[str]) -> None: ...
    def public_url(self, bucket: str, path: str) -> str: ...


class LocalStorage:
    """Development/test storage on local disk. Public bucket is served at /media/<bucket>/."""

    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()

    def _file(self, bucket: str, path: str) -> Path:
        f = (self.root / bucket / path).resolve()
        if self.root not in f.parents:
            raise StorageError("invalid path")
        return f

    def put(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        f = self._file(bucket, path)
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(data)

    def get(self, bucket: str, path: str) -> bytes:
        try:
            return self._file(bucket, path).read_bytes()
        except FileNotFoundError as exc:
            raise StorageError("not found") from exc

    def delete(self, bucket: str, paths: list[str]) -> None:
        for p in paths:
            self._file(bucket, p).unlink(missing_ok=True)

    def public_url(self, bucket: str, path: str) -> str:
        return f"/media/{bucket}/{path}"


class SupabaseStorage:
    def __init__(self, url: str, service_key: str) -> None:
        self.base = f"{url}/storage/v1"
        self.client = httpx.Client(
            base_url=self.base,
            headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
            timeout=30,
        )

    def _check(self, resp: httpx.Response) -> httpx.Response:
        if resp.status_code >= 400:
            raise StorageError(f"storage error {resp.status_code}")
        return resp

    def put(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        self._check(
            self.client.post(
                f"/object/{bucket}/{path}",
                content=data,
                headers={"Content-Type": content_type, "x-upsert": "true", "Cache-Control": "max-age=31536000"},
            )
        )

    def get(self, bucket: str, path: str) -> bytes:
        return self._check(self.client.get(f"/object/{bucket}/{path}")).content

    def delete(self, bucket: str, paths: list[str]) -> None:
        if paths:
            self._check(self.client.request("DELETE", f"/object/{bucket}", json={"prefixes": paths}))

    def public_url(self, bucket: str, path: str) -> str:
        return f"{self.base}/object/public/{bucket}/{path}"


@lru_cache
def get_storage() -> Storage:
    s = get_settings()
    if s.storage_backend == "supabase":
        return SupabaseStorage(s.supabase_url, s.supabase_service_key)
    return LocalStorage(s.local_media_dir)

#!/usr/bin/env python3
"""Local-only preflight for the existing Docker evidence bundle, not a scan."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(member, archive):
    require(member.isfile() and member.size <= 4 * 1024 * 1024,
            "Invalid archive metadata member")
    with archive.extractfile(member) as stream:
        return stream.read()


def verify(directory, expected):
    require(re.fullmatch(r"[0-9a-f]{40}", expected), "Full source SHA required")
    archive_path = directory / "image.tar"
    image_id = (directory / "image-config-id.txt").read_text().strip()
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", image_id), "Invalid image ID")
    require((directory / "build-image-id.txt").read_text().strip() == image_id,
            "Build image ID mismatch")
    checksum = (directory / "image.tar.sha256").read_text().split()
    require(len(checksum) == 2 and checksum[1] == "image.tar" and
            re.fullmatch(r"[0-9a-f]{64}", checksum[0]), "Invalid checksum record")
    # Read through one descriptor so path replacement between hashing and
    # manifest inspection cannot change the file being inspected.
    with archive_path.open("rb") as source:
        digest = hashlib.sha256()
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
        require(digest.hexdigest() == checksum[0], "Archive checksum mismatch")
        source.seek(0)
        with tarfile.open(fileobj=source, mode="r:*") as archive:
            members = {}
            for member in archive:
                require(member.name not in members, "Duplicate archive member")
                members[member.name] = member
            require("manifest.json" in members, "Docker manifest missing")
            manifest = json.loads(read_json(members["manifest.json"], archive))
            require(isinstance(manifest, list) and len(manifest) == 1,
                    "Expected exactly one archived image")
            entry = manifest[0]
            config_path = entry["Config"]
            require(config_path in members, "Archived config missing")
            raw_config = read_json(members[config_path], archive)
            require("sha256:" + hashlib.sha256(raw_config).hexdigest() == image_id,
                    "Archived config digest mismatch")
            config = json.loads(raw_config)
            require(config["architecture"] == "arm64" and config["os"] == "linux",
                    "Archived platform mismatch")
            require(config["config"]["User"] == "10001:10001", "Archived user mismatch")
            require(config["config"]["Labels"]["org.opencontainers.image.revision"] == expected,
                    "Archived source revision mismatch")
            layers = entry["Layers"]
            require(isinstance(layers, list) and len(layers) > 0 and
                    len(layers) == len(config["rootfs"]["diff_ids"]),
                    "Archived layer count mismatch")
            require(all(isinstance(layer, str) and layer in members and
                        members[layer].isfile() for layer in layers),
                    "Archived layer missing or invalid")
    inspected = json.loads((directory / "image-inspect.json").read_text())
    require(isinstance(inspected, list) and len(inspected) == 1,
            "Expected exactly one inspected image")
    image = inspected[0]
    require(image["Id"] == image_id and image["Architecture"] == "arm64" and
            image["Os"] == "linux" and image["Config"]["User"] == "10001:10001" and
            image["Config"]["Labels"]["org.opencontainers.image.revision"] == expected,
            "Recorded image inspection mismatch")
    return {"source": expected, "image_config_id": image_id,
            "archive_sha256": checksum[0], "status": "LOCAL_IDENTITY_PREFLIGHT_ONLY"}


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 3, "Usage: verify-image-evidence.py DIRECTORY EXACT_SOURCE_SHA")
        print(json.dumps(verify(Path(sys.argv[1]), sys.argv[2]), sort_keys=True))
    except (ValueError, OSError, KeyError, TypeError, AttributeError, tarfile.TarError) as exc:
        print("Evidence preflight failed: " + str(exc), file=sys.stderr)
        sys.exit(1)

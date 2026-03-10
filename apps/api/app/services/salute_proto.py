from __future__ import annotations

import importlib
import sys
from pathlib import Path

from grpc_tools import protoc
import grpc_tools


PROTO_DIR = Path(__file__).resolve().parent.parent / "protos"
GENERATED_DIR = Path(__file__).resolve().parent.parent / "_generated" / "salute"


def ensure_salute_proto_modules() -> tuple[object, object]:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    init_file = GENERATED_DIR / "__init__.py"
    if not init_file.exists():
        init_file.write_text("", encoding="utf-8")

    recognition_pb2_file = GENERATED_DIR / "recognition_pb2.py"
    recognition_pb2_grpc_file = GENERATED_DIR / "recognition_pb2_grpc.py"

    if _should_generate(recognition_pb2_file, recognition_pb2_grpc_file):
        _generate_modules()

    generated_path = str(GENERATED_DIR)
    if generated_path not in sys.path:
        sys.path.insert(0, generated_path)

    recognition_pb2 = importlib.import_module("recognition_pb2")
    recognition_pb2_grpc = importlib.import_module("recognition_pb2_grpc")
    return recognition_pb2, recognition_pb2_grpc


def _should_generate(*targets: Path) -> bool:
    proto_mtime = max(
        (PROTO_DIR / "recognition.proto").stat().st_mtime,
        (PROTO_DIR / "task.proto").stat().st_mtime,
    )
    for target in targets:
        if not target.exists() or target.stat().st_mtime < proto_mtime:
            return True
    return False


def _generate_modules() -> None:
    include_dir = Path(grpc_tools.__file__).resolve().parent / "_proto"
    args = [
        "grpc_tools.protoc",
        f"-I{PROTO_DIR}",
        f"-I{include_dir}",
        f"--python_out={GENERATED_DIR}",
        f"--grpc_python_out={GENERATED_DIR}",
        str(PROTO_DIR / "task.proto"),
        str(PROTO_DIR / "recognition.proto"),
    ]
    result = protoc.main(args)
    if result != 0:
        raise RuntimeError("Failed to generate SaluteSpeech protobuf modules")

#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'Usage: %s <query> [all|guides|api|specs|classes|readme]\n' "$(basename "$0")" >&2
  exit 1
fi

query="$1"
section="${2:-all}"
workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="${workspace_root}/vendor/godot_voxel"

if [[ ! -d "${repo_root}" ]]; then
  printf 'Repo nicht gefunden: %s. Zuerst scripts/update-voxel-docs.ps1 oder scripts/update-voxel-docs.sh ausführen.\n' "${repo_root}" >&2
  exit 1
fi

case "${section}" in
  guides)
    targets=("${repo_root}/doc/source")
    ;;
  api)
    targets=("${repo_root}/doc/source/api")
    ;;
  specs)
    targets=("${repo_root}/doc/source/specs")
    ;;
  classes)
    targets=("${repo_root}/doc/classes")
    ;;
  readme)
    targets=("${repo_root}/README.md")
    ;;
  all)
    targets=(
      "${repo_root}/README.md"
      "${repo_root}/doc/graph_nodes.xml"
      "${repo_root}/doc/source"
      "${repo_root}/doc/classes"
    )
    ;;
  *)
    printf 'Ungültige section: %s\n' "${section}" >&2
    exit 1
    ;;
esac

if command -v rg >/dev/null 2>&1; then
  rg --line-number --ignore-case --fixed-strings "${query}" "${targets[@]}"
else
  grep -RinF -- "${query}" "${targets[@]}"
fi

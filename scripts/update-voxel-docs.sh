#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
vendor_root="${workspace_root}/vendor"
repo_root="${vendor_root}/godot_voxel"
repo_url="https://github.com/Zylann/godot_voxel.git"

mkdir -p "${vendor_root}"

if [[ ! -d "${repo_root}/.git" ]]; then
  git clone --depth 1 "${repo_url}" "${repo_root}"
else
  git -C "${repo_root}" fetch --depth 1 origin master
  git -C "${repo_root}" reset --hard origin/master
fi

commit="$(git -C "${repo_root}" rev-parse HEAD)"
date="$(git -C "${repo_root}" log -1 --format=%cI)"

printf 'Voxel-Tools-Doku aktualisiert.\n'
printf 'Pfad: %s\n' "${repo_root}"
printf 'Commit: %s\n' "${commit}"
printf 'Datum: %s\n' "${date}"

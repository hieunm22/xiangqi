<#
  Copy-ChangedFiles.ps1
  - Copy các file mới/sửa từ Git working tree vào một thư mục output, giữ nguyên cấu trúc thư mục.
  - Mặc định so với HEAD. Có thể đổi base ref qua -BaseRef origin/main ...
  - Bao gồm: unstaged, staged, untracked (có thể tắt từng loại).
#>

param(
  [string]$OutputDir,
  [string]$BaseRef = "HEAD",
  [switch]$NoStaged,
  [switch]$NoUnstaged,
  [switch]$NoUntracked
)

$ErrorActionPreference = "Stop"

# Xác định repo root
$repoRoot = (git rev-parse --show-toplevel) 2>$null
if (-not $repoRoot) {
  Write-Error "Không ở trong một Git repository. Hãy chạy script bên trong repo."
  exit 1
}
Set-Location $repoRoot

# Xử lý lựa chọn include/exclude
$IncludeStaged    = -not $NoStaged
$IncludeUnstaged  = -not $NoUnstaged
$IncludeUntracked = -not $NoUntracked

# Chọn thư mục output (có hộp thoại nếu không truyền tham số)
if (-not $OutputDir) {
  try {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Chọn thư mục output để copy các file thay đổi"
    $dialog.ShowNewFolderButton = $true
    $result = $dialog.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
      $OutputDir = $dialog.SelectedPath
    } else {
      $OutputDir = Read-Host "Nhập đường dẫn thư mục output"
    }
  } catch {
    $OutputDir = Read-Host "Nhập đường dẫn thư mục output"
  }
}
if (-not $OutputDir) {
  Write-Error "OutputDir không được để trống."
  exit 1
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Thu thập danh sách file
$set = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)

function Add-Path([string]$p) {
  if ([string]::IsNullOrWhiteSpace($p)) { return }
  # Chỉ copy file tồn tại (bỏ qua file đã xóa)
  if (Test-Path -LiteralPath $p -PathType Leaf) {
    $null = $set.Add($p)
  }
}

if ($IncludeUnstaged) {
  git diff --name-only --diff-filter=AMR $BaseRef | ForEach-Object { Add-Path $_ }
}
if ($IncludeStaged) {
  git diff --name-only --diff-filter=AMR --cached $BaseRef | ForEach-Object { Add-Path $_ }
}
if ($IncludeUntracked) {
  git ls-files --others --exclude-standard | ForEach-Object { Add-Path $_ }
}

if ($set.Count -eq 0) {
  Write-Host "Không có file mới/sửa so với $BaseRef."
  exit 0
}

# Copy giữ nguyên cấu trúc
$copied = 0
foreach ($p in $set) {
  $dest = Join-Path -Path $OutputDir -ChildPath $p
  $destDir = Split-Path -Path $dest -Parent
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  Copy-Item -LiteralPath $p -Destination $dest -Force
  $copied++
}

Write-Host "Đã copy $copied file vào: $OutputDir"
Write-Host "So sánh dựa trên: $BaseRef (Staged:$($IncludeStaged) Unstaged:$($IncludeUnstaged) Untracked:$($IncludeUntracked))"
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
Param(
  [string]$Version,
  [ValidateSet("patch", "minor", "major")]
  [string]$Bump
)

$ErrorActionPreference = 'Stop'

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  # Handle version bumping if requested
  if ($Bump) {
    Write-Host "Bumping version ($Bump)..."
    
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    $currentVersion = $pkg.version
    Write-Host "Current version: $currentVersion"
    
    # Parse version parts
    $versionParts = $currentVersion -split '\.'
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1] 
    $patch = [int]$versionParts[2]
    
    # Bump according to type
    switch ($Bump) {
      "major" { 
        $major++; $minor = 0; $patch = 0 
      }
      "minor" { 
        $minor++; $patch = 0 
      }
      "patch" { 
        $patch++ 
      }
    }
    
    $newVersion = "$major.$minor.$patch"
    Write-Host "New version: $newVersion"
    
    # Update package.json
    $pkg.version = $newVersion
    $json = $pkg | ConvertTo-Json -Depth 10
    Set-Content -Path package.json -Value $json -NoNewline
    Write-Host "Updated package.json to version $newVersion"
    
    $Version = $newVersion
  }

  if(-not $Version){
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    $Version = $pkg.version
  }
  Write-Host "Building VSIX for version $Version"

  # Make sure package-lock.json reflects the same top-level version
  $lockPath = "package-lock.json"
  if(Test-Path $lockPath){
    try{
      Write-Host "Refreshing package-lock.json to match current package.json version"
      npm install --package-lock-only | Out-Null
    } catch {
      Write-Warning ("npm package-lock-only failed: " + $_.ToString())
    }
  }

  npm run build | Out-Null

  # Use package.json name for VSIX filename prefix
  $pkg = Get-Content package.json -Raw | ConvertFrom-Json
  $pkgId = if($pkg.name){ [string]$pkg.name } else { 'promptvault' }
  $pkgName = "$pkgId-$Version"
  if(Test-Path "$pkgName.vsix"){ Remove-Item "$pkgName.vsix" -Force }
  if(Test-Path vsix_build){ Remove-Item vsix_build -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path 'vsix_build' 'extension') | Out-Null

  $cwd = (Get-Location).Path

  # Copy filtered content (platform-agnostic)
  Get-ChildItem -Recurse -File | Where-Object {
    try {
      $rel = [System.IO.Path]::GetRelativePath($cwd, $_.FullName)
    } catch {
      # Fall back to substring if GetRelativePath isn't available
      $rel = $_.FullName.Substring($cwd.Length+1)
    }
    $norm = $rel -replace '\\','/'
    ($norm -notmatch '(^|/)(node_modules|vsix_build|\.git)($|/)') -and ($_.Name -notmatch '\.vsix$')
  } | ForEach-Object {
    try {
      $rel = [System.IO.Path]::GetRelativePath($cwd, $_.FullName)
    } catch {
      $rel = $_.FullName.Substring($cwd.Length+1)
    }
    $dest = Join-Path "vsix_build/extension" $rel
    $destDir = Split-Path $dest -Parent
    if(-not (Test-Path $destDir)){ New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $_.FullName $dest -Force
  }

  Copy-Item vsix/extension.vsixmanifest vsix_build/extension.vsixmanifest -Force
  Copy-Item vsix/[Content_Types].xml vsix_build/[Content_Types].xml -Force
  if(Test-Path vsix/_rels){
    Copy-Item vsix/_rels -Destination vsix_build/_rels -Recurse -Force
  }

  # Inject updated Identity (extension) version, publisher, and id into vsix manifest from package.json
  $manifestPath = "vsix_build/extension.vsixmanifest"
  $manifestContent = Get-Content $manifestPath -Raw
  # IMPORTANT: Do not overwrite the PackageManifest schema Version attribute; only update the Identity Version.
  $manifestContent = [System.Text.RegularExpressions.Regex]::Replace($manifestContent, '<Identity([^>]+)Version="[^"]+"', '<Identity$1Version="' + $Version + '"')

  if($pkg.publisher){
    $pub = [string]$pkg.publisher
    if($pub -notmatch '^[a-z0-9][a-z0-9-]*$'){
      Write-Error "Invalid publisher id '$pub'. Publisher must be the Marketplace publisher identifier (lowercase letters, digits, dashes) – e.g. 'mycompany'. Update package.json 'publisher' and try again."
    }
    $manifestContent = [System.Text.RegularExpressions.Regex]::Replace($manifestContent, 'Publisher="[^"]+"', 'Publisher="' + $pub + '"')
  }
  if($pkg.name){
    $id = [string]$pkg.name
    if($id -notmatch '^[a-z0-9][a-z0-9-]*$'){
      Write-Error "Invalid extension name '$id'. Name must be lowercase letters, digits, dashes. Update package.json 'name' and try again."
    }
    $manifestContent = [System.Text.RegularExpressions.Regex]::Replace($manifestContent, 'Id="[^"]+"', 'Id="' + $id + '"')
  }
  Set-Content -Path $manifestPath -Value $manifestContent -NoNewline

  # Keep the source manifest in sync to prevent CI drift
  try {
    $srcManifestPath = "vsix/extension.vsixmanifest"
    if(Test-Path $srcManifestPath){
      $srcContent = Get-Content $srcManifestPath -Raw
  # Only update Identity Version in source manifest also
  $srcContent = [System.Text.RegularExpressions.Regex]::Replace($srcContent, '<Identity([^>]+)Version="[^"]+"', '<Identity$1Version="' + $Version + '"')
      Set-Content -Path $srcManifestPath -Value $srcContent -NoNewline
    }
  } catch {
    Write-Warning ("Failed to update source manifest: " + $_.ToString())
  }

  # Also update the packaged copy of package.json so VS Code reads the correct version/publisher
  $pkgCopyPath = "vsix_build/extension/package.json"
  if(Test-Path $pkgCopyPath){
    try{
      $pkgCopyRaw = Get-Content $pkgCopyPath -Raw
      $pkgCopy = $pkgCopyRaw | ConvertFrom-Json
      $pkgCopy.version = $Version
      if($pkg.publisher){ $pkgCopy.publisher = $pkg.publisher }
      if($pkg.label){ $pkgCopy.label = $pkg.label }
      $json = $pkgCopy | ConvertTo-Json -Depth 10
      # write pretty JSON (preserve newline at EOF)
      Set-Content -Path $pkgCopyPath -Value $json -NoNewline
      Write-Host "Updated $pkgCopyPath to version $Version"
    } catch {
      Write-Warning ("Failed to update " + $pkgCopyPath + ": " + $_.ToString())
    }
  }

  # Repack preserving folder structure (need extension/package.json path)
  if(Test-Path "$pkgName.vsix"){ Remove-Item "$pkgName.vsix" -Force }
  $current = Get-Location
  Push-Location vsix_build
  try {
    $paths = @('extension','extension.vsixmanifest','[Content_Types].xml')
    if(Test-Path '_rels'){ $paths += '_rels' }

    $created = $false

    # Prefer Compress-Archive (PowerShell), then zip CLI, then .NET ZipFile as a last resort
    if (Get-Command -Name Compress-Archive -ErrorAction SilentlyContinue) {
      try {
        Compress-Archive -Path $paths -DestinationPath "${current}/$pkgName.vsix" -Force
        $created = $true
      } catch {
        Write-Warning "Compress-Archive failed: $($_.Exception.Message)"
      }
    }

    if (-not $created -and (Get-Command -Name zip -ErrorAction SilentlyContinue)) {
      try {
        & zip -r -q "${current}/$pkgName.vsix" @paths
        $created = $true
      } catch {
        Write-Warning "zip CLI failed: $($_.Exception.Message)"
      }
    } elseif (-not $created -and -not (Get-Command -Name zip -ErrorAction SilentlyContinue)) {
      # Check if we're on macOS and can suggest Homebrew installation
      if ($IsMacOS -or ((Get-WmiObject -Class Win32_OperatingSystem -ErrorAction SilentlyContinue) -eq $null -and (uname 2>/dev/null) -match "Darwin")) {
        if (Get-Command -Name brew -ErrorAction SilentlyContinue) {
          Write-Warning "zip CLI not found. Install with: brew install zip"
        } else {
          Write-Warning "zip CLI not found. Install Homebrew (https://brew.sh) then run: brew install zip"
        }
      } elseif ($IsLinux -or ((Get-WmiObject -Class Win32_OperatingSystem -ErrorAction SilentlyContinue) -eq $null -and (uname 2>/dev/null) -match "Linux")) {
        Write-Warning "zip CLI not found. Install with your package manager (e.g., apt install zip, yum install zip)"
      }
    }

    if (-not $created) {
      try {
        Add-Type -AssemblyName 'System.IO.Compression.FileSystem' -ErrorAction Stop
        [System.IO.Compression.ZipFile]::CreateFromDirectory((Get-Location).Path, "${current}/$pkgName.vsix")
        $created = $true
      } catch {
        throw "Failed to create VSIX archive. Install the 'zip' utility or run PowerShell with Compress-Archive support."
      }
    }
  } finally { Pop-Location }

  Write-Host "Created $pkgName.vsix"
  Write-Host "Install with: code --install-extension ./$pkgName.vsix"
  
  # Copy VSIX to build folder
  if(-not (Test-Path 'build')){ 
    New-Item -ItemType Directory -Path 'build' | Out-Null
    Write-Host "Created build directory"
  }
  Copy-Item "$pkgName.vsix" "build/$pkgName.vsix" -Force
  Write-Host "Copied $pkgName.vsix to build folder"
  
  # Cleanup the staging folder so stale copies are not left around
  try {
    if(Test-Path 'vsix_build'){
      Remove-Item -Recurse -Force 'vsix_build'
      Write-Host "Removed staging folder 'vsix_build'"
    }
  } catch {
    Write-Warning ("Failed to remove vsix_build: " + $_.ToString())
  }
}
finally {
  Pop-Location
}

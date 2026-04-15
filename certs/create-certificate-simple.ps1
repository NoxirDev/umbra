# Simplified certificate creation script (no admin rights required)
# Creates a self-signed certificate in CurrentUser store

$ErrorActionPreference = "Stop"

Write-Host "=== Creating Self-Signed Certificate for UMBRA MSIX ===" -ForegroundColor Cyan

# Certificate parameters
$certName = "CN=Noxir"
$certFriendlyName = "UMBRA Code Signing Certificate"
$certOutputPath = ".\umbra-signing-cert.pfx"
$certPassword = "umbra123"  # Change this in production!

# Create certificate in CurrentUser store (no admin required)
Write-Host "Creating self-signed certificate in CurrentUser store..." -ForegroundColor Green
try {
    $cert = New-SelfSignedCertificate `
        -Type CodeSigning `
        -Subject $certName `
        -FriendlyName $certFriendlyName `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256 `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(5) `
        -KeyUsage DigitalSignature, KeyEncipherment `
        -KeySpec Signature `
        -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider"
    
    if ($cert) {
        Write-Host "Certificate created successfully!" -ForegroundColor Green
        Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor Yellow
        Write-Host "Subject: $($cert.Subject)" -ForegroundColor Yellow
        Write-Host "Expires: $($cert.NotAfter)" -ForegroundColor Yellow
        
        # Export certificate to PFX file
        Write-Host "Exporting certificate to PFX file..." -ForegroundColor Green
        $securePassword = ConvertTo-SecureString -String $certPassword -Force -AsPlainText
        Export-PfxCertificate -Cert $cert -FilePath $certOutputPath -Password $securePassword | Out-Null
        
        # Also export public key (CER) for verification
        Export-Certificate -Cert $cert -FilePath ".\umbra-signing-cert.cer" | Out-Null
        
        Write-Host "Certificate exported to:" -ForegroundColor Green
        Write-Host "  - PFX (private key): $certOutputPath" -ForegroundColor Yellow
        Write-Host "  - CER (public key): .\umbra-signing-cert.cer" -ForegroundColor Yellow
        Write-Host "  - Password: $certPassword" -ForegroundColor Yellow
        
        # Note about Trusted Root
        Write-Host "`n=== Important Note ===" -ForegroundColor Cyan
        Write-Host "For MSIX packages to be trusted on other machines:" -ForegroundColor Yellow
        Write-Host "1. Install the CER file to 'Trusted Root Certification Authorities' on target machines" -ForegroundColor Yellow
        Write-Host "2. Or use a commercial code signing certificate from a trusted CA" -ForegroundColor Yellow
        
        # Instructions for electron-builder
        Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
        Write-Host "1. Update package.json with certificate info:" -ForegroundColor Yellow
        Write-Host '   "win": {' -ForegroundColor Gray
        Write-Host '     "certificateFile": "./certs/umbra-signing-cert.pfx",' -ForegroundColor Gray
        Write-Host '     "certificatePassword": "umbra123",' -ForegroundColor Gray
        Write-Host '     "sign": true' -ForegroundColor Gray
        Write-Host '   }' -ForegroundColor Gray
        Write-Host "2. Build MSIX package: npm run build:msix" -ForegroundColor Yellow
        Write-Host "3. Test installation: double-click the .msix file" -ForegroundColor Yellow
        
    } else {
        Write-Host "Failed to create certificate!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error creating certificate: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Done! ===" -ForegroundColor Green
# Azure Site Recovery with Customer-Managed Keys (CMK) - POC

This project demonstrates Azure Site Recovery (ASR) implementation with Customer-Managed Key (CMK) encryption using Pulumi and TypeScript. It provides a complete proof-of-concept for disaster recovery scenarios where virtual machines with CMK-encrypted disks need to be replicated across Azure regions.

## 🎯 Project Overview

This POC provides the foundation for implementing:
- **Azure Site Recovery (ASR)** for cross-region VM replication
- **Customer-Managed Key (CMK) encryption** for enhanced security
- **Automated infrastructure deployment** using Pulumi
- **Comprehensive testing framework** for disaster recovery scenarios

## 📋 Prerequisites

### Required Tools
- **Azure CLI** installed and configured (`az login`)
- **Node.js** (LTS version) installed
- **Pulumi CLI** installed and configured
- **PowerShell** (for validation scripts)

### Azure Requirements
- Active Azure subscription with appropriate permissions
- Ability to create resources in two Azure regions
- **Key Vault Administrator** role or equivalent permissions
- **Storage Blob Data Contributor** role for Pulumi state backend

## 🚀 Getting Started

### Setup Pulumi Backend

```bash
# Clone and navigate to project
cd poc-asr-cmk

# Setup automated Pulumi backend with Azure Blob Storage
./setup-pulumi-backend.sh

# Validate setup and CMK prerequisites
./validate-backend.sh
```

### What the Backend Setup Provides

The automated backend setup creates:

- **Resource Group**: `pulumi-state-cmk-rg` in `eastus`
- **Storage Account**: `pulumistatecmk<unique_suffix>` with Standard_LRS
- **Blob Container**: `pulumi-backend-cmk` with private access
- **RBAC Permissions**: Storage Blob Data Contributor role assignment
- **Pulumi Login**: Automatic login to `azblob://pulumi-backend-cmk`

### Validation Features

The validation script checks:

- ✅ **Key Vault Service Access**: Validates user can access Azure Key Vault service
- ✅ **Disk Encryption Set Service Access**: Validates user can access DES service  
- ✅ **Key Vault RBAC Permissions**: Checks for Key Vault Administrator or equivalent roles
- ✅ **VM Size Availability**: Verifies Standard_DS2_v2 VM size is available in target region
- ✅ **Azure CLI Extensions**: Validates Key Vault CLI commands are available
- ✅ **Cross-Region Validation**: Ensures both source and target regions are accessible

### Pulumi Configuration

Since `Pulumi.dev.yaml` is excluded from version control for security reasons, you need to create and configure it locally after setting up the backend.

#### Configuration File Setup

Create a `Pulumi.dev.yaml` file in the project root with the following structure:

```yaml
encryptionsalt: v1:Nbyai7cCbXw=:v1:V+X0OMAPW+Vc7TtY:eC9aesY108uutfwbI2IlmePhCfLG+A==
config:
  azure-native:location: eastus
  pulumi-asr-cmk-poc:targetLocation: westus
  pulumi-asr-cmk-poc:resourceGroupNamePrefix: cmkAsrPoc
  pulumi-asr-cmk-poc:vmAdminUsername: azureuser
  pulumi-asr-cmk-poc:vmAdminPassword:
    secure: v1:DmE5mEeNw76HMFPQ:tPHKJwWydH/GoMwLfH9nQG1ZUDR8sdr+qo6oFQ==
  pulumi-asr-cmk-poc:sourceVmName: sourcevm-cmk
  pulumi-asr-cmk-poc:vmSize: Standard_DS2_v2
  pulumi-asr-cmk-poc:keyVaultNamePrefix: cmkAsrKv
  pulumi-asr-cmk-poc:sourceKeyName: source-disk-key
  pulumi-asr-cmk-poc:targetKeyName: target-disk-key
  pulumi-asr-cmk-poc:sourceVmImagePublisher: Canonical
  pulumi-asr-cmk-poc:sourceVmImageOffer: 0001-com-ubuntu-server-focal
  pulumi-asr-cmk-poc:sourceVmImageSku: 20_04-lts-gen2
  pulumi-asr-cmk-poc:sourceVmImageVersion: 20.04.202109080
```

#### Required Configuration Values

| Configuration Key | Description | Example Value |
|-------------------|-------------|---------------|
| `azure-native:location` | Primary Azure region for source resources | `eastus` |
| `pulumi-asr-cmk-poc:targetLocation` | Target Azure region for ASR replication | `westus` |
| `pulumi-asr-cmk-poc:resourceGroupNamePrefix` | Prefix for resource group names | `cmkAsrPoc` |
| `pulumi-asr-cmk-poc:vmAdminUsername` | VM administrator username | `azureuser` |
| `pulumi-asr-cmk-poc:vmAdminPassword` | VM administrator password (encrypted) | `<secure_value>` |
| `pulumi-asr-cmk-poc:sourceVmName` | Name of the source VM | `sourcevm-cmk` |
| `pulumi-asr-cmk-poc:vmSize` | Azure VM size | `Standard_DS2_v2` |
| `pulumi-asr-cmk-poc:keyVaultNamePrefix` | Prefix for Key Vault names | `cmkAsrKv` |
| `pulumi-asr-cmk-poc:sourceKeyName` | Name of the source encryption key | `source-disk-key` |
| `pulumi-asr-cmk-poc:targetKeyName` | Name of the target encryption key | `target-disk-key` |
| `pulumi-asr-cmk-poc:sourceVmImagePublisher` | VM image publisher | `Canonical` |
| `pulumi-asr-cmk-poc:sourceVmImageOffer` | VM image offer | `0001-com-ubuntu-server-focal` |
| `pulumi-asr-cmk-poc:sourceVmImageSku` | VM image SKU | `20_04-lts-gen2` |
| `pulumi-asr-cmk-poc:sourceVmImageVersion` | VM image version | `20.04.202109080` |

#### Setting Configuration Values

You can set configuration values using the Pulumi CLI:

```bash
# Set basic configuration
pulumi config set azure-native:location eastus
pulumi config set pulumi-asr-cmk-poc:targetLocation westus
pulumi config set pulumi-asr-cmk-poc:resourceGroupNamePrefix cmkAsrPoc
pulumi config set pulumi-asr-cmk-poc:vmAdminUsername azureuser
pulumi config set pulumi-asr-cmk-poc:sourceVmName sourcevm-cmk
pulumi config set pulumi-asr-cmk-poc:vmSize Standard_DS2_v2

# Set Key Vault and encryption configuration
pulumi config set pulumi-asr-cmk-poc:keyVaultNamePrefix cmkAsrKv
pulumi config set pulumi-asr-cmk-poc:sourceKeyName source-disk-key
pulumi config set pulumi-asr-cmk-poc:targetKeyName target-disk-key

# Set VM image configuration
pulumi config set pulumi-asr-cmk-poc:sourceVmImagePublisher Canonical
pulumi config set pulumi-asr-cmk-poc:sourceVmImageOffer 0001-com-ubuntu-server-focal
pulumi config set pulumi-asr-cmk-poc:sourceVmImageSku 20_04-lts-gen2
pulumi config set pulumi-asr-cmk-poc:sourceVmImageVersion 20.04.202109080

# Set secure password (will be encrypted automatically)
pulumi config set --secret pulumi-asr-cmk-poc:vmAdminPassword <your_secure_password>
```

**Important Notes:**
- The `vmAdminPassword` should be set as a secret using the `--secret` flag
- Ensure your password meets Azure VM password requirements (12+ characters, complexity requirements)
- The `encryptionsalt` is generated automatically when you first set a secret value
- All team members need to configure their own `Pulumi.dev.yaml` file locally
- CMK-specific configuration includes Key Vault and encryption key settings

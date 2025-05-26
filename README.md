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

## 🏗️ Deployment

### Step 1: Deploy Infrastructure with Pulumi

After configuring your Pulumi settings, deploy the infrastructure:

```bash
# Install dependencies
npm install

# Deploy the infrastructure
pulumi up
```

This will create:
- **Source and Target Resource Groups** with networking (VNets, subnets)
- **Key Vaults** with encryption keys in both regions
- **Disk Encryption Sets (DES)** for CMK encryption
- **Source Virtual Machine** with CMK-encrypted disks
- **Recovery Services Vault** with ASR configuration
- **ASR Fabrics, Protection Containers, and Mappings**

### Step 2: Enable ASR Replication with CMK (Azure Portal)

⚠️ **Important**: Due to PowerShell cmdlet limitations with CMK parameter combinations, ASR replication must be enabled manually through the Azure Portal.

#### Azure Portal Steps:

1. **Navigate to Recovery Services Vault**
   - Go to Azure Portal → Resource Groups → `cmkAsrPoc-recovery-rg`
   - Click on the Recovery Services Vault: `cmkAsrPoc-rsv`

2. **Start Replication Setup**
   - In the vault, go to **Site Recovery** → **Replicated items**
   - Click **"+ Enable replication"**

3. **Configure Source Settings**
   - **Source**: Select "Azure virtual machines"
   - **Source location**: Choose your source region (e.g., `East US`)
   - **Azure virtual machine deployment model**: Resource Manager
   - **Source subscription**: Your subscription
   - **Source resource group**: `cmkAsrPoc-source-rg`

4. **Select Virtual Machines**
   - Choose your source VM: `sourcevm-cmk`
   - Click **Next**

5. **Configure Target Settings**
   - **Target location**: Your target region (e.g., `West US`)
   - **Target subscription**: Your subscription
   - **Target resource group**: `cmkAsrPoc-target-rg`
   - **Target virtual network**: `target-vnet`
   - **Target subnet**: `target-subnet`

6. **Configure Storage Encryption (Critical Step)**
   - In **"Storage encryption settings"**, select **"Customer-managed key"**
   - **Target Disk Encryption Set**: Choose `cmkAsrPoc-target-des`
   - This ensures replicated disks use your CMK encryption

7. **Configure Replication Settings**
   - **Replication policy**: Select `asr-cmk-policy`
   - **Cache storage account**: Select `asrcmkasrpoccache`
   - **Multi-VM consistency**: Enable if desired

8. **Review and Enable**
   - Review all settings, especially the CMK encryption configuration
   - Click **"Enable replication"**

#### Verification Steps:

After enabling replication:

1. **Monitor Initial Replication**
   - Go to **Site Recovery** → **Replicated items**
   - Check the status of `sourcevm-cmk`
   - Initial replication may take 30-60 minutes

2. **Verify Source VM CMK Encryption**
   - Navigate to **Virtual machines** → `sourcevm-cmk`
   - Go to **Disks** section
   - Verify both OS and data disks show **"SSE with customer-managed key"**
   - Click on **"SSE with customer-managed key"** link to verify it shows the correct DES: `cmkAsrPoc-source-des`

3. **Verify Target CMK Configuration**
   - Once replication starts, check target disk encryption settings
   - In ASR replication settings, verify target DES (`cmkAsrPoc-target-des`) is properly applied
   - Monitor replication progress in **Site Recovery** → **Replicated items**

4. **Test Failover (Optional)**
   - After initial replication completes (status shows "Protected")
   - Perform a test failover to validate the setup:
     - Go to **Site Recovery** → **Replicated items** → `sourcevm-cmk`
     - Click **Test failover**
     - Select a recovery point and target network
     - After failover completes, verify the test VM disk encryption:
       - Navigate to the test VM → **Disks**
       - Verify disks show **"SSE with customer-managed key"**
       - Click on **"SSE with customer-managed key"** to confirm it shows `cmkAsrPoc-target-des`
   - **Important**: Clean up test failover after verification

## 📚 Reference Documentation

- [Azure Site Recovery with CMK](https://learn.microsoft.com/en-us/azure/site-recovery/azure-to-azure-how-to-enable-replication-cmk-disks)
- [Azure Disk Encryption Sets](https://docs.microsoft.com/en-us/azure/virtual-machines/disk-encryption)
- [Azure Key Vault for CMK](https://docs.microsoft.com/en-us/azure/key-vault/general/customer-managed-keys)

## 🧹 Cleanup

To remove all resources:

```bash
# Destroy Pulumi infrastructure
pulumi destroy

# Optionally remove Pulumi backend resources
# (Only if you no longer need the state backend)
az group delete --name pulumi-state-cmk-rg --yes
```

**Note**: Ensure ASR replication is disabled before destroying resources to avoid dependency issues.

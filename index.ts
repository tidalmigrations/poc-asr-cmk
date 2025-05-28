// Provided by Tidal <support@tidalcloud.com>

import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as network from "@pulumi/azure-native/network";
import * as keyvault from "@pulumi/azure-native/keyvault";
import * as compute from "@pulumi/azure-native/compute";
import * as recoveryservices from "@pulumi/azure-native/recoveryservices";
import * as storage from "@pulumi/azure-native/storage";
import * as authorization from "@pulumi/azure-native/authorization";
import * as command from "@pulumi/command";

// Azure Site Recovery with Customer-Managed Keys (CMK) POC
// 
// This implementation demonstrates Azure Site Recovery (ASR) with Customer-Managed Key (CMK) encryption
// for both source and target virtual machines and their associated disks.
//
// Key Components:
// - Source and Target Key Vaults with encryption keys
// - Disk Encryption Sets (DES) for both regions
// - Virtual machines with CMK-encrypted disks
// - Azure Site Recovery configuration for cross-region replication
//
// Operating System Support Notes:
// According to https://aka.ms/a2a_supported_linux_os_versions:
// - Ubuntu 20.04 LTS: Supported kernels include 5.4.x, 5.8.x, 5.11.x, 5.13.x series
// - This deployment uses Ubuntu 20.04 LTS for maximum ASR compatibility

// Get current Azure client configuration
const clientConfig = authorization.getClientConfig();

// Get configuration values
const config = new pulumi.Config();
const azureConfig = new pulumi.Config("azure-native");
const location = azureConfig.require("location");
const targetLocation = config.require("targetLocation");
const resourceGroupNamePrefix = config.require("resourceGroupNamePrefix");
const vmAdminUsername = config.require("vmAdminUsername");
const vmAdminPassword = config.requireSecret("vmAdminPassword");
const sourceVmName = config.require("sourceVmName");
const vmSize = config.require("vmSize");
const keyVaultNamePrefix = config.require("keyVaultNamePrefix");
const sourceKeyName = config.require("sourceKeyName");
const targetKeyName = config.require("targetKeyName");

// VM Image Configuration - Using Ubuntu 20.04 LTS for Azure Site Recovery compatibility
const sourceVmImagePublisher = config.get("sourceVmImagePublisher") || "Canonical";
const sourceVmImageOffer = config.get("sourceVmImageOffer") || "0001-com-ubuntu-server-focal";
const sourceVmImageSku = config.get("sourceVmImageSku") || "20_04-lts-gen2";
const sourceVmImageVersion = config.get("sourceVmImageVersion") || "20.04.202109080";

// Generate unique suffixes for globally unique resource names
const uniqueSuffix = pulumi.getStack().toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 8);

// =============================================================================
// Phase 1: Core Infrastructure - Resource Groups & Networking
// =============================================================================

// 3. Create Resource Groups

// Source Resource Group
const sourceResourceGroup = new resources.ResourceGroup("sourceResourceGroup", {
    resourceGroupName: `${resourceGroupNamePrefix}-source-rg`,
    location: location,
});

// Target Resource Group  
const targetResourceGroup = new resources.ResourceGroup("targetResourceGroup", {
    resourceGroupName: `${resourceGroupNamePrefix}-target-rg`,
    location: targetLocation,
});

// Recovery Services Resource Group
const recoveryResourceGroup = new resources.ResourceGroup("recoveryResourceGroup", {
    resourceGroupName: `${resourceGroupNamePrefix}-recovery-rg`,
    location: targetLocation,
});

// 4. Setup Source Region Networking

// Source Virtual Network (VNet)
const sourceVNet = new network.VirtualNetwork("sourceVNet", {
    virtualNetworkName: "source-vnet",
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
});

// Source Subnet
const sourceSubnet = new network.Subnet("sourceSubnet", {
    subnetName: "source-subnet", 
    resourceGroupName: sourceResourceGroup.name,
    virtualNetworkName: sourceVNet.name,
    addressPrefix: "10.0.1.0/24",
});

// 5. Setup Target Region Networking (for Failover)

// Target Virtual Network (VNet)
const targetVNet = new network.VirtualNetwork("targetVNet", {
    virtualNetworkName: "target-vnet",
    resourceGroupName: targetResourceGroup.name,
    location: targetLocation,
    addressSpace: {
        addressPrefixes: ["10.1.0.0/16"],
    },
});

// Target Subnet
const targetSubnet = new network.Subnet("targetSubnet", {
    subnetName: "target-subnet",
    resourceGroupName: targetResourceGroup.name,
    virtualNetworkName: targetVNet.name,
    addressPrefix: "10.1.1.0/24",
});

// =============================================================================
// Phase 2: Customer-Managed Key Infrastructure (CMK Prerequisites)
// =============================================================================

// 6. Create Source Key Vault

// Source Azure Key Vault
const sourceKeyVault = new keyvault.Vault("sourceKeyVault", {
    vaultName: `${keyVaultNamePrefix}-source-${uniqueSuffix}`,
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    properties: {
        sku: {
            family: "A",
            name: "standard",
        },
        tenantId: clientConfig.then(config => config.tenantId),
        enableSoftDelete: true,
        enablePurgeProtection: true,
        enabledForDiskEncryption: true,
        accessPolicies: [
            {
                tenantId: clientConfig.then(config => config.tenantId),
                objectId: clientConfig.then(config => config.objectId),
                permissions: {
                    keys: ["get", "list", "create", "delete", "update", "wrapKey", "unwrapKey", "encrypt", "decrypt"],
                    secrets: ["get", "list", "set", "delete"],
                    certificates: ["get", "list", "create", "delete", "update"],
                },
            },
        ],
    },
});

// 7. Create Target Key Vault

// Target Azure Key Vault
const targetKeyVault = new keyvault.Vault("targetKeyVault", {
    vaultName: `${keyVaultNamePrefix}-target-${uniqueSuffix}`,
    resourceGroupName: targetResourceGroup.name,
    location: targetLocation,
    properties: {
        sku: {
            family: "A",
            name: "standard",
        },
        tenantId: clientConfig.then(config => config.tenantId),
        enableSoftDelete: true,
        enablePurgeProtection: true,
        enabledForDiskEncryption: true,
        accessPolicies: [
            {
                tenantId: clientConfig.then(config => config.tenantId),
                objectId: clientConfig.then(config => config.objectId),
                permissions: {
                    keys: ["get", "list", "create", "delete", "update", "wrapKey", "unwrapKey", "encrypt", "decrypt"],
                    secrets: ["get", "list", "set", "delete"],
                    certificates: ["get", "list", "create", "delete", "update"],
                },
            },
        ],
    },
});

// 8. Create Encryption Keys

// Source Encryption Key
const sourceEncryptionKey = new keyvault.Key("sourceEncryptionKey", {
    keyName: sourceKeyName,
    resourceGroupName: sourceResourceGroup.name,
    vaultName: sourceKeyVault.name,
    properties: {
        kty: "RSA",
        keySize: 2048,
        keyOps: ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    },
});

// Target Encryption Key
const targetEncryptionKey = new keyvault.Key("targetEncryptionKey", {
    keyName: targetKeyName,
    resourceGroupName: targetResourceGroup.name,
    vaultName: targetKeyVault.name,
    properties: {
        kty: "RSA",
        keySize: 2048,
        keyOps: ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
    },
});

// 9. Create Disk Encryption Sets

// Source Disk Encryption Set (DES)
const sourceDiskEncryptionSet = new compute.DiskEncryptionSet("sourceDiskEncryptionSet", {
    diskEncryptionSetName: `${resourceGroupNamePrefix}-source-des`,
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    identity: {
        type: "SystemAssigned",
    },
    activeKey: {
        sourceVault: {
            id: sourceKeyVault.id,
        },
        keyUrl: sourceEncryptionKey.keyUriWithVersion,
    },
    encryptionType: "EncryptionAtRestWithCustomerKey",
});

// Target Disk Encryption Set (DES)
const targetDiskEncryptionSet = new compute.DiskEncryptionSet("targetDiskEncryptionSet", {
    diskEncryptionSetName: `${resourceGroupNamePrefix}-target-des`,
    resourceGroupName: targetResourceGroup.name,
    location: targetLocation,
    identity: {
        type: "SystemAssigned",
    },
    activeKey: {
        sourceVault: {
            id: targetKeyVault.id,
        },
        keyUrl: targetEncryptionKey.keyUriWithVersion,
    },
    encryptionType: "EncryptionAtRestWithCustomerKey",
});

// 10. Configure Key Vault Access Policies for DES

// Source Key Vault Access Policy for Source DES
const sourceKeyVaultAccessPolicy = new keyvault.AccessPolicy("sourceKeyVaultAccessPolicy", {
    resourceGroupName: sourceResourceGroup.name,
    vaultName: sourceKeyVault.name,
    policy: {
        tenantId: clientConfig.then(config => config.tenantId),
        objectId: sourceDiskEncryptionSet.identity.apply(identity => identity!.principalId!),
        permissions: {
            keys: ["get", "wrapKey", "unwrapKey"],
        },
    },
});

// Target Key Vault Access Policy for Target DES
const targetKeyVaultAccessPolicy = new keyvault.AccessPolicy("targetKeyVaultAccessPolicy", {
    resourceGroupName: targetResourceGroup.name,
    vaultName: targetKeyVault.name,
    policy: {
        tenantId: clientConfig.then(config => config.tenantId),
        objectId: targetDiskEncryptionSet.identity.apply(identity => identity!.principalId!),
        permissions: {
            keys: ["get", "wrapKey", "unwrapKey"],
        },
    },
});

// =============================================================================
// Export Phase 1 Resources
// =============================================================================

export const sourceResourceGroupName = sourceResourceGroup.name;
export const sourceResourceGroupId = sourceResourceGroup.id;
export const targetResourceGroupName = targetResourceGroup.name;
export const targetResourceGroupId = targetResourceGroup.id;
export const recoveryResourceGroupName = recoveryResourceGroup.name;
export const recoveryResourceGroupId = recoveryResourceGroup.id;

export const sourceVNetName = sourceVNet.name;
export const sourceVNetId = sourceVNet.id;
export const sourceSubnetName = sourceSubnet.name;
export const sourceSubnetId = sourceSubnet.id;

export const targetVNetName = targetVNet.name;
export const targetVNetId = targetVNet.id;
export const targetSubnetName = targetSubnet.name;
export const targetSubnetId = targetSubnet.id;

// Phase 2 CMK Infrastructure Exports
export const sourceKeyVaultName = sourceKeyVault.name;
export const sourceKeyVaultId = sourceKeyVault.id;
export const targetKeyVaultName = targetKeyVault.name;
export const targetKeyVaultId = targetKeyVault.id;

export const sourceEncryptionKeyName = sourceEncryptionKey.name;
export const sourceEncryptionKeyId = sourceEncryptionKey.id;
export const sourceEncryptionKeyUrl = sourceEncryptionKey.keyUriWithVersion;
export const targetEncryptionKeyName = targetEncryptionKey.name;
export const targetEncryptionKeyId = targetEncryptionKey.id;
export const targetEncryptionKeyUrl = targetEncryptionKey.keyUriWithVersion;

export const sourceDiskEncryptionSetName = sourceDiskEncryptionSet.name;
export const sourceDiskEncryptionSetId = sourceDiskEncryptionSet.id;
export const sourceDiskEncryptionSetPrincipalId = sourceDiskEncryptionSet.identity.apply(identity => identity!.principalId!);
export const targetDiskEncryptionSetName = targetDiskEncryptionSet.name;
export const targetDiskEncryptionSetId = targetDiskEncryptionSet.id;
export const targetDiskEncryptionSetPrincipalId = targetDiskEncryptionSet.identity.apply(identity => identity!.principalId!);

// =============================================================================
// Phase 3: Recovery Services Vault & ASR Primitives
// =============================================================================

// 11. Create Recovery Services Vault (RSV)
const recoveryServicesVault = new recoveryservices.Vault("recoveryServicesVault", {
    vaultName: `${resourceGroupNamePrefix}-rsv`,
    resourceGroupName: recoveryResourceGroup.name,
    location: recoveryResourceGroup.location,
    sku: {
        name: "Standard",
    },
    properties: {
        publicNetworkAccess: "Enabled",
    },
});

// 12. (Optional but Recommended) Create ASR Cache Storage Account
const asrCacheStorageAccount = new storage.StorageAccount("asrCacheStorageAccount", {
    accountName: `asr${resourceGroupNamePrefix.toLowerCase().replace(/-/g, "")}cache`,
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
});

// 13. Define ASR Replication Policy
const asrReplicationPolicy = new recoveryservices.ReplicationPolicy("asrReplicationPolicy", {
    policyName: "asr-cmk-policy",
    resourceGroupName: recoveryResourceGroup.name,
    resourceName: recoveryServicesVault.name,
    properties: {
        providerSpecificInput: {
            instanceType: "A2A",
            multiVmSyncStatus: "Enable",
            appConsistentFrequencyInMinutes: 240, // 4 hours * 60 minutes
            crashConsistentFrequencyInMinutes: 5, // 5 minutes for crash-consistent snapshots
            recoveryPointHistory: 1440, // 24 hours * 60 minutes
        },
    },
}, {
    deleteBeforeReplace: true,
});

// =============================================================================
// Phase 3 Exports
// =============================================================================

export const recoveryServicesVaultName = recoveryServicesVault.name;
export const recoveryServicesVaultId = recoveryServicesVault.id;
export const asrCacheStorageAccountName = asrCacheStorageAccount.name;
export const asrCacheStorageAccountId = asrCacheStorageAccount.id;
export const asrReplicationPolicyName = asrReplicationPolicy.name;
export const asrReplicationPolicyId = asrReplicationPolicy.id;

// =============================================================================
// Phase 4: Source Virtual Machine with CMK Encryption
// =============================================================================

// 14. Create Network Interface (NIC) for Source VM
const sourceVmNic = new network.NetworkInterface("sourceVmNic", {
    networkInterfaceName: `${sourceVmName}-nic`,
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    ipConfigurations: [{
        name: "ipconfig1",
        subnet: {
            id: sourceSubnet.id,
        },
        privateIPAllocationMethod: "Dynamic",
    }],
});

// 15. Create Source Virtual Machine with CMK-Encrypted Disks
const sourceVm = new compute.VirtualMachine("sourceVm", {
    vmName: sourceVmName,
    resourceGroupName: sourceResourceGroup.name,
    location: location,
    hardwareProfile: {
        vmSize: vmSize,
    },
    storageProfile: {
        imageReference: {
            publisher: sourceVmImagePublisher,
            offer: sourceVmImageOffer,
            sku: sourceVmImageSku,
            version: sourceVmImageVersion,
        },
        osDisk: {
            name: `${sourceVmName}-osdisk`,
            createOption: "FromImage",
            diskSizeGB: 30,
            deleteOption: "Delete",
            managedDisk: {
                storageAccountType: "Standard_LRS",
                diskEncryptionSet: {
                    id: sourceDiskEncryptionSet.id,
                },
            },
        },
        dataDisks: [{
            name: `${sourceVmName}-datadisk-01`,
            createOption: "Empty",
            diskSizeGB: 32,
            lun: 0,
            deleteOption: "Delete",
            managedDisk: {
                storageAccountType: "Standard_LRS",
                diskEncryptionSet: {
                    id: sourceDiskEncryptionSet.id,
                },
            },
        }],
    },
    osProfile: {
        computerName: sourceVmName,
        adminUsername: vmAdminUsername,
        adminPassword: vmAdminPassword,
        linuxConfiguration: {
            disablePasswordAuthentication: false,
        },
    },
    networkProfile: {
        networkInterfaces: [{
            id: sourceVmNic.id,
        }],
    },
}, {
    dependsOn: [sourceKeyVaultAccessPolicy], // Ensure DES has access to Key Vault
});

// =============================================================================
// Phase 4 Exports
// =============================================================================

export const sourceVmNicName = sourceVmNic.name;
export const sourceVmNicId = sourceVmNic.id;
export const sourceVmName_export = sourceVm.name;
export const sourceVmId = sourceVm.id;
export const sourceVmOsDiskName = pulumi.interpolate`${sourceVmName}-osdisk`;
export const sourceVmDataDiskName = pulumi.interpolate`${sourceVmName}-datadisk-01`;

// =============================================================================
// Phase 5: ASR Configuration for CMK-Encrypted VM Replication (Azure-to-Azure)
// =============================================================================

// 16. First, create cleanup command that will handle existing ASR resources
const cleanupExistingAsrResources = new command.local.Command("cleanupExistingAsrResources", {
    create: "echo 'ASR cleanup command created - will clean up existing resources during destroy'",
    delete: pulumi.interpolate`
        echo "Cleaning up existing ASR resources..."
        
        # Remove any existing protected items
        PROTECTED_ITEMS=$(az site-recovery protected-item list --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --fabric-name azure-${location} --protection-container-name asr-a2a-default-${location}-container --query "[].name" -o tsv 2>/dev/null || true)
        if [ ! -z "$PROTECTED_ITEMS" ]; then
            for item in $PROTECTED_ITEMS; do
                echo "Removing protected item: $item"
                az site-recovery protected-item remove --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --fabric-name azure-${location} --protection-container-name asr-a2a-default-${location}-container --name "$item" --yes || true
            done
        fi
        
        # Remove protection container mappings
        MAPPINGS=$(az site-recovery protection-container mapping list --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --fabric-name azure-${location} --protection-container-name asr-a2a-default-${location}-container --query "[].name" -o tsv 2>/dev/null || true)
        if [ ! -z "$MAPPINGS" ]; then
            for mapping in $MAPPINGS; do
                echo "Removing mapping: $mapping"
                az site-recovery protection-container mapping remove --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --fabric-name azure-${location} --protection-container-name asr-a2a-default-${location}-container --mapping-name "$mapping" || true
            done
        fi
        
        echo "ASR cleanup completed"
    `,
}, {
    dependsOn: [recoveryServicesVault],
});

// 17. Create ASR Fabric (Azure) - Source Fabric
const sourceFabric = new recoveryservices.ReplicationFabric("sourceFabric", {
    fabricName: `azure-${location}`,
    resourceGroupName: recoveryResourceGroup.name,
    resourceName: recoveryServicesVault.name,
    properties: {
        customDetails: {
            instanceType: "Azure",
            location: location,
        },
    },
}, {
    deleteBeforeReplace: true,
    dependsOn: [cleanupExistingAsrResources],
});

// Create ASR Fabric (Azure) - Target Fabric
const targetFabric = new recoveryservices.ReplicationFabric("targetFabric", {
    fabricName: `azure-${targetLocation}`,
    resourceGroupName: recoveryResourceGroup.name,
    resourceName: recoveryServicesVault.name,
    properties: {
        customDetails: {
            instanceType: "Azure",
            location: targetLocation,
        },
    },
}, {
    deleteBeforeReplace: true,
    dependsOn: [cleanupExistingAsrResources],
});

// 17. Create Protection Containers using Azure CLI (since they're not available in Pulumi Azure Native)
const sourceProtectionContainer = new command.local.Command("sourceProtectionContainer", {
    create: pulumi.interpolate`az site-recovery protection-container create --fabric-name ${sourceFabric.name} --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --name asr-a2a-default-${location}-container --provider-input '[{instance-type:A2A}]'`,
    delete: pulumi.interpolate`az site-recovery protection-container remove --fabric-name ${sourceFabric.name} --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --protection-container-name asr-a2a-default-${location}-container || true`,
}, {
    dependsOn: [sourceFabric],
});

const targetProtectionContainer = new command.local.Command("targetProtectionContainer", {
    create: pulumi.interpolate`az site-recovery protection-container create --fabric-name ${targetFabric.name} --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --name asr-a2a-default-${targetLocation}-container --provider-input '[{instance-type:A2A}]'`,
    delete: pulumi.interpolate`az site-recovery protection-container remove --fabric-name ${targetFabric.name} --vault-name ${recoveryServicesVault.name} --resource-group ${recoveryResourceGroup.name} --protection-container-name asr-a2a-default-${targetLocation}-container || true`,
}, {
    dependsOn: [targetFabric],
});

// 18. Create ASR Protection Container Mapping
const protectionContainerMapping = new recoveryservices.ReplicationProtectionContainerMapping("protectionContainerMapping", {
    mappingName: "asr-container-mapping",
    resourceGroupName: recoveryResourceGroup.name,
    resourceName: recoveryServicesVault.name,
    fabricName: sourceFabric.name,
    protectionContainerName: `asr-a2a-default-${location}-container`,
    properties: {
        targetProtectionContainerId: pulumi.interpolate`/subscriptions/${clientConfig.then(config => config.subscriptionId)}/resourceGroups/${recoveryResourceGroup.name}/providers/Microsoft.RecoveryServices/vaults/${recoveryServicesVault.name}/replicationFabrics/${targetFabric.name}/replicationProtectionContainers/asr-a2a-default-${targetLocation}-container`,
        policyId: asrReplicationPolicy.id,
        providerSpecificInput: {
            instanceType: "A2A",
        },
    },
}, {
    dependsOn: [sourceProtectionContainer, targetProtectionContainer],
});

// 19. ASR Replication Configuration (Manual PowerShell Script)
// Due to Pulumi Azure Native provider limitations with CMK disk encryption,
// ASR replication must be configured manually using the PowerShell script below.

// =============================================================================
// Phase 5 Exports
// =============================================================================

export const sourceFabricName = sourceFabric.name;
export const sourceFabricId = sourceFabric.id;
export const targetFabricName = targetFabric.name;
export const targetFabricId = targetFabric.id;
export const protectionContainerMappingName = protectionContainerMapping.name;
export const protectionContainerMappingId = protectionContainerMapping.id;

// Configuration exports for reference
export const configSummary = {
    sourceLocation: location,
    targetLocation: targetLocation,
    resourcePrefix: resourceGroupNamePrefix,
    vmName: sourceVmName,
    keyVaultPrefix: keyVaultNamePrefix,
    uniqueSuffix: uniqueSuffix,
};

// =============================================================================
// Additional Exports for Manual CMK Configuration
// =============================================================================

// PowerShell Configuration Helper Values
export const cmkConfigurationHelpers = {
    // Recovery Services Vault details for PowerShell
    recoveryServicesVaultName: recoveryServicesVault.name,
    recoveryServicesVaultResourceGroup: recoveryResourceGroup.name,
    
    // Source VM details
    sourceVmName: sourceVmName,
    sourceVmResourceGroup: sourceResourceGroup.name,
    
    // Target DES Resource ID for manual configuration
    targetDiskEncryptionSetResourceId: targetDiskEncryptionSet.id,
    
    // Key Vault details
    sourceKeyVaultName: sourceKeyVault.name,
    targetKeyVaultName: targetKeyVault.name,
    
    // Fabric names for ASR PowerShell commands
    sourceFabricName: sourceFabric.name,
    targetFabricName: targetFabric.name,
    
    // Protection container names
    sourceProtectionContainerName: `asr-a2a-default-${location}-container`,
    targetProtectionContainerName: `asr-a2a-default-${targetLocation}-container`,
    
    // Cache storage account for ASR
    cacheStorageAccountId: asrCacheStorageAccount.id,
    
    // Note: Disk resource IDs can be constructed using the subscription ID from Azure CLI
    // Format: /subscriptions/{subscription-id}/resourceGroups/{source-rg}/providers/Microsoft.Compute/disks/{vm-name}-osdisk
    // Format: /subscriptions/{subscription-id}/resourceGroups/{source-rg}/providers/Microsoft.Compute/disks/{vm-name}-datadisk-01
};

// Note: PowerShell script for manual ASR CMK configuration is available in enable-asr-cmk-replication.ps1
// Use the cmkConfigurationHelpers export to get the required parameter values

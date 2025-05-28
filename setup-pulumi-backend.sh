#!/bin/bash

# Provided by Tidal <support@tidalcloud.com>


# Pulumi State Backend Setup Script for ASR CMK POC
# Phase -1 / 0.2: Create Azure Resources for Pulumi State Backend
# 
# This script creates the necessary Azure resources to use Azure Blob Storage
# as the backend for Pulumi state management for the Customer-Managed Key (CMK) POC.

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration variables for CMK POC
RESOURCE_GROUP_NAME="pulumi-state-cmk-rg"
LOCATION="eastus"
STORAGE_ACCOUNT_PREFIX="pulumistatecmk"
CONTAINER_NAME="pulumi-backend-cmk"
SUBSCRIPTION_ID=""

# Function to generate a unique suffix for storage account name
generate_unique_suffix() {
    # Generate a random 6-character suffix using timestamp and random number
    # Use $RANDOM which is available in bash on both Linux and macOS
    echo $(date +%s | tail -c 4)$(( RANDOM % 900 + 100 ))
}

# Function to check if Azure CLI is installed and user is logged in
check_prerequisites() {
    print_status "Checking prerequisites for CMK POC..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        print_status "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if user is logged in
    if ! az account show &> /dev/null; then
        print_error "You are not logged in to Azure CLI."
        print_status "Please run 'az login' first."
        exit 1
    fi
    
    # Get current subscription
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
    
    print_success "Azure CLI is installed and you are logged in."
    print_status "Current subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
    
    # Check for required Azure CLI extensions
    print_status "Checking for required Azure CLI extensions..."
    
    # Check if keyvault extension is available (usually built-in)
    if ! az keyvault --help &> /dev/null; then
        print_warning "Key Vault commands may not be available. Please ensure Azure CLI is up to date."
    fi
    
    print_success "Prerequisites check completed."
}

# Function to prompt for subscription selection
select_subscription() {
    print_status "Do you want to use the current subscription for the CMK POC Pulumi state backend? (y/n)"
    read -r response
    
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        print_status "Available subscriptions:"
        az account list --query "[].{Name:name, SubscriptionId:id}" -o table
        
        print_status "Enter the subscription ID you want to use:"
        read -r new_subscription_id
        
        if [[ -n "$new_subscription_id" ]]; then
            az account set --subscription "$new_subscription_id"
            SUBSCRIPTION_ID="$new_subscription_id"
            SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
            print_success "Switched to subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"
        else
            print_error "No subscription ID provided. Exiting."
            exit 1
        fi
    fi
}

# Function to create resource group
create_resource_group() {
    print_status "Creating resource group '$RESOURCE_GROUP_NAME' in location '$LOCATION'..."
    
    # Check if resource group already exists
    if az group show --name "$RESOURCE_GROUP_NAME" &> /dev/null; then
        print_warning "Resource group '$RESOURCE_GROUP_NAME' already exists."
        return 0
    fi
    
    az group create \
        --name "$RESOURCE_GROUP_NAME" \
        --location "$LOCATION" \
        --output none
    
    print_success "Resource group '$RESOURCE_GROUP_NAME' created successfully."
}

# Function to create storage account
create_storage_account() {
    local unique_suffix=$(generate_unique_suffix)
    local storage_account_name="${STORAGE_ACCOUNT_PREFIX}${unique_suffix}"
    
    print_status "Creating storage account '$storage_account_name' for CMK POC..."
    
    # Check if storage account name is available
    local name_available=$(az storage account check-name --name "$storage_account_name" --query nameAvailable -o tsv)
    
    if [[ "$name_available" != "true" ]]; then
        print_error "Storage account name '$storage_account_name' is not available."
        print_status "Generating a new name..."
        unique_suffix=$(generate_unique_suffix)
        storage_account_name="${STORAGE_ACCOUNT_PREFIX}${unique_suffix}"
        print_status "Trying with new name: '$storage_account_name'"
    fi
    
    az storage account create \
        --name "$storage_account_name" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --location "$LOCATION" \
        --sku Standard_LRS \
        --kind StorageV2 \
        --output none
    
    print_success "Storage account '$storage_account_name' created successfully."
    
    # Export storage account name for use in other functions
    export STORAGE_ACCOUNT_NAME="$storage_account_name"
}

# Function to create blob container
create_blob_container() {
    print_status "Creating blob container '$CONTAINER_NAME' for CMK POC state..."
    
    # Create container using Azure CLI with login authentication
    az storage container create \
        --name "$CONTAINER_NAME" \
        --account-name "$STORAGE_ACCOUNT_NAME" \
        --auth-mode login \
        --output none
    
    print_success "Blob container '$CONTAINER_NAME' created successfully."
}

# Function to configure Pulumi to use the Azure blob backend
configure_pulumi_backend() {
    print_status "Configuring Pulumi to use Azure Blob Storage backend for CMK POC..."
    
    local backend_url="azblob://$CONTAINER_NAME"
    
    # Check if Pulumi is installed
    if ! command -v pulumi &> /dev/null; then
        print_warning "Pulumi CLI is not installed."
        print_status "Please install Pulumi CLI and run: pulumi login $backend_url"
        print_status "Visit: https://www.pulumi.com/docs/get-started/install/"
        return 0
    fi
    
    # Set environment variable for storage account
    export AZURE_STORAGE_ACCOUNT="$STORAGE_ACCOUNT_NAME"
    
    print_status "Logging into Pulumi backend: $backend_url"
    print_status "Note: Pulumi will use your Azure CLI credentials."
    
    # Login to Pulumi backend
    pulumi login "$backend_url"
    
    print_success "Pulumi backend configured successfully for CMK POC!"
}

# Function to display summary
display_summary() {
    print_success "CMK POC Pulumi State Backend Setup Complete!"
    echo
    print_status "Summary of created resources:"
    echo "  Resource Group: $RESOURCE_GROUP_NAME"
    echo "  Location: $LOCATION"
    echo "  Storage Account: $STORAGE_ACCOUNT_NAME"
    echo "  Container: $CONTAINER_NAME"
    echo "  Subscription: $SUBSCRIPTION_ID"
    echo
    print_status "Backend URL: azblob://$CONTAINER_NAME"
    echo
    print_status "Environment variables for Pulumi:"
    echo "  AZURE_STORAGE_ACCOUNT=$STORAGE_ACCOUNT_NAME"
    echo
    print_status "Next steps for CMK POC:"
    echo "  1. If you haven't already, run: pulumi login azblob://$CONTAINER_NAME"
    echo "  2. Create your Pulumi project: pulumi new azure-typescript"
    echo "  3. Configure CMK-specific settings in Pulumi.dev.yaml"
    echo "  4. Your Pulumi state will now be stored in Azure Blob Storage"
    echo
    print_status "CMK POC specific considerations:"
    echo "  - Ensure your user has Key Vault permissions for CMK operations"
    echo "  - Plan for Key Vault soft delete and purge protection requirements"
    echo "  - Consider cross-region Key Vault replication for DR scenarios"
    echo
    print_warning "Important: Ensure your Azure CLI user has 'Storage Blob Data Contributor' role on the storage account."
    print_warning "For CMK POC: Also ensure 'Key Vault Administrator' or appropriate Key Vault permissions."
}

# Function to assign storage blob data contributor role
assign_storage_role() {
    print_status "Assigning 'Storage Blob Data Contributor' role to current user..."
    
    # Get current user's object ID
    local user_object_id=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || echo "")
    
    if [[ -z "$user_object_id" ]]; then
        print_warning "Could not retrieve current user's object ID."
        print_status "Please manually assign 'Storage Blob Data Contributor' role to your user on the storage account."
        return 0
    fi
    
    # Get storage account resource ID
    local storage_account_id=$(az storage account show \
        --name "$STORAGE_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --query id -o tsv)
    
    # Assign role
    az role assignment create \
        --assignee "$user_object_id" \
        --role "Storage Blob Data Contributor" \
        --scope "$storage_account_id" \
        --output none 2>/dev/null || {
        print_warning "Could not assign role automatically."
        print_status "Please manually assign 'Storage Blob Data Contributor' role to your user."
    }
    
    print_success "Role assignment completed (or please assign manually if warning shown above)."
}

# Function to check Key Vault permissions (CMK-specific)
check_keyvault_permissions() {
    print_status "Checking Key Vault permissions for CMK operations..."
    
    # Get current user's object ID
    local user_object_id=$(az ad signed-in-user show --query id -o tsv 2>/dev/null || echo "")
    
    if [[ -z "$user_object_id" ]]; then
        print_warning "Could not retrieve current user's object ID."
        print_status "Please ensure you have appropriate Key Vault permissions for CMK operations."
        return 0
    fi
    
    print_status "Current user object ID: $user_object_id"
    print_status "For CMK POC, you will need the following permissions:"
    echo "  - Key Vault Administrator (or equivalent RBAC role)"
    echo "  - Ability to create Key Vaults, Keys, and Disk Encryption Sets"
    echo "  - Permissions to assign access policies to managed identities"
    
    print_warning "Note: Key Vault permissions will be validated during the actual CMK POC deployment."
}

# Main execution
main() {
    echo "=========================================================="
    echo "  Pulumi State Backend Setup Script"
    echo "  ASR with Customer-Managed Key (CMK) POC"
    echo "  Phase -1 / 0.2: Azure Blob Storage Backend"
    echo "=========================================================="
    echo
    
    check_prerequisites
    select_subscription
    create_resource_group
    create_storage_account
    assign_storage_role
    create_blob_container
    configure_pulumi_backend
    check_keyvault_permissions
    display_summary
    
    print_success "CMK POC backend setup completed successfully!"
    echo
    print_status "You can now proceed with the CMK POC infrastructure deployment."
    print_status "Refer to plans/cmk-implementation-plan.md for the next steps."
}

# Run main function
main "$@" 
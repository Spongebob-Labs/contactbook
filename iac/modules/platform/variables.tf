variable "project_id" {
  description = "GCP project id."
  type        = string
}

variable "region" {
  description = "GCP region for Artifact Registry."
  type        = string
}

variable "terraform_state_bucket" {
  description = "Globally unique GCS bucket name for OpenTofu state. Required when create_terraform_state_bucket is true."
  type        = string
  default     = ""

  validation {
    condition     = var.terraform_state_bucket == "" || can(regex("^[a-z0-9][a-z0-9_.-]{1,61}[a-z0-9]$", var.terraform_state_bucket))
    error_message = "terraform_state_bucket must be empty or a valid GCS bucket name (3-63 chars, lowercase)."
  }
}

variable "create_terraform_state_bucket" {
  description = "If true, create and manage the GCS bucket for remote state."
  type        = bool
  default     = false

  validation {
    condition     = !var.create_terraform_state_bucket || length(var.terraform_state_bucket) >= 3
    error_message = "Set terraform_state_bucket when create_terraform_state_bucket is true."
  }
}

variable "artifact_registry_repo_id" {
  description = "Artifact Registry repository id (name)."
  type        = string
}

variable "artifact_registry_description" {
  description = "Description for the Artifact Registry repository."
  type        = string
}

variable "enable_apis" {
  description = "Enable required Google APIs in the project."
  type        = bool
}

variable "apis" {
  description = "List of APIs to enable when enable_apis is true."
  type        = list(string)
}

variable "enable_github_actions_wif" {
  description = "If true, create Workload Identity Federation for GitHub Actions."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "GitHub repository allowed to use WIF (owner/repo)."
  type        = string
  default     = ""

  validation {
    condition = (
      !var.enable_github_actions_wif
      || (length(var.github_repository) > 0 && can(regex("^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$", var.github_repository)))
    )
    error_message = "When enable_github_actions_wif is true, set github_repository to owner/repo."
  }
}

variable "github_actions_service_account_id" {
  description = "GCP service account account_id for GitHub Actions."
  type        = string
  default     = "contactbook-github-actions"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.github_actions_service_account_id))
    error_message = "github_actions_service_account_id must be 6-30 chars, lowercase, valid SA id."
  }
}

variable "github_actions_wif_pool_id" {
  description = "Workload Identity Pool id."
  type        = string
  default     = "contactbook-github"
}

variable "github_actions_wif_provider_id" {
  description = "WIF pool provider id for GitHub OIDC."
  type        = string
  default     = "github-oidc"
}

variable "cloud_run_service_account_email" {
  description = "Runtime SA email for GitHub Actions actAs (default Compute Engine SA when null)."
  type        = string
  default     = null
}

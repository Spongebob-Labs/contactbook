variable "project_id" {
  description = "GCP project id."
  type        = string
}

variable "terraform_state_bucket" {
  description = "Globally unique GCS bucket name for OpenTofu state. Required when create_terraform_state_bucket is true; use the same name in backend.hcl."
  type        = string
  default     = ""

  validation {
    condition     = var.terraform_state_bucket == "" || can(regex("^[a-z0-9][a-z0-9_.-]{1,61}[a-z0-9]$", var.terraform_state_bucket))
    error_message = "terraform_state_bucket must be empty or a valid GCS bucket name (3-63 chars, lowercase)."
  }
}

variable "create_terraform_state_bucket" {
  description = "If true, create and manage the GCS bucket for remote state (enable when you are ready to use a GCS backend; see README)."
  type        = bool
  default     = false

  validation {
    condition     = !var.create_terraform_state_bucket || length(var.terraform_state_bucket) >= 3
    error_message = "Set terraform_state_bucket (globally unique GCS name) when create_terraform_state_bucket is true."
  }
}

variable "region" {
  description = "GCP region for Artifact Registry and Cloud Run."
  type        = string
}

variable "artifact_registry_repo_id" {
  description = "Artifact Registry repository id (name)."
  type        = string
}

variable "artifact_registry_description" {
  description = "Description for the Artifact Registry repository."
  type        = string
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name."
  type        = string
}

variable "image_name" {
  description = "Container image name inside the GAR repository."
  type        = string
}

variable "image_tag" {
  description = "Container image tag to deploy."
  type        = string
}

variable "container_port" {
  description = "Container port exposed by the API image (must match Cloud Run PORT / Dockerfile)."
  type        = number
}

variable "cpu" {
  description = "CPU limit for the Cloud Run container (e.g. '1', '2')."
  type        = string
}

variable "memory" {
  description = "Memory limit for the Cloud Run container (e.g. '512Mi', '1Gi')."
  type        = string
}

variable "min_instances" {
  description = "Minimum Cloud Run instances."
  type        = number
}

variable "max_instances" {
  description = "Maximum Cloud Run instances."
  type        = number
}

variable "allow_unauthenticated" {
  description = "If true, grants allUsers the run.invoker role for this service."
  type        = bool
}

variable "cloud_run_service_account_email" {
  description = "Service account email for the Cloud Run revision runtime identity. If null, the module uses the project default Compute Engine SA (PROJECT_NUMBER-compute@developer.gserviceaccount.com), matching GCP’s default when unspecified."
  type        = string
  default     = null
}

variable "env" {
  description = "Environment variables for the Cloud Run container."
  type        = map(string)
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
  description = "If true, create a Workload Identity Pool + GitHub OIDC provider, a deployer service account, IAM for GAR push and Cloud Run deploy, and enable sts/iamcredentials APIs."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "GitHub repository allowed to impersonate the GitHub Actions SA (format: owner/repo). Required when enable_github_actions_wif is true."
  type        = string
  default     = ""

  validation {
    condition = (
      !var.enable_github_actions_wif
      || (length(var.github_repository) > 0 && can(regex("^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$", var.github_repository)))
    )
    error_message = "When enable_github_actions_wif is true, set github_repository to owner/repo (letters, digits, _ . -)."
  }
}

variable "github_actions_service_account_id" {
  description = "GCP service account account_id (short name) for GitHub Actions OIDC. Used when enable_github_actions_wif is true."
  type        = string
  default     = "contactbook-github-actions"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.github_actions_service_account_id))
    error_message = "github_actions_service_account_id must be 6-30 chars, start with a letter, end with alphanumeric, lowercase letters/digits/hyphens only."
  }
}

variable "github_actions_wif_pool_id" {
  description = "Workload Identity Pool id (short id) when enable_github_actions_wif is true."
  type        = string
  default     = "contactbook-github"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}[a-z0-9]$", var.github_actions_wif_pool_id))
    error_message = "github_actions_wif_pool_id must be 4-32 chars, lowercase, start with letter, end with alphanumeric."
  }
}

variable "github_actions_wif_provider_id" {
  description = "WIF pool provider id (short id) for the GitHub OIDC provider when enable_github_actions_wif is true."
  type        = string
  default     = "github-oidc"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}[a-z0-9]$", var.github_actions_wif_provider_id))
    error_message = "github_actions_wif_provider_id must be 4-32 chars, lowercase, start with letter, end with alphanumeric."
  }
}

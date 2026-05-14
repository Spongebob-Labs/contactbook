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
  description = "Optional service account email to run the Cloud Run service as. If null, Cloud Run uses its default identity."
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

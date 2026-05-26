variable "project_id" {
  description = "GCP project id."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run and GCS."
  type        = string
}

variable "cloud_run_service_name" {
  description = "Cloud Run service name."
  type        = string
}

variable "container_port" {
  description = "Container port (must match Dockerfile / PORT)."
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "CPU limit for the Cloud Run container."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for the Cloud Run container."
  type        = string
  default     = "1Gi"
}

variable "min_instances" {
  description = "Minimum Cloud Run instances."
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum Cloud Run instances."
  type        = number
  default     = 2
}

variable "allow_unauthenticated" {
  description = "If true, grants allUsers run.invoker on this service."
  type        = bool
  default     = true
}

variable "cloud_run_service_account_email" {
  description = "Cloud Run revision runtime SA. Null uses project default Compute Engine SA."
  type        = string
  default     = null
}

variable "env" {
  description = "Placeholder env vars for OpenTofu; CD applies the real env via gcloud."
  type        = map(string)
  default     = { NODE_ENV = "production" }
}

variable "create_profile_photos_bucket" {
  description = "If true, create the profile photos GCS bucket."
  type        = bool
  default     = true
}

variable "profile_photos_bucket_name" {
  description = "Globally unique GCS bucket name for profile photos."
  type        = string
  default     = "contactbook-profile-photos"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9_.-]{1,61}[a-z0-9]$", var.profile_photos_bucket_name))
    error_message = "profile_photos_bucket_name must be a valid GCS bucket name."
  }
}

variable "profile_photos_cors_origins" {
  description = "Browser origins allowed to fetch profile photos (CORS GET/HEAD)."
  type        = list(string)
  default = [
    "https://contactbookten.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]
}

variable "enable_photo_lifecycle_rules" {
  description = "If true, enables GCS lifecycle rules to move objects to Nearline storage after 7 days and delete them after 30 days."
  type        = bool
  default     = false
}

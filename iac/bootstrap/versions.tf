terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  # Intentionally local state. This stack creates the bucket every other stack
  # stores its state in, so it cannot store its own state remotely. Run once,
  # commit nothing, and keep the resulting state file somewhere safe.
}

provider "google" {
  project = var.project_id
  region  = var.region
}

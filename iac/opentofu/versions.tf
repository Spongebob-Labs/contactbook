terraform {
  required_version = ">= 1.6.0"

  # Default: local state (`terraform.tfstate` in this directory).
  # To use a GCS remote backend later, add `backend "gcs" {}` here and follow README “Remote state (GCS)”.

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.30.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.30.0"
    }
  }
}


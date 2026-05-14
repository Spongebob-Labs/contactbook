provider "google" {
  project = var.project_id
  region  = var.region

  # Explicitly use the Service Account key file
  credentials = file("/Users/khanf/opentofu-key.json")

  # Prevents the provider from sending your user-level billing project header
  user_project_override = false
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  # Explicitly use the Service Account key file
  credentials = file("/Users/khanf/opentofu-key.json")

  user_project_override = false
}

data "google_project" "current" {
  project_id = var.project_id
}
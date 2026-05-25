provider "google" {
  project = var.project_id
  region  = var.region

  impersonate_service_account = var.opentofu_impersonate_service_account
  user_project_override       = false
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  impersonate_service_account = var.opentofu_impersonate_service_account
  user_project_override       = false
}

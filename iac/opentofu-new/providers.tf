provider "google" {
  project = var.project_id
  region  = var.region

  impersonate_service_account = "contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"
  user_project_override       = false
}

provider "google-beta" {
  project = var.project_id
  region  = var.region

  impersonate_service_account = "contactbook-opentofu@project-c74d38dd-7e12-4d3f-bbf.iam.gserviceaccount.com"
  user_project_override       = false
}

data "google_project" "current" {
  project_id = var.project_id
}

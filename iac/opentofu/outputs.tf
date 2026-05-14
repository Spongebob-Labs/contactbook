output "terraform_state_bucket" {
  description = "GCS bucket used for OpenTofu remote state (when create_terraform_state_bucket is true)."
  value       = var.create_terraform_state_bucket ? google_storage_bucket.terraform_state[0].name : null
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name (resource name)."
  value       = google_artifact_registry_repository.docker.name
}

output "artifact_registry_repository_id" {
  description = "Artifact Registry repository id."
  value       = google_artifact_registry_repository.docker.repository_id
}

output "image_uri" {
  description = "Container image URI that Cloud Run is configured to deploy."
  value       = local.image_uri
}

output "cloud_run_service_name" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.api.name
}

output "cloud_run_service_url" {
  description = "Cloud Run service URL."
  value       = google_cloud_run_v2_service.api.uri
}

output "github_actions_workload_identity_provider" {
  description = "Full resource name for GitHub secret GCP_WORKLOAD_IDENTITY_PROVIDER (empty when enable_github_actions_wif is false)."
  value       = var.enable_github_actions_wif ? google_iam_workload_identity_pool_provider.github[0].name : ""
}

output "github_actions_service_account_email" {
  description = "Email for GitHub secret GCP_SERVICE_ACCOUNT (empty when enable_github_actions_wif is false)."
  value       = var.enable_github_actions_wif ? google_service_account.github_actions[0].email : ""
}


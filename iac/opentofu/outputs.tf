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


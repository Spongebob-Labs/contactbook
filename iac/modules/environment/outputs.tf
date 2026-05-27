output "cloud_run_service_name" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.api.name
}

output "cloud_run_service_url" {
  description = "Cloud Run service URL."
  value       = google_cloud_run_v2_service.api.uri
}

output "profile_photos_bucket_name" {
  description = "GCS bucket for profile photos (when create_profile_photos_bucket is true)."
  value       = var.create_profile_photos_bucket ? google_storage_bucket.profile_photos[0].name : null
}

output "profile_photos_public_base_url" {
  description = "Set GCS_PUBLIC_BASE_URL in apps/api/.env to this value."
  value = var.create_profile_photos_bucket ? (
    "https://storage.googleapis.com/${google_storage_bucket.profile_photos[0].name}"
  ) : null
}

output "custom_domain_dns_records" {
  description = "The DNS resource records generated for the custom domain mapping. Add these to Namecheap."
  value       = (var.custom_domain != null && var.custom_domain != "") ? google_cloud_run_domain_mapping.custom_domain[0].status[0].resource_records : []
}

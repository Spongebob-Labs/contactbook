output "cloud_run_service_name" {
  value = module.environment.cloud_run_service_name
}

output "cloud_run_service_url" {
  value = module.environment.cloud_run_service_url
}

output "profile_photos_bucket_name" {
  value = module.environment.profile_photos_bucket_name
}

output "profile_photos_public_base_url" {
  value = module.environment.profile_photos_public_base_url
}

output "custom_domain_dns_records" {
  description = "DNS records to configure in Namecheap for api.getcontactbook.com"
  value       = module.environment.custom_domain_dns_records
}

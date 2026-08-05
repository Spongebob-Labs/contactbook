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

output "openwa_instance_name" {
  value = var.enable_openwa_vm ? module.openwa[0].instance_name : null
}

output "openwa_zone" {
  value = var.enable_openwa_vm ? module.openwa[0].zone : null
}

output "openwa_external_ip" {
  description = "Create an A record for the OpenWA hostname pointing to this address."
  value       = var.enable_openwa_vm ? module.openwa[0].external_ip : null
}

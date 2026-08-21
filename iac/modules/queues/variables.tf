variable "region" { type = string }
variable "name_prefix" { type = string }

variable "invoker_service_account" {
  type        = string
  description = "OIDC identity Cloud Tasks presents to the VM."
}

variable "outbound_dispatches_per_second" {
  type        = number
  description = "Egress rate limit toward Twilio. THIS is the throttle — there is none in app code."
  default     = 10
}
variable "outbound_max_concurrent" {
  type    = number
  default = 20
}

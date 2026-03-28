terraform {
  backend "s3" {
    bucket         = "boutique-terraform-state-009882533113"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "boutique-terraform-locks"
    encrypt        = true
  }
}
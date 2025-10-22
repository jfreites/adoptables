/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: {
      id: string;
      email: string;
      email_confirmed_at: string | null;
      created_at: string;
      updated_at: string;
    } | null;
  }
}

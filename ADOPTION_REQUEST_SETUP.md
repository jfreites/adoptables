# Adoption Request Feature - Setup Guide

This document describes the complete implementation of the adoption request feature for the Adoptables MX platform.

## Overview

The adoption request feature allows users to submit comprehensive adoption applications for pets. The system includes:

- Full form validation using Zod
- Data persistence to Supabase
- File upload support for ID documents
- Graceful error handling and user feedback
- Row-level security policies

## Architecture

### Components

1. **Frontend Form**: `src/components/AdoptionForm.astro`
   - Collects comprehensive adoption information
   - Client-side form submission with loading states
   - Error display and success messaging

2. **Action Handler**: `src/actions/index.ts` (adoption_request action)
   - Validates all form fields using Zod schema
   - Processes file uploads
   - Calls service methods

3. **Service Layer**: `src/services/adoption.ts`
   - `createAdoptionRequest()`: Saves adoption data to Supabase
   - `uploadIdDocument()`: Handles file uploads to Supabase Storage

4. **Database**: `adoption_requests` table
   - Stores structured adoption data
   - Uses JSONB for flexible questionnaire storage
   - Implements RLS policies for data security

## Database Schema

### Main Table: `adoption_requests`

```sql
- id: uuid (Primary Key)
- pet_id: uuid (Foreign Key to pets table)
- Personal Information: name, lastname, birthdate, etc.
- Personal References: 2 references with names and phones
- questionnaire_answers: jsonb (all questionnaire responses)
- care_commitments: jsonb (selected care options)
- Veterinary info: has_veterinarian, veterinarian_name, etc.
- Acceptance flags: accepted_terms, confirmed_truthful
- id_document_path: text (path to uploaded ID)
- status: enum (pending, under_review, approved, rejected, cancelled)
- Timestamps: created_at, updated_at
```

### Storage Bucket: `documents`

Used for storing ID documents (INE/Passport) uploaded by applicants.

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration to create the necessary tables and policies:

```bash
# Connect to your Supabase project and run:
psql -h <your-supabase-db-host> -U postgres -d postgres -f supabase-adoption-requests-migration.sql
```

Or use the Supabase Dashboard:
1. Go to SQL Editor
2. Paste the contents of `supabase-adoption-requests-migration.sql`
3. Run the query

### 2. Create Storage Bucket

The migration creates the `documents` bucket automatically. Verify in Supabase Dashboard:
1. Go to Storage
2. Check that `documents` bucket exists
3. Verify policies are applied

### 3. Environment Variables

Ensure you have the following environment variables in your `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_PUB_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Test the Feature

1. Navigate to a pet's adoption page
2. Fill out the adoption form
3. Upload an ID document (optional)
4. Submit the form
5. Verify success message appears
6. Check Supabase dashboard to see the new record

## Form Fields

### Personal Information
- Name, Lastname
- Birthdate
- Marital Status
- City, Address, Zipcode
- Personal ID (INE/Passport number)
- Email, Cellphone
- Career/Occupation
- Office Phone (optional)

### Personal References
- Reference 1: Full name and phone
- Reference 2: Full name and phone

### Questionnaire (26+ questions)
- Motivation for adoption
- Current and previous pet ownership
- Housing situation
- Household composition
- Time availability
- Financial capacity
- Care commitments
- Veterinary resources
- Living space adequacy
- Future planning scenarios

### Care Commitments (Checkboxes)
- Periodic vet visits
- Daily litter box cleaning (cats)
- Indoor only (cats)
- ID collar/tag
- Clean water daily
- Deworming
- Grooming
- Age-appropriate food
- Annual vaccination
- Daily walks with leash (dogs)
- Respect species needs

### Veterinary Information
- Has veterinarian (yes/no)
- Veterinarian name and phone
- Has resources for vet expenses
- Resources details

### Acceptance
- Accept adoption conditions
- Confirm information is truthful

### File Upload
- ID document (INE/Passport) - PDF, JPG, PNG, WebP (max 10MB)

## Validation Rules

All fields are validated using Zod schemas:

- **Required fields**: Most fields are required
- **String minimums**: Names (2 chars), emails (valid format), phones (10 chars)
- **Enums**: Predefined options for status, yes/no questions, budget ranges
- **File validation**: Type and size restrictions
- **Conditional fields**: Some fields required based on other answers

## Error Handling

### Client-Side
- Form validation before submission
- Loading state during submission
- Error messages displayed prominently
- Scroll to error message
- Button re-enabled after submission

### Server-Side
- Zod validation with descriptive errors
- Database constraint checks
- File upload error handling
- Transaction-like behavior (rollback on failure)

## Security Features

### Row-Level Security (RLS)
- Users can insert their own requests
- Users can view their own requests (matched by email)
- Organization admins can view/update requests for their pets
- Anonymous users have limited SELECT access

### File Upload Security
- Authentication required
- File type restrictions
- File size limits (10MB)
- Unique file paths per request
- Automatic cleanup on failure

## Data Structure

### questionnaire_answers (JSONB)
```json
{
  "why_adopt": "string",
  "has_other_pets": "yes|no",
  "which_pets": "string",
  "pets_sterilized": "yes|no",
  "why_not_sterilized": "string",
  ... (all questionnaire fields)
}
```

### care_commitments (JSONB)
```json
{
  "basic_care": ["veterinario_periodico", "agua_diaria", ...],
  "additional_care": ["paseos_diarios", "necesidades_especie"]
}
```

## Future Enhancements

Consider implementing:

1. **Email notifications**: Alert organization when new request arrives
2. **Status updates**: Notify applicant of status changes
3. **Admin dashboard**: Interface for reviewing/managing requests
4. **Scoring system**: Automatic evaluation of applications
5. **Multi-step form**: Break into smaller, manageable steps
6. **Document verification**: OCR for ID validation
7. **Background checks**: Integration with verification services
8. **Interview scheduling**: Calendar integration for follow-ups

## Troubleshooting

### Form submission fails
- Check browser console for errors
- Verify all required fields are filled
- Check file size and type
- Ensure Supabase connection is active

### Database errors
- Verify migration ran successfully
- Check RLS policies are enabled
- Ensure foreign key relationships exist (pets table)
- Check Supabase logs for details

### File upload issues
- Verify storage bucket exists
- Check storage policies
- Ensure service role key is configured
- Verify file meets size/type requirements

## Support

For issues or questions:
1. Check Supabase logs in dashboard
2. Review browser console errors
3. Verify environment variables
4. Test with minimal data first

---

**Implementation Date**: November 2024  
**Version**: 1.0  
**Framework**: Astro.js + Supabase

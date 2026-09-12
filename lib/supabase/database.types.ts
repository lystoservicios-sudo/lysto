export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_profiles: {
        Row: {
          can_manage_payments: boolean
          can_manage_professionals: boolean
          created_at: string
          id: string
          permissions_version: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          can_manage_payments?: boolean
          can_manage_professionals?: boolean
          created_at?: string
          id?: string
          permissions_version?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          can_manage_payments?: boolean
          can_manage_professionals?: boolean
          created_at?: string
          id?: string
          permissions_version?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string
          id: string
          job_id: string | null
          professional_id: string | null
          resolution: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description: string
          id?: string
          job_id?: string | null
          professional_id?: string | null
          resolution?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string
          id?: string
          job_id?: string | null
          professional_id?: string | null
          resolution?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "complaints_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          apartment: string | null
          archived_at: string | null
          city: string
          created_at: string
          customer_id: string
          difficult_access: boolean | null
          floor: string | null
          has_elevator: boolean | null
          has_parking: boolean | null
          id: string
          is_default: boolean
          label: string | null
          number: string
          outdoor_unit_at_height: boolean | null
          outdoor_unit_on_balcony: boolean | null
          postal_code: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          province: string
          reference: string | null
          stairs_required: boolean | null
          street: string
          updated_at: string
          version: number
        }
        Insert: {
          apartment?: string | null
          archived_at?: string | null
          city?: string
          created_at?: string
          customer_id: string
          difficult_access?: boolean | null
          floor?: string | null
          has_elevator?: boolean | null
          has_parking?: boolean | null
          id?: string
          is_default?: boolean
          label?: string | null
          number: string
          outdoor_unit_at_height?: boolean | null
          outdoor_unit_on_balcony?: boolean | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          province?: string
          reference?: string | null
          stairs_required?: boolean | null
          street: string
          updated_at?: string
          version?: number
        }
        Update: {
          apartment?: string | null
          archived_at?: string | null
          city?: string
          created_at?: string
          customer_id?: string
          difficult_access?: boolean | null
          floor?: string | null
          has_elevator?: boolean | null
          has_parking?: boolean | null
          id?: string
          is_default?: boolean
          label?: string | null
          number?: string
          outdoor_unit_at_height?: boolean | null
          outdoor_unit_on_balcony?: boolean | null
          postal_code?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          province?: string
          reference?: string | null
          stairs_required?: boolean | null
          street?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_equipment: {
        Row: {
          address_id: string | null
          archived_at: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          customer_id: string
          equipment_type: string | null
          frigorias: string | null
          id: string
          model: string | null
          nickname: string
          notes: string | null
          photo_url: string | null
          serial_number: string | null
          updated_at: string
          version: number
        }
        Insert: {
          address_id?: string | null
          archived_at?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          customer_id: string
          equipment_type?: string | null
          frigorias?: string | null
          id?: string
          model?: string | null
          nickname: string
          notes?: string | null
          photo_url?: string | null
          serial_number?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          address_id?: string | null
          archived_at?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          customer_id?: string
          equipment_type?: string | null
          frigorias?: string | null
          id?: string
          model?: string | null
          nickname?: string
          notes?: string | null
          photo_url?: string | null
          serial_number?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_equipment_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_equipment_address_owner_fk"
            columns: ["address_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "customer_equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_equipment_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_reports: {
        Row: {
          created_at: string
          customer_summary: string
          disclaimer: string
          id: string
          level: string
          possible_causes: Json
          request_id: string
          technician_summary: string
          top_cause_code: string
          top_cause_label: string
        }
        Insert: {
          created_at?: string
          customer_summary: string
          disclaimer: string
          id?: string
          level: string
          possible_causes?: Json
          request_id: string
          technician_summary: string
          top_cause_code: string
          top_cause_label: string
        }
        Update: {
          created_at?: string
          customer_summary?: string
          disclaimer?: string
          id?: string
          level?: string
          possible_causes?: Json
          request_id?: string
          technician_summary?: string
          top_cause_code?: string
          top_cause_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_rules: {
        Row: {
          active: boolean
          base_score: number
          category_id: string
          cause_code: string
          cause_label: string
          created_at: string
          customer_hint: string
          id: string
          issue_type_id: string
          technician_checklist: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_score: number
          category_id: string
          cause_code: string
          cause_label: string
          created_at?: string
          customer_hint: string
          id?: string
          issue_type_id: string
          technician_checklist?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_score?: number
          category_id?: string
          cause_code?: string
          cause_label?: string
          created_at?: string
          customer_hint?: string
          id?: string
          issue_type_id?: string
          technician_checklist?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_rules_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "service_issue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_media: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_media_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "customer_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_service_records: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          job_id: string | null
          next_maintenance_date: string | null
          next_maintenance_option: Database["public"]["Enums"]["maintenance_option"]
          notes: string | null
          parts_used: string | null
          professional_id: string | null
          real_diagnosis: string | null
          reported_problem: string | null
          work_done: string | null
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          job_id?: string | null
          next_maintenance_date?: string | null
          next_maintenance_option?: Database["public"]["Enums"]["maintenance_option"]
          notes?: string | null
          parts_used?: string | null
          professional_id?: string | null
          real_diagnosis?: string | null
          reported_problem?: string | null
          work_done?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          job_id?: string | null
          next_maintenance_date?: string | null
          next_maintenance_option?: Database["public"]["Enums"]["maintenance_option"]
          notes?: string | null
          parts_used?: string | null
          professional_id?: string | null
          real_diagnosis?: string | null
          reported_problem?: string | null
          work_done?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_service_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "customer_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_service_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_service_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "equipment_service_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_extras: {
        Row: {
          amount: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          description: string
          fault: string
          id: string
          idempotency_key: string
          job_id: string
          platform_fee: number | null
          professional_amount: number | null
          professional_id: string
          safety_amount: number | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description: string
          fault: string
          id?: string
          idempotency_key: string
          job_id: string
          platform_fee?: number | null
          professional_amount?: number | null
          professional_id: string
          safety_amount?: number | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string
          fault?: string
          id?: string
          idempotency_key?: string
          job_id?: string
          platform_fee?: number | null
          professional_amount?: number | null
          professional_id?: string
          safety_amount?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_extras_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_extras_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_extras_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_extras_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_final_reports: {
        Row: {
          created_at: string
          equipment_id: string | null
          final_state: string
          id: string
          internal_notes: string | null
          job_id: string
          maintenance_option: Database["public"]["Enums"]["maintenance_option"]
          next_maintenance_date: string | null
          parts_used: string | null
          public_token: string
          real_diagnosis: string
          warranty_days: number
          work_done: string
        }
        Insert: {
          created_at?: string
          equipment_id?: string | null
          final_state: string
          id?: string
          internal_notes?: string | null
          job_id: string
          maintenance_option?: Database["public"]["Enums"]["maintenance_option"]
          next_maintenance_date?: string | null
          parts_used?: string | null
          public_token?: string
          real_diagnosis: string
          warranty_days?: number
          work_done: string
        }
        Update: {
          created_at?: string
          equipment_id?: string | null
          final_state?: string
          id?: string
          internal_notes?: string | null
          job_id?: string
          maintenance_option?: Database["public"]["Enums"]["maintenance_option"]
          next_maintenance_date?: string | null
          parts_used?: string | null
          public_token?: string
          real_diagnosis?: string
          warranty_days?: number
          work_done?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_final_reports_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "customer_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_final_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_final_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
        ]
      }
      job_media: {
        Row: {
          created_at: string
          id: string
          job_id: string
          media_type: Database["public"]["Enums"]["media_type"]
          phase: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          media_type: Database["public"]["Enums"]["media_type"]
          phase?: string
          storage_bucket: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          phase?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_media_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_events: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          id: string
          job_id: string
          metadata: Json
          notes: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          metadata?: Json
          notes?: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          metadata?: Json
          notes?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_status_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
        ]
      }
      jobs: {
        Row: {
          accepted_at: string | null
          arrived_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          final_amount: number | null
          id: string
          professional_id: string | null
          request_id: string
          scheduled_date: string | null
          scheduled_time_window: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          technician_on_way_at: string | null
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          arrived_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          final_amount?: number | null
          id?: string
          professional_id?: string | null
          request_id: string
          scheduled_date?: string | null
          scheduled_time_window?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_on_way_at?: string | null
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          arrived_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          final_amount?: number | null
          id?: string
          professional_id?: string | null
          request_id?: string
          scheduled_date?: string | null
          scheduled_time_window?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          technician_on_way_at?: string | null
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_request_customer_fk"
            columns: ["request_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "jobs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_checkouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_id: string
          expires_at: string
          extra_id: string | null
          id: string
          init_point: string | null
          job_id: string
          last_error: string | null
          last_reconciled_at: string | null
          lease_token: string | null
          lease_until: string | null
          live_mode: boolean
          marketplace_fee: number
          preference_id: string | null
          preference_spec: Json | null
          professional_amount: number | null
          professional_id: string
          review_reason: string | null
          sandbox_init_point: string | null
          seller_account_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_id: string
          expires_at?: string
          extra_id?: string | null
          id?: string
          init_point?: string | null
          job_id: string
          last_error?: string | null
          last_reconciled_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          live_mode: boolean
          marketplace_fee: number
          preference_id?: string | null
          preference_spec?: Json | null
          professional_amount?: number | null
          professional_id: string
          review_reason?: string | null
          sandbox_init_point?: string | null
          seller_account_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_id?: string
          expires_at?: string
          extra_id?: string | null
          id?: string
          init_point?: string | null
          job_id?: string
          last_error?: string | null
          last_reconciled_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          live_mode?: boolean
          marketplace_fee?: number
          preference_id?: string | null
          preference_spec?: Json | null
          professional_amount?: number | null
          professional_id?: string
          review_reason?: string | null
          sandbox_init_point?: string | null
          seller_account_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_checkouts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_checkouts_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "job_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_checkouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_checkouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "marketplace_checkouts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payment_observations: {
        Row: {
          checkout_id: string
          issues: Json
          net_received_amount: number | null
          observed_at: string
          provider_fee: number
          provider_payment_id: string
          provider_status: string
          provider_updated_at: string
          refunded_amount: number
        }
        Insert: {
          checkout_id: string
          issues?: Json
          net_received_amount?: number | null
          observed_at?: string
          provider_fee?: number
          provider_payment_id: string
          provider_status: string
          provider_updated_at: string
          refunded_amount?: number
        }
        Update: {
          checkout_id?: string
          issues?: Json
          net_received_amount?: number | null
          observed_at?: string
          provider_fee?: number
          provider_payment_id?: string
          provider_status?: string
          provider_updated_at?: string
          refunded_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payment_observations_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "marketplace_checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_split_connected_accounts: {
        Row: {
          access_token_expires_at: string
          created_at: string
          enabled: boolean
          encrypted_access_token: string
          encrypted_refresh_token: string | null
          mercado_pago_user_id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          access_token_expires_at: string
          created_at: string
          enabled?: boolean
          encrypted_access_token: string
          encrypted_refresh_token?: string | null
          mercado_pago_user_id: string
          seller_id: string
          updated_at: string
        }
        Update: {
          access_token_expires_at?: string
          created_at?: string
          enabled?: boolean
          encrypted_access_token?: string
          encrypted_refresh_token?: string | null
          mercado_pago_user_id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mp_split_oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          seller_id: string
          state_hash: string
        }
        Insert: {
          consumed_at?: string | null
          created_at: string
          expires_at: string
          seller_id: string
          state_hash: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          seller_id?: string
          state_hash?: string
        }
        Relationships: []
      }
      mp_split_seller_unlink_events: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          delivered_at: string | null
          event_id: string
          last_error: string | null
          lease_expires_at: string | null
          mercado_pago_user_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at: string
          created_at: string
          delivered_at?: string | null
          event_id: string
          last_error?: string | null
          lease_expires_at?: string | null
          mercado_pago_user_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          delivered_at?: string | null
          event_id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          mercado_pago_user_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mp_split_webhook_events: {
        Row: {
          action: string
          attempts: number
          data_id: string
          event_key: string
          last_error: string | null
          lease_expires_at: string | null
          mercado_pago_user_id: string
          notification_id: string
          notification_type: string
          processed_at: string | null
          received_at: string
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          attempts?: number
          data_id: string
          event_key: string
          last_error?: string | null
          lease_expires_at?: string | null
          mercado_pago_user_id: string
          notification_id: string
          notification_type: string
          processed_at?: string | null
          received_at: string
          status: string
          updated_at: string
        }
        Update: {
          action?: string
          attempts?: number
          data_id?: string
          event_key?: string
          last_error?: string | null
          lease_expires_at?: string | null
          mercado_pago_user_id?: string
          notification_id?: string
          notification_type?: string
          processed_at?: string | null
          received_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          body: string
          channel: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          metadata: Json
          recipient_profile_id: string | null
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          metadata?: Json
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          recipient_profile_id?: string | null
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: string
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: string
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payment_id: string | null
          provider: string
          provider_event_id: string
          raw_payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payment_id?: string | null
          provider?: string
          provider_event_id: string
          raw_payload: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          provider?: string
          provider_event_id?: string
          raw_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          checkout_idempotency_key: string | null
          created_at: string
          currency: string
          customer_id: string
          id: string
          job_id: string | null
          marketplace_fee: number
          payment_type: string
          professional_amount: number
          professional_id: string | null
          provider: string
          provider_payment_id: string | null
          provider_preference_id: string | null
          provider_updated_at: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          checkout_idempotency_key?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          id?: string
          job_id?: string | null
          marketplace_fee?: number
          payment_type?: string
          professional_amount?: number
          professional_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_updated_at?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          checkout_idempotency_key?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          id?: string
          job_id?: string | null
          marketplace_fee?: number
          payment_type?: string
          professional_amount?: number
          professional_id?: string | null
          provider?: string
          provider_payment_id?: string | null
          provider_preference_id?: string | null
          provider_updated_at?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_records: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          payment_id: string | null
          professional_id: string
          provider_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string | null
          professional_id: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          payment_id?: string | null
          professional_id?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_records_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_records_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_options: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          option_type: Database["public"]["Enums"]["urgency_level"]
          platform_fee: number
          professional_amount: number
          request_id: string
          selected: boolean
          title: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          option_type: Database["public"]["Enums"]["urgency_level"]
          platform_fee?: number
          professional_amount?: number
          request_id: string
          selected?: boolean
          title: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          option_type?: Database["public"]["Enums"]["urgency_level"]
          platform_fee?: number
          professional_amount?: number
          request_id?: string
          selected?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_options_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          active: boolean
          base_price: number
          category_id: string
          created_at: string
          id: string
          issue_adjustment: number
          issue_type_id: string | null
          platform_fee_rate: number
          priority_multiplier: number
          updated_at: string
          zone_slug: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          category_id: string
          created_at?: string
          id?: string
          issue_adjustment?: number
          issue_type_id?: string | null
          platform_fee_rate?: number
          priority_multiplier?: number
          updated_at?: string
          zone_slug?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          category_id?: string
          created_at?: string
          id?: string
          issue_adjustment?: number
          issue_type_id?: string | null
          platform_fee_rate?: number
          priority_multiplier?: number
          updated_at?: string
          zone_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rules_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "service_issue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          professional_id: string
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          professional_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_documents: {
        Row: {
          created_at: string
          document_type: string
          expires_at: string | null
          id: string
          professional_id: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_bucket: string
          storage_path: string
          version: number
        }
        Insert: {
          created_at?: string
          document_type: string
          expires_at?: string | null
          id?: string
          professional_id: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_bucket: string
          storage_path: string
          version?: number
        }
        Update: {
          created_at?: string
          document_type?: string
          expires_at?: string | null
          id?: string
          professional_id?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_invitations: {
        Row: {
          bound_auth_user_id: string | null
          consumed_at: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          phone: string | null
          specialty_slug: string
          status: string
          token_hash: string
          updated_at: string
          version: number
        }
        Insert: {
          bound_auth_user_id?: string | null
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          phone?: string | null
          specialty_slug?: string
          status?: string
          token_hash: string
          updated_at?: string
          version?: number
        }
        Update: {
          bound_auth_user_id?: string | null
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          phone?: string | null
          specialty_slug?: string
          status?: string
          token_hash?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_payment_accounts: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          created_at: string
          id: string
          professional_id: string
          provider: string
          provider_user_id: string | null
          refresh_token_encrypted: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          professional_id: string
          provider?: string
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          created_at?: string
          id?: string
          professional_id?: string
          provider?: string
          provider_user_id?: string | null
          refresh_token_encrypted?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_payment_accounts_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_profiles: {
        Row: {
          acceptance_rate: number
          base_location: string | null
          bio: string | null
          birthdate: string | null
          created_at: string
          cuil: string | null
          current_submission_id: string | null
          dni: string | null
          has_mobility: boolean
          id: string
          internal_score: number
          invitation_id: string | null
          jobs_completed: number
          license_entity: string | null
          license_expires_at: string | null
          license_number: string | null
          mobility_type: string | null
          profile_id: string
          rating_avg: number | null
          status: Database["public"]["Enums"]["professional_status"]
          updated_at: string
          version: number
          years_experience: number
        }
        Insert: {
          acceptance_rate?: number
          base_location?: string | null
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          cuil?: string | null
          current_submission_id?: string | null
          dni?: string | null
          has_mobility?: boolean
          id?: string
          internal_score?: number
          invitation_id?: string | null
          jobs_completed?: number
          license_entity?: string | null
          license_expires_at?: string | null
          license_number?: string | null
          mobility_type?: string | null
          profile_id: string
          rating_avg?: number | null
          status?: Database["public"]["Enums"]["professional_status"]
          updated_at?: string
          version?: number
          years_experience?: number
        }
        Update: {
          acceptance_rate?: number
          base_location?: string | null
          bio?: string | null
          birthdate?: string | null
          created_at?: string
          cuil?: string | null
          current_submission_id?: string | null
          dni?: string | null
          has_mobility?: boolean
          id?: string
          internal_score?: number
          invitation_id?: string | null
          jobs_completed?: number
          license_entity?: string | null
          license_expires_at?: string | null
          license_number?: string | null
          mobility_type?: string | null
          profile_id?: string
          rating_avg?: number | null
          status?: Database["public"]["Enums"]["professional_status"]
          updated_at?: string
          version?: number
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_profiles_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "professional_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_service_categories: {
        Row: {
          approved: boolean
          category_id: string
          created_at: string
          id: string
          professional_id: string
        }
        Insert: {
          approved?: boolean
          category_id: string
          created_at?: string
          id?: string
          professional_id: string
        }
        Update: {
          approved?: boolean
          category_id?: string
          created_at?: string
          id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_service_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_service_categories_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_service_zones: {
        Row: {
          active: boolean
          created_at: string
          id: string
          professional_id: string
          radius_km: number
          service_zone_id: string | null
          zone_name: string
          zone_slug: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          professional_id: string
          radius_km?: number
          service_zone_id?: string | null
          zone_name: string
          zone_slug: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          professional_id?: string
          radius_km?: number
          service_zone_id?: string | null
          zone_name?: string
          zone_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_service_zones_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_service_zones_service_zone_id_fkey"
            columns: ["service_zone_id"]
            isOneToOne: false
            referencedRelation: "service_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_tools: {
        Row: {
          created_at: string
          has_tool: boolean
          id: string
          notes: string | null
          professional_id: string
          tool_code: string
          tool_label: string
        }
        Insert: {
          created_at?: string
          has_tool?: boolean
          id?: string
          notes?: string | null
          professional_id: string
          tool_code: string
          tool_label: string
        }
        Update: {
          created_at?: string
          has_tool?: boolean
          id?: string
          notes?: string | null
          professional_id?: string
          tool_code?: string
          tool_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_tools_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_training_completions: {
        Row: {
          completed_at: string
          id: string
          module_id: string
          professional_id: string
          score: number | null
        }
        Insert: {
          completed_at?: string
          id?: string
          module_id: string
          professional_id: string
          score?: number | null
        }
        Update: {
          completed_at?: string
          id?: string
          module_id?: string
          professional_id?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_training_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "professional_training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_training_completions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_training_modules: {
        Row: {
          active: boolean
          category_slug: string
          created_at: string
          description: string | null
          id: string
          required_for_approval: boolean
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_slug?: string
          created_at?: string
          description?: string | null
          id?: string
          required_for_approval?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_slug?: string
          created_at?: string
          description?: string | null
          id?: string
          required_for_approval?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          notification_preference: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          version: number
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string
          id?: string
          last_name?: string
          notification_preference?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          version?: number
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          notification_preference?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      public_receipts: {
        Row: {
          id: string
          job_id: string
          next_maintenance_text: string | null
          professional_public_name: string
          published_at: string
          revoked_at: string | null
          service_name: string
          token: string
          warranty_text: string
          work_done: string
        }
        Insert: {
          id?: string
          job_id: string
          next_maintenance_text?: string | null
          professional_public_name: string
          published_at?: string
          revoked_at?: string | null
          service_name: string
          token?: string
          warranty_text: string
          work_done: string
        }
        Update: {
          id?: string
          job_id?: string
          next_maintenance_text?: string | null
          professional_public_name?: string
          published_at?: string
          revoked_at?: string | null
          service_name?: string
          token?: string
          warranty_text?: string
          work_done?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
        ]
      }
      quality_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          job_id: string | null
          notes: string | null
          professional_id: string | null
          score_delta: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          job_id?: string | null
          notes?: string | null
          professional_id?: string | null
          score_delta?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          professional_id?: string | null
          score_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "quality_events_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          expires_at: string
          final_report_id: string
          id: string
          job_id: string
          public_token: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          final_report_id: string
          id?: string
          job_id: string
          public_token?: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          final_report_id?: string
          id?: string
          job_id?: string
          public_token?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_final_report_id_fkey"
            columns: ["final_report_id"]
            isOneToOne: true
            referencedRelation: "job_final_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
        ]
      }
      request_answers: {
        Row: {
          answer_json: Json
          answer_value: string | null
          created_at: string
          id: string
          question_code: string
          request_id: string
        }
        Insert: {
          answer_json?: Json
          answer_value?: string | null
          created_at?: string
          id?: string
          question_code: string
          request_id: string
        }
        Update: {
          answer_json?: Json
          answer_value?: string | null
          created_at?: string
          id?: string
          question_code?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_answers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_media: {
        Row: {
          created_at: string
          id: string
          media_type: Database["public"]["Enums"]["media_type"]
          request_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: Database["public"]["Enums"]["media_type"]
          request_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          request_id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_media_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          job_id: string
          problem_resolved: boolean | null
          professional_id: string | null
          professional_rating: number
          service_rating: number
          would_hire_again: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          job_id: string
          problem_resolved?: boolean | null
          professional_id?: string | null
          professional_rating: number
          service_rating: number
          would_hire_again?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          job_id?: string
          problem_resolved?: boolean | null
          professional_id?: string | null
          professional_rating?: number
          service_rating?: number
          would_hire_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "reviews_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professional_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_issue_types: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_issue_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      service_question_options: {
        Row: {
          created_at: string
          id: string
          label: string
          metadata: Json
          question_id: string
          sort_order: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          metadata?: Json
          question_id: string
          sort_order?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          metadata?: Json
          question_id?: string
          sort_order?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "service_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_questions: {
        Row: {
          active: boolean
          category_id: string
          code: string
          created_at: string
          id: string
          input_type: string
          issue_type_id: string | null
          label: string
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          code: string
          created_at?: string
          id?: string
          input_type?: string
          issue_type_id?: string | null
          label: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          code?: string
          created_at?: string
          id?: string
          input_type?: string
          issue_type_id?: string | null
          label?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_questions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_questions_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "service_issue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_quotes: {
        Row: {
          acceptance_result: Json | null
          accepted_at: string | null
          address: Json
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string
          id: string
          input: Json
          manual_route_reason: string | null
          policy_id: string | null
          policy_snapshot: Json | null
          preferred_date: string
          previous_quote_id: string | null
          quote: Json
          request_id: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number
          revision_reason: string | null
          root_quote_id: string | null
          status: string
          time_window: string
          upload_intent_ids: string[]
          version: number
        }
        Insert: {
          acceptance_result?: Json | null
          accepted_at?: string | null
          address: Json
          created_at?: string
          created_by?: string | null
          customer_id: string
          expires_at: string
          id?: string
          input: Json
          manual_route_reason?: string | null
          policy_id?: string | null
          policy_snapshot?: Json | null
          preferred_date: string
          previous_quote_id?: string | null
          quote: Json
          request_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          revision_reason?: string | null
          root_quote_id?: string | null
          status: string
          time_window: string
          upload_intent_ids?: string[]
          version?: number
        }
        Update: {
          acceptance_result?: Json | null
          accepted_at?: string | null
          address?: Json
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expires_at?: string
          id?: string
          input?: Json
          manual_route_reason?: string | null
          policy_id?: string | null
          policy_snapshot?: Json | null
          preferred_date?: string
          previous_quote_id?: string | null
          quote?: Json
          request_id?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          revision_reason?: string | null
          root_quote_id?: string | null
          status?: string
          time_window?: string
          upload_intent_ids?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_previous_quote_id_fkey"
            columns: ["previous_quote_id"]
            isOneToOne: true
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_root_quote_id_fkey"
            columns: ["root_quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          address_id: string | null
          category_id: string
          created_at: string
          customer_id: string
          equipment_id: string | null
          id: string
          issue_type_id: string
          preferred_date: string | null
          preferred_time_window: string | null
          selected_price_option_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string | null
          time_since: string | null
          updated_at: string
          urgency_level: Database["public"]["Enums"]["urgency_level"] | null
        }
        Insert: {
          address_id?: string | null
          category_id: string
          created_at?: string
          customer_id: string
          equipment_id?: string | null
          id?: string
          issue_type_id: string
          preferred_date?: string | null
          preferred_time_window?: string | null
          selected_price_option_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          time_since?: string | null
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Update: {
          address_id?: string | null
          category_id?: string
          created_at?: string
          customer_id?: string
          equipment_id?: string | null
          id?: string
          issue_type_id?: string
          preferred_date?: string | null
          preferred_time_window?: string | null
          selected_price_option_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          submitted_at?: string | null
          time_since?: string | null
          updated_at?: string
          urgency_level?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_address_owner_fk"
            columns: ["address_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "service_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_equipment_owner_fk"
            columns: [
              "equipment_id",
              "customer_id",
              "address_id",
              "category_id",
            ]
            isOneToOne: false
            referencedRelation: "customer_equipment"
            referencedColumns: [
              "id",
              "customer_id",
              "address_id",
              "category_id",
            ]
          },
          {
            foreignKeyName: "service_requests_issue_type_id_fkey"
            columns: ["issue_type_id"]
            isOneToOne: false
            referencedRelation: "service_issue_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_selected_price_fk"
            columns: ["selected_price_option_id"]
            isOneToOne: false
            referencedRelation: "price_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_selected_price_owner_fk"
            columns: ["selected_price_option_id", "id"]
            isOneToOne: false
            referencedRelation: "price_options"
            referencedColumns: ["id", "request_id"]
          },
        ]
      }
      service_zones: {
        Row: {
          active: boolean
          city: string
          created_at: string
          id: string
          name: string
          priority_weight: number
          province: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string
          created_at?: string
          id?: string
          name: string
          priority_weight?: number
          province?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          id?: string
          name?: string
          priority_weight?: number
          province?: string
          updated_at?: string
        }
        Relationships: []
      }
      warranty_claims: {
        Row: {
          created_at: string
          customer_id: string
          description: string
          id: string
          job_id: string
          resolution: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description: string
          id?: string
          job_id: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string
          id?: string
          job_id?: string
          resolution?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_claims_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "public_receipt_view"
            referencedColumns: ["job_id"]
          },
        ]
      }
    }
    Views: {
      public_receipt_view: {
        Row: {
          created_at: string | null
          equipment_brand: string | null
          equipment_model: string | null
          equipment_nickname: string | null
          equipment_type: string | null
          final_state: string | null
          job_id: string | null
          job_status: Database["public"]["Enums"]["job_status"] | null
          maintenance_option:
            | Database["public"]["Enums"]["maintenance_option"]
            | null
          next_maintenance_date: string | null
          professional_first_name: string | null
          professional_last_name: string | null
          public_token: string | null
          real_diagnosis: string | null
          scheduled_date: string | null
          scheduled_time_window: string | null
          warranty_days: number | null
          work_done: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_professional_invitation: {
        Args: { p_token: string }
        Returns: Json
      }
      ack_outbox_event: {
        Args: {
          p_claim_token: string
          p_event_id: string
          p_provider_message_id?: string
        }
        Returns: boolean
      }
      ack_provider_event: {
        Args: { p_claim_token: string; p_event_id: string }
        Returns: boolean
      }
      advance_service_job: {
        Args: { p_expected_status: string; p_job_id: string }
        Returns: Json
      }
      apply_mercadopago_payment_webhook: {
        Args: {
          p_provider_event_id: string
          p_provider_payment_id: string
          p_provider_status: string
          p_raw_payload: Json
        }
        Returns: Json
      }
      assign_professional_to_job: {
        Args: {
          p_admin_profile_id: string
          p_job_id: string
          p_professional_id: string
          p_request_id: string
        }
        Returns: Json
      }
      bootstrap_customer_account: { Args: never; Returns: Json }
      cancel_professional_invitation: {
        Args: { p_expected_version: number; p_id: string; p_reason: string }
        Returns: Json
      }
      change_admin_permissions: {
        Args: {
          p_admin_profile_id: string
          p_expected_version: number
          p_permissions: Database["public"]["Enums"]["admin_permission"][]
          p_reason: string
        }
        Returns: Json
      }
      claim_expired_upload_intents: { Args: { p_limit: number }; Returns: Json }
      claim_outbox_events: {
        Args: {
          p_batch_size?: number
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          channel: string
          claim_token: string
          created_at: string
          dedupe_key: string
          event_type: string
          id: string
          locked_until: string
          payload: Json
          recipient_key: string
          recipient_profile_id: string
        }[]
      }
      claim_payment_refund_requests: {
        Args: { p_batch_size?: number; p_lease_seconds?: number }
        Returns: {
          amount: number
          attempt_count: number
          claim_token: string
          currency: string
          locked_until: string
          payment_id: string
          provider_idempotency_key: string
          provider_payment_id: string
          reason: string
          request_id: string
          status: string
        }[]
      }
      claim_provider_events: {
        Args: {
          p_batch_size?: number
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          claim_token: string
          event_type: string
          id: string
          locked_until: string
          payload: Json
          provider: string
          provider_event_id: string
          provider_occurred_at: string
          provider_resource_id: string
          received_at: string
          resource_type: string
        }[]
      }
      close_job_with_final_report: {
        Args: {
          p_equipment_id: string
          p_final_state: string
          p_internal_notes?: string
          p_job_id: string
          p_maintenance_option: Database["public"]["Enums"]["maintenance_option"]
          p_next_maintenance_date: string
          p_parts_used: string
          p_real_diagnosis: string
          p_warranty_days: number
          p_work_done: string
        }
        Returns: Json
      }
      complete_customer_registration: {
        Args: {
          p_accepted: boolean
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_privacy_version: string
          p_terms_version: string
        }
        Returns: Json
      }
      complete_upload_cleanup: {
        Args: { p_intent_id: string; p_lease_token: string }
        Returns: boolean
      }
      create_admin_audit_event: {
        Args: {
          action: string
          entity_id: string
          entity_type: string
          metadata?: Json
        }
        Returns: string
      }
      create_professional_invitation: {
        Args: { p_email: string; p_reason: string; p_specialty_slug: string }
        Returns: Json
      }
      create_service_request_from_app: {
        Args: {
          p_address_id: string
          p_category_slug: string
          p_customer_id: string
          p_diagnosis: Json
          p_flexible_price: number
          p_issue_slug: string
          p_preferred_date: string
          p_preferred_time_window: string
          p_priority_price: number
          p_selected_amount: number
          p_selected_option: Database["public"]["Enums"]["urgency_level"]
          p_time_since: string
        }
        Returns: Json
      }
      create_upload_intent: {
        Args: {
          p_document_type: string
          p_draft_id: string
          p_entity_id: string
          p_kind: string
          p_mime_type: string
          p_phase: string
          p_sha256: string
          p_size_bytes: number
        }
        Returns: Json
      }
      current_customer_id: { Args: never; Returns: string }
      current_professional_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      decide_job_extra: {
        Args: { p_decision: string; p_extra_id: string }
        Returns: Json
      }
      decide_professional_application: {
        Args: {
          p_decision: string
          p_expected_version: number
          p_professional_id: string
          p_reason: string
        }
        Returns: Json
      }
      enqueue_outbox_event: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_channel: string
          p_dedupe_key: string
          p_event_type: string
          p_payload: Json
          p_recipient_key: string
          p_recipient_profile_id: string
        }
        Returns: string
      }
      fail_outbox_event: {
        Args: {
          p_claim_token: string
          p_error: string
          p_event_id: string
          p_retry_at?: string
        }
        Returns: boolean
      }
      fail_payment_refund_request: {
        Args: {
          p_claim_token: string
          p_failure_reason: string
          p_is_definitive: boolean
          p_request_id: string
          p_retry_seconds?: number
        }
        Returns: Json
      }
      fail_provider_event: {
        Args: {
          p_claim_token: string
          p_error: string
          p_event_id: string
          p_retry_at?: string
        }
        Returns: boolean
      }
      finalize_payment_refund_request: {
        Args: {
          p_claim_token: string
          p_provider_reference: string
          p_request_id: string
        }
        Returns: Json
      }
      finalize_storage_upload: {
        Args: {
          p_bucket: string
          p_document_type?: string
          p_entity_id: string
          p_media_type?: Database["public"]["Enums"]["media_type"]
          p_path: string
          p_phase?: string
        }
        Returns: string
      }
      finalize_verified_upload:
        | {
            Args: {
              p_actor_auth_user_id: string
              p_actual_mime_type: string
              p_actual_sha256: string
              p_actual_size_bytes: number
              p_intent_id: string
              p_output_sha256: string
              p_output_size_bytes: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_actor_auth_user_id: string
              p_actor_session_id: string
              p_actual_mime_type: string
              p_actual_sha256: string
              p_actual_size_bytes: number
              p_intent_id: string
              p_output_sha256: string
              p_output_size_bytes: number
            }
            Returns: Json
          }
      get_quote_policy: { Args: never; Returns: Json }
      get_quote_policy_record: { Args: never; Returns: Json }
      get_registration_policy: { Args: never; Returns: Json }
      get_session_context: { Args: never; Returns: Json }
      get_upload_intent: { Args: { p_intent_id: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      list_admin_workflow: {
        Args: {
          p_cursor_at: string
          p_cursor_id: string
          p_limit: number
          p_resource: string
        }
        Returns: Json
      }
      list_professional_workflow: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_limit?: number
          p_resource: string
        }
        Returns: Json
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: string
      }
      lookup_public_receipt: {
        Args: { p_token: string }
        Returns: {
          issued_at: string
          next_maintenance_date: string
          professional_name: string
          service_name: string
          warranty_days: number
          work_done: string
        }[]
      }
      persist_calculated_quote: {
        Args: {
          p_actor_session_id: string
          p_actor_user_id: string
          p_customer_id: string
          p_payload: Json
        }
        Returns: Json
      }
      professional_invitation_matches: {
        Args: { p_email: string; p_token: string }
        Returns: boolean
      }
      professional_respond_to_job: {
        Args: {
          p_job_id: string
          p_professional_id: string
          p_reason?: string
          p_response: string
        }
        Returns: Json
      }
      professional_review_context: { Args: { p_id?: string }; Returns: Json }
      propose_job_extra: {
        Args: {
          p_amount: number
          p_description: string
          p_fault: string
          p_idempotency_key: string
          p_job_id: string
        }
        Returns: Json
      }
      read_professional_onboarding: { Args: never; Returns: Json }
      register_provider_event: {
        Args: {
          p_event_type: string
          p_payload: Json
          p_provider: string
          p_provider_event_id: string
          p_provider_occurred_at?: string
          p_provider_resource_id: string
          p_resource_type: string
        }
        Returns: string
      }
      request_payment_refund: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_payment_id: string
          p_reason: string
        }
        Returns: Json
      }
      review_professional_document: {
        Args: {
          p_decision: string
          p_document_id: string
          p_expected_version: number
          p_expires_at: string
          p_reason: string
        }
        Returns: Json
      }
      review_service_quote: {
        Args: { p_quote_id: string; p_reason: string }
        Returns: Json
      }
      review_service_quote_v2: {
        Args: {
          p_expected_version: number
          p_quote_id: string
          p_reason: string
        }
        Returns: Json
      }
      save_professional_onboarding: {
        Args: { p_expected_version: number; p_input: Json }
        Returns: Json
      }
      set_admin_permissions: {
        Args: {
          p_admin_profile_id: string
          p_permissions: Database["public"]["Enums"]["admin_permission"][]
        }
        Returns: undefined
      }
      submit_customer_review_transaction: {
        Args: {
          p_comment: string
          p_customer_id: string
          p_job_id: string
          p_problem_resolved: boolean
          p_professional_rating: number
          p_service_rating: number
          p_would_hire_again: boolean
        }
        Returns: Json
      }
      submit_professional_application: {
        Args: {
          p_accepted: boolean
          p_expected_version: number
          p_privacy_version: string
          p_terms_version: string
        }
        Returns: Json
      }
      submit_service_quote: { Args: { p_quote_id: string }; Returns: Json }
      submit_service_quote_v2: {
        Args: { p_expected_version: number; p_quote_id: string }
        Returns: Json
      }
      suspend_professional: {
        Args: { p_professional_id: string; p_reason: string }
        Returns: Json
      }
      update_quote_policy: { Args: { p_policy: Json }; Returns: Json }
      update_quote_policy_v2: {
        Args: { p_expected_revision: number; p_policy: Json; p_reason: string }
        Returns: Json
      }
      write_customer_asset: {
        Args: {
          p_archive?: boolean
          p_data: Json
          p_expected_version: number
          p_id: string
          p_kind: string
        }
        Returns: Json
      }
    }
    Enums: {
      admin_permission: "operations" | "finance" | "quality" | "owner"
      job_status:
        | "pending_assignment"
        | "pending_professional_acceptance"
        | "confirmed"
        | "technician_on_way"
        | "arrived"
        | "onsite_diagnosis"
        | "waiting_customer_approval"
        | "in_progress"
        | "completed_pending_customer_confirmation"
        | "completed"
        | "cancelled_by_customer"
        | "cancelled_by_professional"
        | "cancelled_by_admin"
        | "disputed"
        | "warranty_claim"
      maintenance_option:
        | "none"
        | "filters_30_days"
        | "filters_60_days"
        | "filters_90_days"
        | "deep_cleaning_6_months"
        | "deep_cleaning_annual"
        | "gas_review_30_days"
        | "outdoor_unit_review"
        | "electrical_review"
        | "pending_part_replacement"
        | "second_visit_recommended"
      media_type: "photo" | "video" | "document"
      payment_status:
        | "pending"
        | "authorized"
        | "approved"
        | "rejected"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
        | "captured"
        | "failed"
      professional_status:
        | "invited"
        | "form_started"
        | "form_submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "suspended"
        | "inactive"
      property_type: "house" | "apartment" | "commercial" | "office"
      request_status:
        | "draft"
        | "diagnosis_completed"
        | "address_completed"
        | "schedule_completed"
        | "price_selected"
        | "pending_payment"
        | "payment_approved"
        | "matching"
        | "pending_assignment"
        | "pending_professional_acceptance"
        | "assigned"
        | "cancelled"
        | "expired"
      urgency_level: "flexible" | "priority"
      user_role: "customer" | "professional" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_permission: ["operations", "finance", "quality", "owner"],
      job_status: [
        "pending_assignment",
        "pending_professional_acceptance",
        "confirmed",
        "technician_on_way",
        "arrived",
        "onsite_diagnosis",
        "waiting_customer_approval",
        "in_progress",
        "completed_pending_customer_confirmation",
        "completed",
        "cancelled_by_customer",
        "cancelled_by_professional",
        "cancelled_by_admin",
        "disputed",
        "warranty_claim",
      ],
      maintenance_option: [
        "none",
        "filters_30_days",
        "filters_60_days",
        "filters_90_days",
        "deep_cleaning_6_months",
        "deep_cleaning_annual",
        "gas_review_30_days",
        "outdoor_unit_review",
        "electrical_review",
        "pending_part_replacement",
        "second_visit_recommended",
      ],
      media_type: ["photo", "video", "document"],
      payment_status: [
        "pending",
        "authorized",
        "approved",
        "rejected",
        "cancelled",
        "refunded",
        "partially_refunded",
        "captured",
        "failed",
      ],
      professional_status: [
        "invited",
        "form_started",
        "form_submitted",
        "under_review",
        "approved",
        "rejected",
        "suspended",
        "inactive",
      ],
      property_type: ["house", "apartment", "commercial", "office"],
      request_status: [
        "draft",
        "diagnosis_completed",
        "address_completed",
        "schedule_completed",
        "price_selected",
        "pending_payment",
        "payment_approved",
        "matching",
        "pending_assignment",
        "pending_professional_acceptance",
        "assigned",
        "cancelled",
        "expired",
      ],
      urgency_level: ["flexible", "priority"],
      user_role: ["customer", "professional", "admin"],
    },
  },
} as const


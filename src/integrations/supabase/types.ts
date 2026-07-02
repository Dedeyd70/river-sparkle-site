export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      availability_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          booking_id: string
          created_at: string
          details: string | null
          id: string
          new_status: string | null
          notes: string | null
          previous_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          booking_id: string
          created_at?: string
          details?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          details?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          address: string
          bathrooms: number | null
          bedrooms: number | null
          booking_date: string
          cancellation_reason: string | null
          condition_level: string | null
          consent_given: boolean
          created_at: string
          custom_fields: Json
          email: string
          entry_codes: string | null
          floor_type: string | null
          frequency: string | null
          has_pets: boolean | null
          id: string
          is_empty_property: boolean | null
          line_items: Json | null
          name: string
          notes: string | null
          paid_at: string | null
          payment_status: string | null
          pet_count: number | null
          phone: string | null
          preferred_contact: string | null
          property_type: string | null
          quote_id: string | null
          selected_addons: Json | null
          service_type: string | null
          service_type_id: string | null
          source: string | null
          square_footage: string | null
          status: string
          subtotal: number | null
          tax_amount: number | null
          time_slot: string
          total_amount: number | null
          total_price: number | null
          updated_at: string
        }
        Insert: {
          address: string
          bathrooms?: number | null
          bedrooms?: number | null
          booking_date: string
          cancellation_reason?: string | null
          condition_level?: string | null
          consent_given?: boolean
          created_at?: string
          custom_fields?: Json
          email: string
          entry_codes?: string | null
          floor_type?: string | null
          frequency?: string | null
          has_pets?: boolean | null
          id?: string
          is_empty_property?: boolean | null
          line_items?: Json | null
          name: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          pet_count?: number | null
          phone?: string | null
          preferred_contact?: string | null
          property_type?: string | null
          quote_id?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          service_type_id?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          time_slot: string
          total_amount?: number | null
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          bathrooms?: number | null
          bedrooms?: number | null
          booking_date?: string
          cancellation_reason?: string | null
          condition_level?: string | null
          consent_given?: boolean
          created_at?: string
          custom_fields?: Json
          email?: string
          entry_codes?: string | null
          floor_type?: string | null
          frequency?: string | null
          has_pets?: boolean | null
          id?: string
          is_empty_property?: boolean | null
          line_items?: Json | null
          name?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          pet_count?: number | null
          phone?: string | null
          preferred_contact?: string | null
          property_type?: string | null
          quote_id?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          service_type_id?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          time_slot?: string
          total_amount?: number | null
          total_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      cleaner_application_responses: {
        Row: {
          application_id: string
          body: string | null
          created_at: string
          decision: string | null
          id: string
          recipient_email: string | null
          sent_at: string
          sent_by: string | null
          subject: string | null
        }
        Insert: {
          application_id: string
          body?: string | null
          created_at?: string
          decision?: string | null
          id?: string
          recipient_email?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string | null
        }
        Update: {
          application_id?: string
          body?: string | null
          created_at?: string
          decision?: string | null
          id?: string
          recipient_email?: string | null
          sent_at?: string
          sent_by?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_application_responses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "cleaner_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_applications: {
        Row: {
          address: string | null
          admin_notes: string | null
          authorized_to_work: boolean | null
          availability: string
          created_at: string
          email: string
          experience: string
          full_name: string
          has_license: boolean | null
          id: string
          message: string | null
          middle_name: string | null
          personality_bio: string | null
          phone: string
          reference_1: string | null
          reference_2: string | null
          reference_3: string | null
          resume_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          authorized_to_work?: boolean | null
          availability: string
          created_at?: string
          email: string
          experience: string
          full_name: string
          has_license?: boolean | null
          id?: string
          message?: string | null
          middle_name?: string | null
          personality_bio?: string | null
          phone: string
          reference_1?: string | null
          reference_2?: string | null
          reference_3?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          authorized_to_work?: boolean | null
          availability?: string
          created_at?: string
          email?: string
          experience?: string
          full_name?: string
          has_license?: boolean | null
          id?: string
          message?: string | null
          middle_name?: string | null
          personality_bio?: string | null
          phone?: string
          reference_1?: string | null
          reference_2?: string | null
          reference_3?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      condition_settings: {
        Row: {
          created_at: string
          id: string
          name: string
          surcharge_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          surcharge_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          surcharge_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          contact_id: string
          created_at: string
          details: string | null
          id: string
          new_status: string | null
          notes: string | null
          previous_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          contact_id: string
          created_at?: string
          details?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          contact_id?: string
          created_at?: string
          details?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          service_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          question: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
        }
        Relationships: []
      }
      gallery: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          display_order: number
          group_id: string | null
          id: string
          image_type: string
          image_url: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          image_type?: string
          image_url: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          display_order?: number
          group_id?: string | null
          id?: string
          image_type?: string
          image_url?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      homepage_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          label: string
          section_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string
          section_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          address: string | null
          amount_paid: number
          booking_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string
          customer_name: string
          due_date: string | null
          id: string
          invoice_number: string | null
          issued_date: string
          line_items: Json | null
          notes: string | null
          paid_at: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          quote_id: string | null
          service_type_id: string | null
          services: Json
          subtotal: number
          tax: number | null
          tax_amount: number
          tax_rate: number
          total: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          amount_paid?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email: string
          customer_name: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_date?: string
          line_items?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          quote_id?: string | null
          service_type_id?: string | null
          services?: Json
          subtotal?: number
          tax?: number | null
          tax_amount?: number
          tax_rate?: number
          total?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          amount_paid?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string
          customer_name?: string
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issued_date?: string
          line_items?: Json | null
          notes?: string | null
          paid_at?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          quote_id?: string | null
          service_type_id?: string | null
          services?: Json
          subtotal?: number
          tax?: number | null
          tax_amount?: number
          tax_rate?: number
          total?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      page_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          page_name: string
          section_key: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          page_name: string
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          page_name?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      permission_registry: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      pricing_multipliers: {
        Row: {
          axis: string
          created_at: string | null
          display_label: string | null
          id: string
          is_active: boolean | null
          key: string
          modifier_type: string | null
          service_type_id: string | null
          value: number
        }
        Insert: {
          axis: string
          created_at?: string | null
          display_label?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          modifier_type?: string | null
          service_type_id?: string | null
          value: number
        }
        Update: {
          axis?: string
          created_at?: string | null
          display_label?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          modifier_type?: string | null
          service_type_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_multipliers_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_drafts: {
        Row: {
          addons: Json
          base_price: number
          breakdown: Json
          condition_multiplier: number
          discount: number
          id: string
          line_items: Json
          manual_adjustment: number
          notes: string | null
          prepared_at: string
          prepared_by: string | null
          quote_id: string
          scope: string | null
          service_type: string | null
          service_type_id: string | null
          tax_rate: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          addons?: Json
          base_price?: number
          breakdown?: Json
          condition_multiplier?: number
          discount?: number
          id?: string
          line_items?: Json
          manual_adjustment?: number
          notes?: string | null
          prepared_at?: string
          prepared_by?: string | null
          quote_id: string
          scope?: string | null
          service_type?: string | null
          service_type_id?: string | null
          tax_rate?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          addons?: Json
          base_price?: number
          breakdown?: Json
          condition_multiplier?: number
          discount?: number
          id?: string
          line_items?: Json
          manual_adjustment?: number
          notes?: string | null
          prepared_at?: string
          prepared_by?: string | null
          quote_id?: string
          scope?: string | null
          service_type?: string | null
          service_type_id?: string | null
          tax_rate?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_drafts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_drafts_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          quote_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          quote_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_notes_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address: string | null
          attachment_url: string | null
          bathrooms: number | null
          bedrooms: number | null
          close_reason: string | null
          condition_level: string | null
          consent_given: boolean
          created_at: string
          custom_fields: Json
          description: string
          email: string
          entry_codes: string | null
          floor_type: string | null
          frequency: string | null
          full_bathrooms: number | null
          half_bathrooms: number | null
          has_cabinets: boolean | null
          has_pets: boolean | null
          id: string
          is_empty_property: boolean | null
          kitchen_count: number | null
          living_rooms: number | null
          name: string
          office_rooms: number | null
          pet_count: number | null
          phone: string | null
          preferred_contact: string | null
          property_size: string | null
          property_type: string | null
          quote_number: string | null
          selected_addons: Json | null
          service_type: string | null
          service_type_id: string | null
          square_footage: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          attachment_url?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          close_reason?: string | null
          condition_level?: string | null
          consent_given?: boolean
          created_at?: string
          custom_fields?: Json
          description: string
          email: string
          entry_codes?: string | null
          floor_type?: string | null
          frequency?: string | null
          full_bathrooms?: number | null
          half_bathrooms?: number | null
          has_cabinets?: boolean | null
          has_pets?: boolean | null
          id?: string
          is_empty_property?: boolean | null
          kitchen_count?: number | null
          living_rooms?: number | null
          name: string
          office_rooms?: number | null
          pet_count?: number | null
          phone?: string | null
          preferred_contact?: string | null
          property_size?: string | null
          property_type?: string | null
          quote_number?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          service_type_id?: string | null
          square_footage?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          attachment_url?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          close_reason?: string | null
          condition_level?: string | null
          consent_given?: boolean
          created_at?: string
          custom_fields?: Json
          description?: string
          email?: string
          entry_codes?: string | null
          floor_type?: string | null
          frequency?: string | null
          full_bathrooms?: number | null
          half_bathrooms?: number | null
          has_cabinets?: boolean | null
          has_pets?: boolean | null
          id?: string
          is_empty_property?: boolean | null
          kitchen_count?: number | null
          living_rooms?: number | null
          name?: string
          office_rooms?: number | null
          pet_count?: number | null
          phone?: string | null
          preferred_contact?: string | null
          property_size?: string | null
          property_type?: string | null
          quote_number?: string | null
          selected_addons?: Json | null
          service_type?: string | null
          service_type_id?: string | null
          square_footage?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          id: string
          invoice_id: string
          line_items: Json | null
          payment_date: string | null
          receipt_number: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          id?: string
          invoice_id: string
          line_items?: Json | null
          payment_date?: string | null
          receipt_number?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string
          line_items?: Json | null
          payment_date?: string | null
          receipt_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          customer_name: string
          id: string
          is_public: boolean
          rating: number
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_public?: boolean
          rating: number
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_public?: boolean
          rating?: number
        }
        Relationships: []
      }
      service_areas: {
        Row: {
          city: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          zip: string
        }
        Insert: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      service_fields: {
        Row: {
          created_at: string
          display_order: number
          field_key: string
          id: string
          input_type: string
          label: string
          options: Json
          required: boolean
          service_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_key: string
          id?: string
          input_type?: string
          label: string
          options?: Json
          required?: boolean
          service_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_key?: string
          id?: string
          input_type?: string
          label?: string
          options?: Json
          required?: boolean
          service_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_fields_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_pricing_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          service_type_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          service_type_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          service_type_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_pricing_rules_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          base_price: number
          created_at: string
          id: string
          name: string
          tax_applies: boolean
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          id?: string
          name: string
          tax_applies?: boolean
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          name?: string
          tax_applies?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string
          display_order: number
          features: string[]
          icon: string
          id: string
          image_url: string | null
          is_active: boolean
          price_starting: string | null
          service_category: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          features?: string[]
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_starting?: string | null
          service_category?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          features?: string[]
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_starting?: string | null
          service_category?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_links: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          platform_name: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          platform_name: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          platform_name?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_name: string
          author_role: string
          content: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          rating: number
          updated_at: string
        }
        Insert: {
          author_name: string
          author_role?: string
          content: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          rating?: number
          updated_at?: string
        }
        Update: {
          author_name?: string
          author_role?: string
          content?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          permissions: Json
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          permissions?: Json
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_recent_submission: {
        Args: { p_email: string; p_table: string }
        Returns: boolean
      }
      check_slot_overlap: {
        Args: {
          p_date: string
          p_exclude_booking?: string
          p_time_slot: string
        }
        Returns: boolean
      }
      cleanup_old_records: {
        Args: { p_days?: number; p_dry_run?: boolean }
        Returns: Json
      }
      confirm_invoice_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_method: string
          p_payment_date?: string
          p_reference?: string
        }
        Returns: Json
      }
      convert_quote_to_booking: {
        Args: {
          p_booking_date: string
          p_quote_id: string
          p_time_slot: string
        }
        Returns: Json
      }
      create_invoice_from_booking: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      create_receipt: { Args: { p_invoice_id: string }; Returns: Json }
      generate_receipt_number: { Args: never; Returns: string }
      get_admin_display_names: {
        Args: { _user_ids: string[] }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      get_booked_slots: {
        Args: { p_date: string }
        Returns: {
          time_slot: string
        }[]
      }
      get_public_stats: { Args: never; Returns: Json }
      has_permission: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_contact_activity: {
        Args: {
          p_action: string
          p_contact_id: string
          p_details?: string
          p_new_status?: string
          p_notes?: string
          p_previous_status?: string
        }
        Returns: string
      }
      mark_invoice_paid: { Args: { p_invoice_id: string }; Returns: Json }
      parse_time_slot: { Args: { p_slot: string }; Returns: unknown }
      submit_review: {
        Args: {
          p_booking_id: string
          p_comment: string
          p_email: string
          p_name: string
          p_rating: number
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "staff"
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
      app_role: ["admin", "user", "manager", "staff"],
    },
  },
} as const

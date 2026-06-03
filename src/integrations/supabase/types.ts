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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          agent: string
          created_at: string
          detail: string
          id: number
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          agent?: string
          created_at?: string
          detail?: string
          id?: number
          status?: string
          task_id?: string
          user_id: string
        }
        Update: {
          action?: string
          agent?: string
          created_at?: string
          detail?: string
          id?: number
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applied_at: string | null
          company: string
          cover_letter_md: string
          created_at: string
          id: string
          job_title: string
          listing_id: string
          match_score: number
          notes: string
          resume_md: string
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company: string
          cover_letter_md?: string
          created_at?: string
          id?: string
          job_title: string
          listing_id: string
          match_score?: number
          notes?: string
          resume_md?: string
          status?: string
          task_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company?: string
          cover_letter_md?: string
          created_at?: string
          id?: string
          job_title?: string
          listing_id?: string
          match_score?: number
          notes?: string
          resume_md?: string
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          created_at: string
          education: Json
          email: string
          experience: Json
          headline: string
          id: string
          links: Json
          location: string
          name: string
          phone: string
          skills: Json
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          headline?: string
          id?: string
          links?: Json
          location?: string
          name?: string
          phone?: string
          skills?: Json
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          headline?: string
          id?: string
          links?: Json
          location?: string
          name?: string
          phone?: string
          skills?: Json
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_listings: {
        Row: {
          company: string
          description: string
          discovered_at: string
          external_id: string
          id: string
          location: string
          match_score: number
          posted_at: string | null
          remote: boolean
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          source: string
          status: string
          task_id: string
          tech_stack: Json
          title: string
          url: string
          user_id: string
        }
        Insert: {
          company: string
          description?: string
          discovered_at?: string
          external_id: string
          id?: string
          location?: string
          match_score?: number
          posted_at?: string | null
          remote?: boolean
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          source: string
          status?: string
          task_id?: string
          tech_stack?: Json
          title: string
          url?: string
          user_id: string
        }
        Update: {
          company?: string
          description?: string
          discovered_at?: string
          external_id?: string
          id?: string
          location?: string
          match_score?: number
          posted_at?: string | null
          remote?: boolean
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          source?: string
          status?: string
          task_id?: string
          tech_stack?: Json
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          certifications: Json
          created_at: string
          education: Json
          email: string
          experience: Json
          github_url: string
          headline: string
          id: string
          linkedin_url: string
          location: string
          name: string
          onboarded: boolean
          phone: string
          portfolio_url: string
          skills: Json
          summary: string
          updated_at: string
        }
        Insert: {
          certifications?: Json
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          github_url?: string
          headline?: string
          id: string
          linkedin_url?: string
          location?: string
          name?: string
          onboarded?: boolean
          phone?: string
          portfolio_url?: string
          skills?: Json
          summary?: string
          updated_at?: string
        }
        Update: {
          certifications?: Json
          created_at?: string
          education?: Json
          email?: string
          experience?: Json
          github_url?: string
          headline?: string
          id?: string
          linkedin_url?: string
          location?: string
          name?: string
          onboarded?: boolean
          phone?: string
          portfolio_url?: string
          skills?: Json
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
